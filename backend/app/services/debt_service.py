from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.debt import Debt
from app.models.debt_payment import DebtPayment
from app.models.financial_account import FinancialAccount
from app.schemas.debt_schema import DebtCreate, DebtPaymentCreate


# ── Debts ────────────────────────────────────────────────────────────────────


def get_debts(db: Session, user_id: int):
    rows = (
        db.query(
            Debt.debt_id,
            Debt.user_id,
            Debt.account_id,
            Debt.debt_type,
            Debt.partner_name,
            Debt.total_amount,
            Debt.remaining_amount,
            Debt.interest_rate,
            Debt.start_date,
            Debt.due_date,
            Debt.status,
            Debt.note,
            FinancialAccount.account_name,
        )
        .join(FinancialAccount, Debt.account_id == FinancialAccount.account_id)
        .filter(Debt.user_id == user_id)
        .order_by(Debt.created_at.desc(), Debt.debt_id.desc())
        .all()
    )

    return [
        {
            "debt_id": row.debt_id,
            "user_id": row.user_id,
            "account_id": row.account_id,
            "debt_type": row.debt_type,
            "partner_name": row.partner_name,
            "total_amount": row.total_amount,
            "remaining_amount": row.remaining_amount,
            "interest_rate": row.interest_rate,
            "start_date": row.start_date,
            "due_date": row.due_date,
            "status": row.status,
            "note": row.note,
            "account_name": row.account_name,
        }
        for row in rows
    ]


def create_debt(db: Session, user_id: int, data: DebtCreate):
    account = (
        db.query(FinancialAccount)
        .filter(
            FinancialAccount.account_id == data.account_id,
            FinancialAccount.user_id == user_id,
            FinancialAccount.is_archived == False,
        )
        .first()
    )

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản",
        )

    total_amount = Decimal(str(data.total_amount))

    # borrow → money comes IN to account; lend → money goes OUT of account
    if data.debt_type == "borrow":
        account.balance = account.balance + total_amount
    elif data.debt_type == "lend":
        if account.balance < total_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Số dư tài khoản không đủ để cho vay",
            )
        account.balance = account.balance - total_amount

    debt = Debt(
        user_id=user_id,
        account_id=data.account_id,
        debt_type=data.debt_type,
        partner_name=data.partner_name,
        total_amount=total_amount,
        remaining_amount=total_amount,
        interest_rate=data.interest_rate,
        start_date=data.start_date,
        due_date=data.due_date,
        status="active",
        note=data.note,
    )

    db.add(debt)
    db.commit()
    db.refresh(debt)

    return {
        "debt_id": debt.debt_id,
        "user_id": debt.user_id,
        "account_id": debt.account_id,
        "debt_type": debt.debt_type,
        "partner_name": debt.partner_name,
        "total_amount": debt.total_amount,
        "remaining_amount": debt.remaining_amount,
        "interest_rate": debt.interest_rate,
        "start_date": debt.start_date,
        "due_date": debt.due_date,
        "status": debt.status,
        "note": debt.note,
        "account_name": account.account_name,
    }


def delete_debt(db: Session, user_id: int, debt_id: int):
    debt = (
        db.query(Debt)
        .filter(Debt.debt_id == debt_id, Debt.user_id == user_id)
        .first()
    )

    if not debt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy khoản nợ",
        )

    account = (
        db.query(FinancialAccount)
        .filter(FinancialAccount.account_id == debt.account_id)
        .first()
    )

    if account:
        remaining = Decimal(str(debt.remaining_amount))
        # Reverse the original balance effect based on remaining amount
        if debt.debt_type == "borrow":
            # Originally account got +total_amount; but payments already reduced remaining
            # and each payment reduced balance by payment_amount.
            # So we reverse remaining (the unpaid portion that's still "in" the account conceptually)
            account.balance = account.balance - remaining
        elif debt.debt_type == "lend":
            # Originally account lost total_amount; remaining is still owed to us
            account.balance = account.balance + remaining

    db.delete(debt)
    db.commit()

    return {"status": "success", "message": "Đã xóa khoản nợ"}


# ── Debt Payments ────────────────────────────────────────────────────────────


def get_debt_payments(db: Session, user_id: int, debt_id: int):
    # Verify debt belongs to user
    debt = (
        db.query(Debt)
        .filter(Debt.debt_id == debt_id, Debt.user_id == user_id)
        .first()
    )

    if not debt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy khoản nợ",
        )

    rows = (
        db.query(
            DebtPayment.payment_id,
            DebtPayment.debt_id,
            DebtPayment.account_id,
            DebtPayment.payment_amount,
            DebtPayment.payment_date,
            DebtPayment.note,
            FinancialAccount.account_name,
        )
        .join(FinancialAccount, DebtPayment.account_id == FinancialAccount.account_id)
        .filter(DebtPayment.debt_id == debt_id)
        .order_by(DebtPayment.payment_date.desc(), DebtPayment.payment_id.desc())
        .all()
    )

    return [
        {
            "payment_id": row.payment_id,
            "debt_id": row.debt_id,
            "account_id": row.account_id,
            "payment_amount": row.payment_amount,
            "payment_date": row.payment_date,
            "note": row.note,
            "account_name": row.account_name,
        }
        for row in rows
    ]


def create_debt_payment(
    db: Session, user_id: int, debt_id: int, data: DebtPaymentCreate
):
    debt = (
        db.query(Debt)
        .filter(Debt.debt_id == debt_id, Debt.user_id == user_id)
        .first()
    )

    if not debt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy khoản nợ",
        )

    if debt.status == "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Khoản nợ này đã được thanh toán xong",
        )

    account = (
        db.query(FinancialAccount)
        .filter(
            FinancialAccount.account_id == data.account_id,
            FinancialAccount.user_id == user_id,
            FinancialAccount.is_archived == False,
        )
        .first()
    )

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản",
        )

    payment_amount = Decimal(str(data.payment_amount))
    remaining = Decimal(str(debt.remaining_amount))

    if payment_amount > remaining:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Số tiền thanh toán vượt quá số dư còn lại của khoản nợ",
        )

    # borrow: we owe money → payment reduces our account balance (we're paying back)
    # lend: others owe us → payment adds to our account balance (we're receiving back)
    if debt.debt_type == "borrow":
        if account.balance < payment_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Số dư tài khoản không đủ để thanh toán",
            )
        account.balance = account.balance - payment_amount
    elif debt.debt_type == "lend":
        account.balance = account.balance + payment_amount

    # Update debt remaining amount
    new_remaining = remaining - payment_amount
    debt.remaining_amount = new_remaining

    if new_remaining <= Decimal("0"):
        debt.status = "paid"

    payment = DebtPayment(
        debt_id=debt_id,
        account_id=data.account_id,
        payment_amount=payment_amount,
        payment_date=data.payment_date,
        note=data.note,
    )

    db.add(payment)
    db.commit()
    db.refresh(payment)

    return {
        "payment_id": payment.payment_id,
        "debt_id": payment.debt_id,
        "account_id": payment.account_id,
        "payment_amount": payment.payment_amount,
        "payment_date": payment.payment_date,
        "note": payment.note,
        "account_name": account.account_name,
    }


def delete_debt_payment(
    db: Session, user_id: int, debt_id: int, payment_id: int
):
    # Verify debt belongs to user
    debt = (
        db.query(Debt)
        .filter(Debt.debt_id == debt_id, Debt.user_id == user_id)
        .first()
    )

    if not debt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy khoản nợ",
        )

    payment = (
        db.query(DebtPayment)
        .filter(
            DebtPayment.payment_id == payment_id,
            DebtPayment.debt_id == debt_id,
        )
        .first()
    )

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy thanh toán",
        )

    account = (
        db.query(FinancialAccount)
        .filter(FinancialAccount.account_id == payment.account_id)
        .first()
    )

    payment_amount = Decimal(str(payment.payment_amount))
    was_paid = debt.status == "paid"

    # Reverse balance change
    if account:
        if debt.debt_type == "borrow":
            # Payment originally reduced account → restore it
            account.balance = account.balance + payment_amount
        elif debt.debt_type == "lend":
            # Payment originally increased account → reduce it
            if account.balance < payment_amount:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Tài khoản không đủ số dư để hoàn tác thanh toán",
                )
            account.balance = account.balance - payment_amount

    # Restore remaining amount
    debt.remaining_amount = Decimal(str(debt.remaining_amount)) + payment_amount

    # Restore status if debt was paid
    if was_paid:
        debt.status = "active"

    db.delete(payment)
    db.commit()

    return {"status": "success", "message": "Đã xóa thanh toán và hoàn tác số dư"}
