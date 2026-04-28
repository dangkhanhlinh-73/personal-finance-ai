from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date, datetime
from decimal import Decimal

from app.database import get_db
from app.models import Debt, DebtPayment


router = APIRouter(prefix="/debts", tags=["Debts"])


class DebtCreate(BaseModel):
    user_id: int = 1
    account_id: int
    debt_type: str
    partner_name: str
    total_amount: Decimal
    remaining_amount: Decimal
    interest_rate: Decimal = 0
    start_date: date | None = None
    due_date: date | None = None
    status: str = "ongoing"
    note: str | None = None


class DebtPaymentCreate(BaseModel):
    account_id: int
    payment_amount: Decimal
    note: str | None = None


@router.get("/")
def get_debts(db: Session = Depends(get_db)):
    return db.query(Debt).all()


@router.post("/")
def create_debt(data: DebtCreate, db: Session = Depends(get_db)):
    new_debt = Debt(
        user_id=data.user_id,
        account_id=data.account_id,
        debt_type=data.debt_type,
        partner_name=data.partner_name,
        total_amount=data.total_amount,
        remaining_amount=data.remaining_amount,
        interest_rate=data.interest_rate,
        start_date=data.start_date,
        due_date=data.due_date,
        status=data.status,
        note=data.note,
    )

    db.add(new_debt)
    db.commit()
    db.refresh(new_debt)

    return new_debt


@router.put("/{debt_id}")
def update_debt(debt_id: int, data: DebtCreate, db: Session = Depends(get_db)):
    debt = db.query(Debt).filter(Debt.debt_id == debt_id).first()

    if not debt:
        raise HTTPException(status_code=404, detail="Không tìm thấy khoản nợ")

    debt.user_id = data.user_id
    debt.account_id = data.account_id
    debt.debt_type = data.debt_type
    debt.partner_name = data.partner_name
    debt.total_amount = data.total_amount
    debt.remaining_amount = data.remaining_amount
    debt.interest_rate = data.interest_rate
    debt.start_date = data.start_date
    debt.due_date = data.due_date
    debt.status = data.status
    debt.note = data.note

    db.commit()
    db.refresh(debt)

    return debt


@router.post("/{debt_id}/payment")
def pay_debt(debt_id: int, data: DebtPaymentCreate, db: Session = Depends(get_db)):
    debt = db.query(Debt).filter(Debt.debt_id == debt_id).first()

    if not debt:
        raise HTTPException(status_code=404, detail="Không tìm thấy khoản nợ")

    if data.payment_amount <= 0:
        raise HTTPException(status_code=400, detail="Số tiền thanh toán phải lớn hơn 0")

    if data.payment_amount > debt.remaining_amount:
        raise HTTPException(
            status_code=400,
            detail="Số tiền thanh toán lớn hơn số tiền còn lại",
        )

    payment = DebtPayment(
        debt_id=debt_id,
        account_id=data.account_id,
        payment_amount=data.payment_amount,
        payment_date=datetime.now(),
        note=data.note,
    )

    debt.remaining_amount = debt.remaining_amount - data.payment_amount

    if debt.remaining_amount == 0:
        debt.status = "paid"

    db.add(payment)
    db.commit()
    db.refresh(debt)

    return {
        "message": "Thanh toán nợ thành công",
        "debt": debt,
    }


@router.delete("/{debt_id}")
def delete_debt(debt_id: int, db: Session = Depends(get_db)):
    debt = db.query(Debt).filter(Debt.debt_id == debt_id).first()

    if not debt:
        raise HTTPException(status_code=404, detail="Không tìm thấy khoản nợ")

    db.delete(debt)
    db.commit()

    return {"message": "Xóa khoản nợ thành công"}