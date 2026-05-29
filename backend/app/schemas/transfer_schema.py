from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class TransferCreate(BaseModel):
    from_account_id: int
    to_account_id: int
    amount: Decimal = Field(..., gt=0)
    transfer_date: datetime
    note: str | None = None


class TransferResponse(BaseModel):
    transfer_id: int
    user_id: int
    from_account_id: int
    to_account_id: int
    amount: Decimal
    transfer_date: datetime
    note: str | None = None
    from_account_name: str | None = None
    to_account_name: str | None = None

    class Config:
        from_attributes = True