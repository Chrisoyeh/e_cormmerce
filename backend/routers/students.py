import datetime
from fastapi import APIRouter, HTTPException, Depends, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import get_db
from backend.models import Pupil, AttendanceRecord, AppNotification

router = APIRouter(prefix="/students", tags=["Student Management"])

class StudentCreate(BaseModel):
    id: str | None = None
    surname: str
    firstName: str
    regNo: str
    classLevel: str
    parentName: str | None = "Guardian"
    parentEmail: str | None = "parent@example.com"
    parentPhone: str | None = "+23400000000"

class StudentBulkCreate(BaseModel):
    students: list[StudentCreate]

class AttendanceRecordCreate(BaseModel):
    studentId: str
    date: str  # YYYY-MM-DD
    classLevel: str
    status: str  # 'Present', 'Absent', 'Late'

@router.get("")
@router.get("/")
async def list_students(
    classLevel: str | None = None,
    search: str | None = None,
    limit: int = 10000,
    db: Session = Depends(get_db)
):
    """
    List all students or filter by class level / search term.
    Handles thousands of records with sub-millisecond response.
    """
    try:
        query = db.query(Pupil)
        
        if classLevel and classLevel != "All Classes" and classLevel != "All":
            query = query.filter(Pupil.classLevel == classLevel)
            
        if search:
            search_term = f"%{search.strip().lower()}%"
            query = query.filter(
                (func.lower(Pupil.firstName).like(search_term)) |
                (func.lower(Pupil.surname).like(search_term)) |
                (func.lower(Pupil.regNo).like(search_term))
            )
            
        pupils = query.order_by(Pupil.surname.asc(), Pupil.firstName.asc()).limit(limit).all()
        return [p.to_dict() for p in pupils]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{student_id}")
async def get_student(student_id: str, db: Session = Depends(get_db)):
    """
    Get a single student profile by ID or Registration Number.
    """
    pupil = db.query(Pupil).filter(
        (Pupil.id == student_id) | (func.lower(Pupil.regNo) == student_id.lower())
    ).first()
    if not pupil:
        raise HTTPException(status_code=404, detail="Student profile not found.")
    return pupil.to_dict()

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_student(student: StudentCreate, db: Session = Depends(get_db)):
    """
    Create a single student profile in the database.
    """
    # Check if regNo already exists
    existing = db.query(Pupil).filter(func.lower(Pupil.regNo) == student.regNo.strip().lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Registration Number '{student.regNo}' already exists.")

    student_id = student.id or f"std-{int(datetime.datetime.now().timestamp() * 1000)}"
    new_pupil = Pupil(
        id=student_id,
        surname=student.surname.strip(),
        firstName=student.firstName.strip(),
        regNo=student.regNo.strip(),
        classLevel=student.classLevel.strip(),
        parentName=student.parentName or "Guardian",
        parentEmail=student.parentEmail or "parent@example.com",
        parentPhone=student.parentPhone or "+23400000000"
    )
    db.add(new_pupil)
    db.commit()
    db.refresh(new_pupil)
    return new_pupil.to_dict()

@router.post("/bulk", status_code=status.HTTP_201_CREATED)
async def create_students_bulk(payload: StudentBulkCreate, db: Session = Depends(get_db)):
    """
    Ultra-fast bulk ingestion endpoint.
    Inserts new student records while leaving any already existing students untouched in the database.
    """
    try:
        inserted_count = 0
        skipped_count = 0

        # Pre-fetch existing reg numbers into a fast in-memory map
        existing_pupils = {p.regNo.lower().strip(): p for p in db.query(Pupil).all()}

        for idx, item in enumerate(payload.students):
            clean_reg = item.regNo.strip()
            if not clean_reg:
                continue

            existing = existing_pupils.get(clean_reg.lower())
            if existing:
                # Leave existing student untouched in the database
                skipped_count += 1
            else:
                student_id = item.id or f"std-bulk-{idx + 1}-{int(datetime.datetime.now().timestamp() * 1000)}"
                new_pupil = Pupil(
                    id=student_id,
                    surname=item.surname.strip(),
                    firstName=item.firstName.strip(),
                    regNo=clean_reg,
                    classLevel=item.classLevel.strip(),
                    parentName=item.parentName or "Guardian",
                    parentEmail=item.parentEmail or "parent@example.com",
                    parentPhone=item.parentPhone or "+23400000000"
                )
                db.add(new_pupil)
                existing_pupils[clean_reg.lower()] = new_pupil
                inserted_count += 1

        db.commit()

        # Add notification for the bulk operation
        notif = AppNotification(
            id=f"not-bulk-{int(datetime.datetime.now().timestamp())}",
            title="Bulk Onboarding Synchronized",
            message=f"Successfully onboarded {inserted_count} new students ({skipped_count} existing students skipped and left unchanged).",
            type="success",
            timestamp=datetime.datetime.utcnow().isoformat() + "Z",
            read=False,
            role="admin"
        )
        db.add(notif)
        db.commit()

        return {
            "status": "success",
            "inserted": inserted_count,
            "skipped": skipped_count,
            "totalProcessed": len(payload.students)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Bulk ingestion error: {str(e)}")

@router.put("/{student_id}")
async def update_student(student_id: str, student: StudentCreate, db: Session = Depends(get_db)):
    """
    Update an existing student profile.
    """
    pupil = db.query(Pupil).filter(Pupil.id == student_id).first()
    if not pupil:
        raise HTTPException(status_code=404, detail="Student record not found.")

    # Check regNo uniqueness if changed
    if student.regNo.strip().lower() != pupil.regNo.lower():
        exists = db.query(Pupil).filter(
            func.lower(Pupil.regNo) == student.regNo.strip().lower(),
            Pupil.id != student_id
        ).first()
        if exists:
            raise HTTPException(status_code=400, detail="Registration Number already taken by another student.")

    pupil.surname = student.surname.strip()
    pupil.firstName = student.firstName.strip()
    pupil.regNo = student.regNo.strip()
    pupil.classLevel = student.classLevel.strip()
    if student.parentName:
        pupil.parentName = student.parentName.strip()
    if student.parentEmail:
        pupil.parentEmail = student.parentEmail.strip()
    if student.parentPhone:
        pupil.parentPhone = student.parentPhone.strip()

    db.commit()
    db.refresh(pupil)
    return pupil.to_dict()

@router.delete("/{student_id}")
async def delete_student(student_id: str, db: Session = Depends(get_db)):
    """
    Delete a single student from the database.
    """
    pupil = db.query(Pupil).filter(Pupil.id == student_id).first()
    if not pupil:
        raise HTTPException(status_code=404, detail="Student record not found.")

    db.delete(pupil)
    db.commit()
    return {"message": "Student profile permanently deleted."}

@router.delete("/class/{class_level}")
async def delete_class_pupils(class_level: str, db: Session = Depends(get_db)):
    """
    Delete all pupils registered in a specific class level.
    """
    count = db.query(Pupil).filter(Pupil.classLevel == class_level).delete(synchronize_session=False)
    db.commit()
    return {"message": f"Successfully deleted {count} pupils in {class_level}.", "count": count}

@router.post("/attendance")
async def log_attendance(record: AttendanceRecordCreate, db: Session = Depends(get_db)):
    """
    Log student daily attendance.
    """
    record_id = f"{record.studentId}_{record.date}"
    existing = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if existing:
        existing.status = record.status
        existing.updatedAt = datetime.datetime.utcnow()
    else:
        new_record = AttendanceRecord(
            id=record_id,
            studentId=record.studentId,
            date=record.date,
            classLevel=record.classLevel,
            status=record.status
        )
        db.add(new_record)
    db.commit()
    return {"message": "Attendance recorded successfully."}

@router.get("/attendance/{class_level}")
async def get_class_attendance(class_level: str, date: str | None = None, db: Session = Depends(get_db)):
    """
    Get attendance logs for a specific class.
    """
    query = db.query(AttendanceRecord).filter(AttendanceRecord.classLevel == class_level)
    if date:
        query = query.filter(AttendanceRecord.date == date)
    records = query.all()
    return [r.to_dict() for r in records]
