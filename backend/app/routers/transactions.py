from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal

from app.database import get_db
from app.models import Transaction

router = APIRouter(prefix="/transactions", tags=["Transactions"])


class TransactionCreate(BaseModel):
    user_id: int = 1
    account_id: int
    category_id: int | None = None
    amount: Decimal
    transaction_type: str
    transaction_date: datetime
    description: str | None = None
    merchant_name: str | None = None
    source_type: str = "manual"
    status: str = "confirmed"


@router.get("/")
def get_transactions(db: Session = Depends(get_db)):
    return db.query(Transaction).order_by(Transaction.transaction_date.desc()).all()


@router.post("/")
def create_transaction(data: TransactionCreate, db: Session = Depends(get_db)):
    transaction = Transaction(
        user_id=data.user_id,
        account_id=data.account_id,
        category_id=data.category_id,
        amount=data.amount,
        transaction_type=data.transaction_type,
        transaction_date=data.transaction_date,
        description=data.description,
        merchant_name=data.merchant_name,
        source_type=data.source_type,
        status=data.status,
    )

    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    return transaction


@router.put("/{transaction_id}")
def update_transaction(
    transaction_id: int,
    data: TransactionCreate,
    db: Session = Depends(get_db),
):
    transaction = db.query(Transaction).filter(
        Transaction.transaction_id == transaction_id
    ).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Không tìm thấy giao dịch")

    transaction.user_id = data.user_id
    transaction.account_id = data.account_id
    transaction.category_id = data.category_id
    transaction.amount = data.amount
    transaction.transaction_type = data.transaction_type
    transaction.transaction_date = data.transaction_date
    transaction.description = data.description
    transaction.merchant_name = data.merchant_name
    transaction.source_type = data.source_type
    transaction.status = data.status

    db.commit()
    db.refresh(transaction)

    return transaction


@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    transaction = db.query(Transaction).filter(
        Transaction.transaction_id == transaction_id
    ).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Không tìm thấy giao dịch")

    db.delete(transaction)
    db.commit()

    return {"message": "Xóa giao dịch thành công"}