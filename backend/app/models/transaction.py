from sqlalchemy import Column, BigInteger, DECIMAL, DateTime, Integer, Text, String, Enum, ForeignKey, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    transaction_id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id"), nullable=False)
    account_id = Column(BigInteger, ForeignKey("financial_accounts.account_id"), nullable=False)
    category_id = Column(BigInteger, ForeignKey("categories.category_id"), nullable=False)

    amount = Column(DECIMAL(18, 2), nullable=False)
    transaction_type = Column(Enum("income", "expense", name="transaction_type", create_type=False), nullable=False)
    transaction_date = Column(DateTime, nullable=False)

    description = Column(Text)
    merchant_name = Column(String(150))
    source_type = Column(Enum("manual", "image", "ai", name="source_type", create_type=False), default="manual")
    status = Column(Enum("pending", "confirmed", "cancelled", name="transaction_status", create_type=False), default="confirmed")
    ocr_job_id = Column(BigInteger, ForeignKey("ocr_jobs.job_id", ondelete="SET NULL"), nullable=True)
    txn_index  = Column(Integer, nullable=True)

    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    account = relationship("FinancialAccount")
    category = relationship("Category")