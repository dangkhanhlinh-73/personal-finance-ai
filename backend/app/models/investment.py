from sqlalchemy import Column, BigInteger, DECIMAL, DateTime, Text, Enum, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from app.database import Base


class Investment(Base):
    __tablename__ = "investments"

    investment_id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(
        BigInteger,
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    investment_source_id = Column(
        BigInteger,
        ForeignKey("investment_source.source_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    account_id = Column(
        BigInteger,
        ForeignKey("financial_accounts.account_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    amount = Column(DECIMAL(18, 2), nullable=False)
    direction = Column(
        Enum("invest", "withdraw", name="investment_direction", create_type=False),
        nullable=False,
    )
    note = Column(Text, nullable=True)
    invested_at = Column(DateTime, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
