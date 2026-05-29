from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.debt_schema import (
    DebtCreate,
    DebtPaymentCreate,
    DebtPaymentResponse,
    DebtResponse,
)
from app.services.debt_service import (
    create_debt,
    create_debt_payment,
    delete_debt,
    delete_debt_payment,
    get_debt_payments,
    get_debts,
)
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/debts", tags=["Debts"])


# ── Debts ────────────────────────────────────────────────────────────────────


@router.get("/", response_model=list[DebtResponse])
def list_debts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_debts(db=db, user_id=current_user.user_id)


@router.post("/", response_model=DebtResponse)
def create_new_debt(
    data: DebtCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_debt(db=db, user_id=current_user.user_id, data=data)


@router.delete("/{debt_id}")
def remove_debt(
    debt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return delete_debt(db=db, user_id=current_user.user_id, debt_id=debt_id)


# ── Debt Payments ─────────────────────────────────────────────────────────────


@router.get("/{debt_id}/payments", response_model=list[DebtPaymentResponse])
def list_debt_payments(
    debt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_debt_payments(db=db, user_id=current_user.user_id, debt_id=debt_id)


@router.post("/{debt_id}/payments", response_model=DebtPaymentResponse)
def create_new_debt_payment(
    debt_id: int,
    data: DebtPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_debt_payment(
        db=db, user_id=current_user.user_id, debt_id=debt_id, data=data
    )


@router.delete("/{debt_id}/payments/{payment_id}")
def remove_debt_payment(
    debt_id: int,
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return delete_debt_payment(
        db=db,
        user_id=current_user.user_id,
        debt_id=debt_id,
        payment_id=payment_id,
    )
