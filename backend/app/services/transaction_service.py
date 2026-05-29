from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.ai_classification_history import AiClassificationHistory
from app.models.category import Category, CategoryGroup
from app.models.financial_account import FinancialAccount
from app.models.transaction import Transaction
from app.schemas.transaction_schema import TransactionCreate, TransactionUpdate


def get_transactions(
    db: Session,
    user_id: int,
    keyword: str = "",
    transaction_type: str = "",
    category_id: int = 0,
):
    query = (
        db.query(
            Transaction.transaction_id,
            Transaction.user_id,
            Transaction.account_id,
            Transaction.category_id,
            Transaction.amount,
            Transaction.transaction_type,
            Transaction.transaction_date,
            Transaction.created_at,
            Transaction.description,
            Transaction.merchant_name,
            Transaction.source_type,
            Transaction.status,
            Transaction.ocr_job_id,
            FinancialAccount.account_name,
            Category.category_name,
            CategoryGroup.group_name,
            CategoryGroup.group_type,
        )
        .join(FinancialAccount, Transaction.account_id == FinancialAccount.account_id)
        .join(Category, Transaction.category_id == Category.category_id)
        .join(CategoryGroup, Category.group_id == CategoryGroup.group_id)
        .filter(Transaction.user_id == user_id)
    )

    if keyword:
        search = f"%{keyword}%"
        query = query.filter(
            (Transaction.description.like(search))
            | (Transaction.merchant_name.like(search))
            | (Category.category_name.like(search))
            | (FinancialAccount.account_name.like(search))
        )

    if transaction_type:
        query = query.filter(Transaction.transaction_type == transaction_type)

    if category_id > 0:
        query = query.filter(Transaction.category_id == category_id)

    rows = (
        query
        .order_by(Transaction.created_at.desc(), Transaction.transaction_id.desc())
        .all()
    )

    return [
        {
            "transaction_id": row.transaction_id,
            "user_id": row.user_id,
            "account_id": row.account_id,
            "category_id": row.category_id,
            "amount": row.amount,
            "transaction_type": row.transaction_type,
            "transaction_date": row.transaction_date,
            "created_at": row.created_at,
            "description": row.description,
            "merchant_name": row.merchant_name,
            "source_type": row.source_type,
            "status": row.status,
            "ocr_job_id": row.ocr_job_id,
            "account_name": row.account_name,
            "category_name": row.category_name,
            "group_name": row.group_name,
            "group_type": row.group_type,
        }
        for row in rows
    ]


def _enrich(db: Session, transaction: Transaction) -> dict:
    """Trả về dict transaction với account_name, category_name, group info."""
    account = db.query(FinancialAccount).filter(
        FinancialAccount.account_id == transaction.account_id
    ).first()
    row = (
        db.query(Category.category_name, CategoryGroup.group_name, CategoryGroup.group_type)
        .join(CategoryGroup, Category.group_id == CategoryGroup.group_id)
        .filter(Category.category_id == transaction.category_id)
        .first()
    )
    return {
        "transaction_id": transaction.transaction_id,
        "user_id": transaction.user_id,
        "account_id": transaction.account_id,
        "category_id": transaction.category_id,
        "amount": transaction.amount,
        "transaction_type": transaction.transaction_type,
        "transaction_date": transaction.transaction_date,
        "description": transaction.description,
        "merchant_name": transaction.merchant_name,
        "source_type": transaction.source_type,
        "status": transaction.status,
        "ocr_job_id": transaction.ocr_job_id,
        "account_name": account.account_name if account else None,
        "category_name": row.category_name if row else None,
        "group_name": row.group_name if row else None,
        "group_type": row.group_type if row else None,
    }


def create_transaction(
    db: Session,
    user_id: int,
    data: TransactionCreate,
    source_type: str = "manual",
):
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

    category = (
        db.query(Category)
        .join(CategoryGroup, Category.group_id == CategoryGroup.group_id)
        .filter(
            Category.category_id == data.category_id,
            (Category.user_id == None) | (Category.user_id == user_id),
        )
        .first()
    )

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy danh mục",
        )

    amount = Decimal(str(data.amount))

    # Determine status based on source_type
    if source_type == "manual":
        tx_status = "confirmed"
    else:
        tx_status = "pending"

    transaction = Transaction(
        user_id=user_id,
        account_id=data.account_id,
        category_id=data.category_id,
        amount=amount,
        transaction_type=data.transaction_type,
        transaction_date=data.transaction_date,
        description=data.description,
        merchant_name=data.merchant_name,
        source_type=source_type,
        status=tx_status,
        ocr_job_id=getattr(data, "ocr_job_id", None),
        txn_index=getattr(data, "txn_index", None),
    )

    # Only update balance for confirmed (manual) transactions
    if tx_status == "confirmed":
        if data.transaction_type == "income":
            account.balance = account.balance + amount
        elif data.transaction_type == "expense":
            if account.balance < amount:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Số dư tài khoản không đủ",
                )
            account.balance = account.balance - amount

    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    # Log AI classification decision when saved from OCR review
    ai_cat = getattr(data, "ai_predicted_category", None)
    if getattr(data, "ocr_job_id", None) and ai_cat:
        try:
            was_accepted = (
                db.query(Category.category_name)
                .filter(Category.category_id == data.category_id)
                .scalar() == ai_cat
            ) if ai_cat else None
            db.add(AiClassificationHistory(
                ocr_job_id=data.ocr_job_id,
                transaction_id=transaction.transaction_id,
                txn_index=getattr(data, "txn_index", 0) or 0,
                predicted_category_name=ai_cat,
                predicted_confidence=getattr(data, "ai_confidence", None),
                chosen_category_id=data.category_id,
                was_accepted=was_accepted,
            ))
            db.commit()
        except Exception:
            db.rollback()

    return _enrich(db, transaction)


def create_transactions_batch(
    db: Session,
    user_id: int,
    items: list,
    source_type: str = "image",
) -> list:
    results = []
    for item in items:
        results.append(create_transaction(db, user_id, item, source_type=source_type))
    return results


def confirm_transaction(db: Session, user_id: int, transaction_id: int):
    transaction = (
        db.query(Transaction)
        .filter(
            Transaction.transaction_id == transaction_id,
            Transaction.user_id == user_id,
        )
        .first()
    )

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy giao dịch",
        )

    if transaction.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ có thể xác nhận giao dịch đang ở trạng thái chờ xử lý",
        )

    account = (
        db.query(FinancialAccount)
        .filter(
            FinancialAccount.account_id == transaction.account_id,
            FinancialAccount.user_id == user_id,
        )
        .first()
    )

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản liên kết",
        )

    amount = Decimal(str(transaction.amount))

    if transaction.transaction_type == "income":
        account.balance = account.balance + amount
    elif transaction.transaction_type == "expense":
        if account.balance < amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Số dư tài khoản không đủ để xác nhận giao dịch",
            )
        account.balance = account.balance - amount

    transaction.status = "confirmed"
    db.commit()
    db.refresh(transaction)

    return _enrich(db, transaction)


def cancel_transaction(db: Session, user_id: int, transaction_id: int):
    transaction = (
        db.query(Transaction)
        .filter(
            Transaction.transaction_id == transaction_id,
            Transaction.user_id == user_id,
        )
        .first()
    )

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy giao dịch",
        )

    if transaction.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ có thể hủy giao dịch đang ở trạng thái chờ xử lý",
        )

    transaction.status = "cancelled"
    db.commit()
    db.refresh(transaction)

    return _enrich(db, transaction)


def update_transaction(
    db: Session, user_id: int, transaction_id: int, data: TransactionUpdate
):
    transaction = (
        db.query(Transaction)
        .filter(
            Transaction.transaction_id == transaction_id,
            Transaction.user_id == user_id,
        )
        .first()
    )

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy giao dịch",
        )

    old_account = (
        db.query(FinancialAccount)
        .filter(
            FinancialAccount.account_id == transaction.account_id,
            FinancialAccount.user_id == user_id,
        )
        .first()
    )

    new_account = (
        db.query(FinancialAccount)
        .filter(
            FinancialAccount.account_id == data.account_id,
            FinancialAccount.user_id == user_id,
            FinancialAccount.is_archived == False,
        )
        .first()
    )

    if not new_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản",
        )

    category = (
        db.query(Category)
        .join(CategoryGroup, Category.group_id == CategoryGroup.group_id)
        .filter(
            Category.category_id == data.category_id,
            (Category.user_id == None) | (Category.user_id == user_id),
        )
        .first()
    )

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy danh mục",
        )

    old_amount = Decimal(str(transaction.amount))
    new_amount = Decimal(str(data.amount))

    # Only adjust balances for confirmed transactions
    if transaction.status == "confirmed":
        # Reverse old transaction effect
        if old_account:
            if transaction.transaction_type == "income":
                old_account.balance = old_account.balance - old_amount
            elif transaction.transaction_type == "expense":
                old_account.balance = old_account.balance + old_amount

        # Apply new transaction effect
        if data.transaction_type == "income":
            new_account.balance = new_account.balance + new_amount
        elif data.transaction_type == "expense":
            if new_account.balance < new_amount:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Số dư tài khoản không đủ",
                )
            new_account.balance = new_account.balance - new_amount

    transaction.account_id = data.account_id
    transaction.category_id = data.category_id
    transaction.amount = new_amount
    transaction.transaction_type = data.transaction_type
    transaction.transaction_date = data.transaction_date
    transaction.description = data.description
    transaction.merchant_name = data.merchant_name

    db.commit()
    db.refresh(transaction)

    return _enrich(db, transaction)


def delete_transaction(db: Session, user_id: int, transaction_id: int):
    transaction = (
        db.query(Transaction)
        .filter(
            Transaction.transaction_id == transaction_id,
            Transaction.user_id == user_id,
        )
        .first()
    )

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy giao dịch",
        )

    # Only reverse balance if transaction was confirmed
    if transaction.status == "confirmed":
        account = (
            db.query(FinancialAccount)
            .filter(
                FinancialAccount.account_id == transaction.account_id,
                FinancialAccount.user_id == user_id,
            )
            .first()
        )

        if account:
            amount = Decimal(str(transaction.amount))
            if transaction.transaction_type == "income":
                account.balance = account.balance - amount
            elif transaction.transaction_type == "expense":
                account.balance = account.balance + amount

    db.delete(transaction)
    db.commit()

    return {"status": "success", "message": "Đã xóa giao dịch"}
