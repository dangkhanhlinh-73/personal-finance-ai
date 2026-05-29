from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class InvestmentSourceCreate(BaseModel):
    source_name: str
    initial_balance: Decimal = Decimal("0")
    interest_rate: Decimal = Decimal("0")


class InvestmentSourceUpdate(BaseModel):
    source_name: str | None = None
    interest_rate: Decimal | None = None


class InvestmentSourceResponse(BaseModel):
    source_id: int
    user_id: int
    source_name: str
    initial_balance: Decimal
    current_balance: Decimal
    interest_rate: Decimal
    value_with_interest: Decimal
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InvestmentCreate(BaseModel):
    investment_source_id: int
    account_id: int
    amount: Decimal = Field(..., gt=0)
    direction: Literal["invest", "withdraw"]
    note: str | None = None
    invested_at: datetime


class InvestmentResponse(BaseModel):
    investment_id: int
    user_id: int
    investment_source_id: int
    account_id: int
    amount: Decimal
    direction: str
    note: str | None = None
    invested_at: datetime
    source_name: str | None = None
    account_name: str | None = None

    class Config:
        from_attributes = True
