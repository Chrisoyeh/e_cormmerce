import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, Text, DateTime, JSON, Index
from backend.database import Base

class Pupil(Base):
    __tablename__ = "pupils"

    id = Column(String(64), primary_key=True, index=True)
    surname = Column(String(128), nullable=False, index=True)
    firstName = Column(String(128), nullable=False, index=True)
    regNo = Column(String(64), nullable=False, unique=True, index=True)
    classLevel = Column(String(64), nullable=False, index=True)
    parentName = Column(String(128), default="Guardian")
    parentPhone = Column(String(64), default="+23400000000")
    parentEmail = Column(String(128), default="parent@example.com")
    linkedParentUid = Column(String(64), nullable=True, index=True)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (
        Index("ix_pupil_search", "surname", "firstName", "classLevel"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "surname": self.surname,
            "firstName": self.firstName,
            "regNo": self.regNo,
            "classLevel": self.classLevel,
            "parentName": self.parentName or "Guardian",
            "parentPhone": self.parentPhone or "+23400000000",
            "parentEmail": self.parentEmail or "parent@example.com",
            "linkedParentUid": self.linkedParentUid
        }


class BookItem(Base):
    __tablename__ = "books"

    id = Column(String(64), primary_key=True, index=True)
    title = Column(String(256), nullable=False, index=True)
    author = Column(String(128), default="Nazareth Press")
    price = Column(Float, nullable=False)
    classLevel = Column(String(64), nullable=False, index=True)
    category = Column(String(64), nullable=False, index=True)  # 'Textbook', 'Notebook', 'Stationery', 'Uniform', 'Utility'
    stock = Column(Integer, default=0)
    imageUrl = Column(Text, nullable=True)
    description = Column(Text, default="")
    shoeSize = Column(String(32), nullable=True)
    uniformSize = Column(String(32), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "author": self.author,
            "price": self.price,
            "classLevel": self.classLevel,
            "category": self.category,
            "stock": self.stock,
            "imageUrl": self.imageUrl,
            "description": self.description,
            "shoeSize": self.shoeSize,
            "uniformSize": self.uniformSize
        }


class Order(Base):
    __tablename__ = "orders"

    id = Column(String(64), primary_key=True, index=True)
    pupilId = Column(String(64), nullable=False, index=True)
    pupilName = Column(String(128), nullable=False)
    pupilRegNo = Column(String(64), nullable=False, index=True)
    classLevel = Column(String(64), nullable=False, index=True)
    items = Column(JSON, default=list)  # list of CartItem objects
    totalAmount = Column(Float, nullable=False)
    amountPaid = Column(Float, nullable=True)
    status = Column(String(64), default="Pending Approved", index=True)
    date = Column(String(64), default=lambda: datetime.datetime.utcnow().isoformat() + "Z", index=True)
    invoiceNo = Column(String(64), nullable=False, index=True)
    paymentMethod = Column(String(32), default="desk")
    paymentReceiptUrl = Column(Text, nullable=True)
    balanceReceiptUrl = Column(Text, nullable=True)
    paymentVerificationStatus = Column(String(64), default="Pending Audit")
    submittedToLedger = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "pupilId": self.pupilId,
            "pupilName": self.pupilName,
            "pupilRegNo": self.pupilRegNo,
            "classLevel": self.classLevel,
            "items": self.items or [],
            "totalAmount": self.totalAmount,
            "amountPaid": self.amountPaid,
            "status": self.status,
            "date": self.date,
            "invoiceNo": self.invoiceNo,
            "paymentMethod": self.paymentMethod,
            "paymentReceiptUrl": self.paymentReceiptUrl,
            "balanceReceiptUrl": self.balanceReceiptUrl,
            "paymentVerificationStatus": self.paymentVerificationStatus,
            "submittedToLedger": self.submittedToLedger,
            "notes": self.notes
        }


class AppNotification(Base):
    __tablename__ = "notifications"

    id = Column(String(64), primary_key=True, index=True)
    title = Column(String(256), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(32), default="info")  # 'info', 'success', 'warning', 'danger'
    timestamp = Column(String(64), default=lambda: datetime.datetime.utcnow().isoformat() + "Z", index=True)
    read = Column(Boolean, default=False)
    role = Column(String(32), default="admin", index=True)  # 'admin', 'pupil', 'parent', 'all'
    recipientId = Column(String(64), default="all", index=True)
    link = Column(String(256), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "message": self.message,
            "type": self.type,
            "timestamp": self.timestamp,
            "read": self.read,
            "role": self.role,
            "recipientId": self.recipientId,
            "link": self.link
        }


class ContactSubmission(Base):
    __tablename__ = "contacts"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    email = Column(String(128), nullable=False)
    phone = Column(String(64), default="")
    message = Column(Text, nullable=False)
    timestamp = Column(String(64), default=lambda: datetime.datetime.utcnow().isoformat() + "Z", index=True)
    status = Column(String(32), default="Pending")  # 'Pending', 'Read', 'Resolved'

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "message": self.message,
            "timestamp": self.timestamp,
            "status": self.status
        }


class AttendanceRecord(Base):
    __tablename__ = "attendance"

    id = Column(String(128), primary_key=True, index=True)
    studentId = Column(String(64), nullable=False, index=True)
    date = Column(String(32), nullable=False, index=True)
    classLevel = Column(String(64), nullable=False, index=True)
    status = Column(String(32), default="Present")  # 'Present', 'Absent', 'Late'
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "studentId": self.studentId,
            "date": self.date,
            "classLevel": self.classLevel,
            "status": self.status,
            "updatedAt": self.updatedAt.isoformat() if self.updatedAt else None
        }
