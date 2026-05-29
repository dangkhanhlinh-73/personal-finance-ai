from sqlalchemy import Column, BigInteger, String, DECIMAL, Date, Text, Enum, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from app.database import Base


class Debt(Base):
    __tablename__ = "debts"

    debt_id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(
        BigInteger,
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    account_id = Column(
        BigInteger,
        ForeignKey("financial_accounts.account_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    debt_type = Column(
        Enum("borrow", "lend", name="debt_type", create_type=False),
        nullable=False,
    )
    partner_name = Column(String(150), nullable=False)
    total_amount = Column(DECIMAL(18, 2), nullable=False)
    remaining_amount = Column(DECIMAL(18, 2), nullable=False)
    interest_rate = Column(DECIMAL(5, 2), nullable=False, default=0)
    start_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)
    status = Column(
        Enum("active", "paid", "overdue", name="debt_status", create_type=False),
        nullable=False,
        default="active",
    )
    note = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
