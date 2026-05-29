from sqlalchemy import Column, BigInteger, String, Text, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.database import Base


class OcrJob(Base):
    __tablename__ = "ocr_jobs"

    job_id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(
        BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    scan_type = Column(String(20), nullable=False, default="bank_noti")   # bank_noti | invoice
    status = Column(String(20), nullable=False, default="pending")         # pending | processing | done | error
    image_path = Column(String(500))
    detected_format = Column(String(50))
    extracted_json = Column(JSONB)
    error_message = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    completed_at = Column(TIMESTAMP)
