from sqlalchemy.orm import Session
from backend.models import Pupil, BookItem, Order, AppNotification, ContactSubmission

INITIAL_PUPILS = [
    {
        "id": "std1",
        "surname": "Okon",
        "firstName": "Daniel",
        "regNo": "NS/2026/001",
        "classLevel": "Primary 1",
        "parentName": "Mrs. Okon",
        "parentPhone": "+234 802 123 4567",
        "parentEmail": "okon.parent@example.com"
    },
    {
        "id": "std2",
        "surname": "Adeyemi",
        "firstName": "Sophia",
        "regNo": "NS/2026/002",
        "classLevel": "Primary 1",
        "parentName": "Engr. Adeyemi",
        "parentPhone": "+234 803 987 6543",
        "parentEmail": "adeyemi.parent@example.com"
    },
    {
        "id": "std3",
        "surname": "Chukwu",
        "firstName": "Michael",
        "regNo": "NS/2026/003",
        "classLevel": "Primary 2",
        "parentName": "Chief Chukwu",
        "parentPhone": "+234 809 555 1212",
        "parentEmail": "chukwu.parent@example.com"
    },
    {
        "id": "std4",
        "surname": "Smith",
        "firstName": "Preston",
        "regNo": "NS/2026/004",
        "classLevel": "Prep 2",
        "parentName": "Olivia Smith",
        "parentPhone": "+44 7911 123456",
        "parentEmail": "smith.parent@example.com"
    },
    {
        "id": "std5",
        "surname": "Musa",
        "firstName": "Ibrahim",
        "regNo": "NS/2026/005",
        "classLevel": "Primary 6",
        "parentName": "Dr. Musa",
        "parentPhone": "+234 905 777 8888",
        "parentEmail": "musa.parent@example.com"
    }
]

INITIAL_BOOKS = [
    {"id": "pn-bk1", "title": "First Words Picture Dictionary", "author": "Nazareth Academic Press", "price": 15.0, "classLevel": "Pre-Nursery", "category": "Textbook", "stock": 45, "description": "Visual associations dictionary for pre-nursery."},
    {"id": "pn-bk2", "title": "Fun with Finger Painting", "author": "Nazareth Art Dept", "price": 8.5, "classLevel": "Pre-Nursery", "category": "Stationery", "stock": 60, "description": "Trace-free non-toxic coloring sheets."},
    {"id": "kg-bk1", "title": "Active Math Basics for KG", "author": "Dr. Evelyn Thomas", "price": 18.5, "classLevel": "Kindergarten", "category": "Textbook", "stock": 50, "description": "Interactive mathematics and counting blocks."},
    {"id": "kg-bk2", "title": "Phonics Journey Stage 1", "author": "Clara Jenkins", "price": 16.0, "classLevel": "Kindergarten", "category": "Textbook", "stock": 40, "description": "Phonics sounds and blend vowels."},
    {"id": "p1-bk1", "title": "Beginning English Reader (Prep 1)", "author": "M. S. Alabi", "price": 20.0, "classLevel": "Prep 1", "category": "Textbook", "stock": 35, "description": "Stories with short sentences."},
    {"id": "p2-bk1", "title": "Write-In Cursive Guide (Prep 2)", "author": "Grace Okoye", "price": 12.0, "classLevel": "Prep 2", "category": "Notebook", "stock": 55, "description": "Cursive strokes guide."},
    {"id": "pri1-bk1", "title": "Primary Mathematics Book 1", "author": "Dr. A. O. Bello", "price": 25.5, "classLevel": "Primary 1", "category": "Textbook", "stock": 40, "description": "Foundational primary arithmetic."},
    {"id": "pri1-bk2", "title": "Nazareth Custom Drawing Book (P1)", "author": "Nazareth Press", "price": 6.0, "classLevel": "Primary 1", "category": "Stationery", "stock": 80, "description": "Heavy cartridge sketch pad."},
    {"id": "pri2-bk1", "title": "Junior Science Explorer 2", "author": "Prof. T. Hanson", "price": 22.0, "classLevel": "Primary 2", "category": "Textbook", "stock": 30, "description": "Living things and earth sciences."},
    {"id": "pri3-bk1", "title": "Social Studies for Young Citizens 3", "author": "F. A. Williams", "price": 24.0, "classLevel": "Primary 3", "category": "Textbook", "stock": 35, "description": "Community and cultural heritage."},
    {"id": "pri4-bk1", "title": "Advanced Primary English 4", "author": "E. N. Eze", "price": 28.0, "classLevel": "Primary 4", "category": "Textbook", "stock": 25, "description": "Comprehension passages and grammar."},
    {"id": "pri5-bk1", "title": "Mathematics Mastery Standard 5", "author": "Dr. A. O. Bello", "price": 30.0, "classLevel": "Primary 5", "category": "Textbook", "stock": 20, "description": "Fractions, decimals, geometry."},
    {"id": "pri6-bk1", "title": "National Common Entrance Prep 6", "author": "Academic Board", "price": 35.0, "classLevel": "Primary 6", "category": "Textbook", "stock": 45, "description": "Mock exams and revision questions."},
    {"id": "uni-01", "title": "Nazareth School Uniform Set (Boys)", "author": "Nazareth Tailoring", "price": 45.0, "classLevel": "All Classes", "category": "Uniform", "stock": 100, "description": "Custom crest blazer, tailored shorts, and collared shirt.", "uniformSize": "Size 8 (Ages 6-8)"},
    {"id": "uni-02", "title": "Nazareth School Uniform Set (Girls)", "author": "Nazareth Tailoring", "price": 45.0, "classLevel": "All Classes", "category": "Uniform", "stock": 100, "description": "Custom crest pinafore dress with branded trim.", "uniformSize": "Size 8 (Ages 6-8)"}
]

INITIAL_NOTIFICATIONS = [
    {
        "id": "not1",
        "title": "Term 1 School Store Portal Active",
        "message": "Welcome to the new digital ledger system. Parents can purchase materials directly.",
        "type": "info",
        "timestamp": "2026-09-01T08:00:00Z",
        "read": False,
        "role": "all",
        "recipientId": "all"
    },
    {
        "id": "not2",
        "title": "Welcome to Nazareth School Portal",
        "message": "Your profile has been registered in the student academic registry.",
        "type": "success",
        "timestamp": "2026-09-02T10:00:00Z",
        "read": False,
        "role": "pupil",
        "recipientId": "all"
    }
]

def seed_database_if_empty(db: Session):
    """
    Seeds initial catalog and pupil records if tables are empty.
    """
    try:
        # 1. Books
        if db.query(BookItem).count() == 0:
            print(f"[Seed] Seeding database with {len(INITIAL_BOOKS)} initial store catalog items...")
            for b in INITIAL_BOOKS:
                db.add(BookItem(**b))
            db.commit()

        # 2. Pupils
        if db.query(Pupil).count() == 0:
            print(f"[Seed] Seeding database with {len(INITIAL_PUPILS)} initial sample pupils...")
            for p in INITIAL_PUPILS:
                db.add(Pupil(**p))
            db.commit()

        # 3. Notifications
        if db.query(AppNotification).count() == 0:
            for n in INITIAL_NOTIFICATIONS:
                db.add(AppNotification(**n))
            db.commit()

        print("[Seed] Database initial verification complete.")
    except Exception as e:
        db.rollback()
        print(f"[Seed] Warning during initial seeding: {e}")
