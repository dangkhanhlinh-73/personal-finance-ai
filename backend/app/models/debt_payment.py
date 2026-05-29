from sqlalchemy import Column, BigInteger, DECIMAL, DateTime, Text, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from app.database import Base


class DebtPayment(Base):
    __tablename__ = "debt_payment"

    payment_id = Column(BigInteger, primary_key=True, autoincrement=True)
    debt_id = Column(
        BigInteger,
        ForeignKey("debts.debt_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    account_id = Column(
        BigInteger,
        ForeignKey("financial_accounts.account_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    payment_amount = Column(DECIMAL(18, 2), nullable=False)
    payment_date = Column(DateTime, nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
