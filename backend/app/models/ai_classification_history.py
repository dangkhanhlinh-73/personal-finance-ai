from sqlalchemy import Column, BigInteger, Integer, String, DECIMAL, Boolean, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from app.database import Base


class AiClassificationHistory(Base):
    __tablename__ = "ai_classification_history"

    history_id   = Column(BigInteger, primary_key=True, autoincrement=True)

    # Which OCR job triggered this classification
    ocr_job_id   = Column(BigInteger, ForeignKey("ocr_jobs.job_id", ondelete="SET NULL"), nullable=True, index=True)

    # The transaction that was ultimately saved (null until user confirms)
    transaction_id = Column(BigInteger, ForeignKey("transactions.transaction_id", ondelete="CASCADE"), nullable=True, index=True)

    # Position of this transaction inside the job's extracted_json.transactions list
    txn_index    = Column(Integer, nullable=False, default=0)

    # What the model predicted
    predicted_category_name = Column(String(150), nullable=True)
    predicted_confidence    = Column(DECIMAL(5, 4), nullable=True)

    # What the user actually chose when saving
    chosen_category_id = Column(BigInteger, ForeignKey("categories.category_id", ondelete="SET NULL"), nullable=True)

    # True when the user kept the AI suggestion unchanged
    was_accepted = Column(Boolean, nullable=True)

    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
