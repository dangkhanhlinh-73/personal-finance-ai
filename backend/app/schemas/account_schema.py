from decimal import Decimal
from pydantic import BaseModel, Field


class AccountCreate(BaseModel):
    account_name: str = Field(..., min_length=2, max_length=100)
    account_type: str
    balance: Decimal = 0
    currency: str = "VND"
    is_default: bool = False


class AccountResponse(BaseModel):
    account_id: int
    user_id: int
    account_name: str
    account_type: str
    balance: Decimal
    currency: str
    is_default: bool
    is_archived: bool

    class Config:
        from_attributes = True