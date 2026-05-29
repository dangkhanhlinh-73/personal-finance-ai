from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class OcrResponse(BaseModel):
    ocr_id: int
    transaction_id: Optional[int] = None
    extracted_amount: Optional[Decimal] = None
    extracted_date: Optional[datetime] = None
    extracted_merchant: Optional[str] = None
    raw_text: Optional[str] = None
    confidence_score: Optional[Decimal] = None
    predicted_category_id: Optional[int] = None
    message: Optional[str] = None
