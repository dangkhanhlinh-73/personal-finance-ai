from fastapi import HTTPException, status
from sqlalchemy.orm import Session, aliased

from app.models.financial_account import FinancialAccount
from app.models.transfer import Transfer
from app.schemas.transfer_schema import TransferCreate


def get_transfers(db: Session, user_id: int):
    FromAccount = aliased(FinancialAccount)
    ToAccount = aliased(FinancialAccount)

    rows = (
        db.query(
            Transfer.transfer_id,
            Transfer.user_id,
            Transfer.from_account_id,
            Transfer.to_account_id,
            Transfer.amount,
            Transfer.transfer_date,
            Transfer.note,
            FromAccount.account_name.label("from_account_name"),
            ToAccount.account_name.label("to_account_name"),
        )
        .join(FromAccount, Transfer.from_account_id == FromAccount.account_id)
        .join(ToAccount, Transfer.to_account_id == ToAccount.account_id)
        .filter(Transfer.user_id == user_id)
        .order_by(Transfer.transfer_date.desc(), Transfer.transfer_id.desc())
        .all()
    )

    return [
        {
            "transfer_id": row.transfer_id,
            "user_id": row.user_id,
            "from_account_id": row.from_account_id,
            "to_account_id": row.to_account_id,
            "amount": row.amount,
            "transfer_date": row.transfer_date,
            "note": row.note,
            "from_account_name": row.from_account_name,
            "to_account_name": row.to_account_name,
        }
        for row in rows
    ]


def create_transfer(db: Session, user_id: int, data: TransferCreate):
    if data.from_account_id == data.to_account_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản nguồn và tài khoản nhận không được trùng nhau"
        )

    from_account = (
        db.query(FinancialAccount)
        .filter(
            FinancialAccount.account_id == data.from_account_id,
            FinancialAccount.user_id == user_id,
            FinancialAccount.is_archived == False
        )
        .first()
    )

    if not from_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản nguồn"
        )

    to_account = (
        db.query(FinancialAccount)
        .filter(
            FinancialAccount.account_id == data.to_account_id,
            FinancialAccount.user_id == user_id,
            FinancialAccount.is_archived == False
        )
        .first()
    )

    if not to_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản nhận"
        )

    if from_account.balance < data.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Số dư tài khoản nguồn không đủ để chuyển tiền"
        )

    from_account.balance = from_account.balance - data.amount
    to_account.balance = to_account.balance + data.amount

    transfer = Transfer(
        user_id=user_id,
        from_account_id=data.from_account_id,
        to_account_id=data.to_account_id,
        amount=data.amount,
        transfer_date=data.transfer_date,
        note=data.note,
    )

    db.add(transfer)
    db.commit()
    db.refresh(transfer)

    return {
        "transfer_id": transfer.transfer_id,
        "user_id": transfer.user_id,
        "from_account_id": transfer.from_account_id,
        "to_account_id": transfer.to_account_id,
        "amount": transfer.amount,
        "transfer_date": transfer.transfer_date,
        "note": transfer.note,
        "from_account_name": from_account.account_name,
        "to_account_name": to_account.account_name,
    }


def delete_transfer(db: Session, user_id: int, transfer_id: int):
    transfer = (
        db.query(Transfer)
        .filter(
            Transfer.transfer_id == transfer_id,
            Transfer.user_id == user_id
        )
        .first()
    )

    if not transfer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy giao dịch chuyển tiền"
        )

    from_account = (
        db.query(FinancialAccount)
        .filter(
            FinancialAccount.account_id == transfer.from_account_id,
            FinancialAccount.user_id == user_id
        )
        .first()
    )

    to_account = (
        db.query(FinancialAccount)
        .filter(
            FinancialAccount.account_id == transfer.to_account_id,
            FinancialAccount.user_id == user_id
        )
        .first()
    )

    if not from_account or not to_account:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể hoàn tác vì tài khoản liên quan không tồn tại"
        )

    if to_account.balance < transfer.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể xóa vì tài khoản nhận không đủ số dư để hoàn tác"
        )

    from_account.balance = from_account.balance + transfer.amount
    to_account.balance = to_account.balance - transfer.amount

    db.delete(transfer)
    db.commit()

    return {
        "status": "success",
        "message": "Đã xóa chuyển tiền và hoàn tác số dư"
    }