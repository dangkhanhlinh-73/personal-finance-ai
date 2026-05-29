from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class OcrJobResponse(BaseModel):
    job_id: int
    user_id: int
    scan_type: str
    status: str
    detected_format: Optional[str] = None
    extracted_json: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    saved_count: int = 0

    class Config:
        from_attributes = True
