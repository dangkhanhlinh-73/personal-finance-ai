from sqlalchemy import Column, BigInteger, String
from sqlalchemy import DECIMAL, Boolean, Enum
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP

from app.database import Base


class FinancialAccount(Base):
    __tablename__ = "financial_accounts"

    account_id = Column(BigInteger, primary_key=True, index=True)

    user_id = Column(BigInteger, nullable=False)

    account_name = Column(String(100), nullable=False)

    account_type = Column(
        Enum("cash", "bank", "ewallet", name="account_type", create_type=False),
        nullable=False
    )

    balance = Column(DECIMAL(18, 2), default=0)

    currency = Column(String(10), default="VND")

    is_default = Column(Boolean, default=False)

    is_archived = Column(Boolean, default=False)

    created_at = Column(
        TIMESTAMP,
        server_default=func.now()
    )

    updated_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        onupdate=func.now()
    )