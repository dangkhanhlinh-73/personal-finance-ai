from sqlalchemy import Column, BigInteger, DECIMAL, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP

from app.database import Base


class Transfer(Base):
    __tablename__ = "transfers"

    transfer_id = Column(BigInteger, primary_key=True, index=True)

    user_id = Column(
        BigInteger,
        ForeignKey("users.user_id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True
    )

    from_account_id = Column(
        BigInteger,
        ForeignKey("financial_accounts.account_id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
        index=True
    )

    to_account_id = Column(
        BigInteger,
        ForeignKey("financial_accounts.account_id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
        index=True
    )

    amount = Column(DECIMAL(18, 2), nullable=False)

    transfer_date = Column(DateTime, nullable=False)

    note = Column(Text, nullable=True)

    created_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        nullable=False
    )

    updated_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )