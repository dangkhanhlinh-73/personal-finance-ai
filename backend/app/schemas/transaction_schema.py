from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    account_id: int
    category_id: int
    amount: Decimal = Field(..., gt=0)
    transaction_type: Literal["income", "expense"]
    transaction_date: datetime
    description: str | None = None
    merchant_name: str | None = None
    # OCR context — used to link transaction back to its source job and log AI decisions
    ocr_job_id: int | None = None
    txn_index: int | None = None
    ai_predicted_category: str | None = None
    ai_confidence: float | None = None


class TransactionBatchCreate(BaseModel):
    items: list[TransactionCreate]


class TransactionUpdate(BaseModel):
    account_id: int
    category_id: int
    amount: Decimal = Field(..., gt=0)
    transaction_type: Literal["income", "expense"]
    transaction_date: datetime
    description: str | None = None
    merchant_name: str | None = None


class TransactionResponse(BaseModel):
    transaction_id: int
    user_id: int
    account_id: int
    category_id: int
    amount: Decimal
    transaction_type: str
    transaction_date: datetime
    created_at: datetime | None = None
    description: str | None = None
    merchant_name: str | None = None
    source_type: str
    status: str
    ocr_job_id: int | None = None
    account_name: str | None = None
    category_name: str | None = None
    group_name: str | None = None
    group_type: str | None = None

    class Config:
        from_attributes = True


class CategoryResponse(BaseModel):
    category_id: int
    category_name: str
    group_id: int
    group_name: str
    group_type: str
