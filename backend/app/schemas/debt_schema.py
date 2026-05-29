from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class DebtCreate(BaseModel):
    account_id: int
    debt_type: Literal["borrow", "lend"]
    partner_name: str
    total_amount: Decimal = Field(..., gt=0)
    interest_rate: Decimal = Decimal("0")
    start_date: date
    due_date: date | None = None
    note: str | None = None


class DebtResponse(BaseModel):
    debt_id: int
    user_id: int
    account_id: int
    debt_type: str
    partner_name: str
    total_amount: Decimal
    remaining_amount: Decimal
    interest_rate: Decimal
    start_date: date
    due_date: date | None = None
    status: str
    note: str | None = None
    account_name: str | None = None

    class Config:
        from_attributes = True


class DebtPaymentCreate(BaseModel):
    account_id: int
    payment_amount: Decimal = Field(..., gt=0)
    payment_date: date
    note: str | None = None


class DebtPaymentResponse(BaseModel):
    payment_id: int
    debt_id: int
    account_id: int
    payment_amount: Decimal
    payment_date: date
    note: str | None = None
    account_name: str | None = None

    class Config:
        from_attributes = True
