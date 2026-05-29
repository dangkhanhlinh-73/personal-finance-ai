from sqlalchemy import Column, BigInteger, String, DECIMAL, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from app.database import Base


class InvestmentSource(Base):
    __tablename__ = "investment_source"

    source_id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(
        BigInteger,
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_name = Column(String(150), nullable=False)
    initial_balance = Column(DECIMAL(18, 2), nullable=False, default=0)
    current_balance = Column(DECIMAL(18, 2), nullable=False, default=0)
    interest_rate = Column(DECIMAL(5, 2), nullable=False, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
