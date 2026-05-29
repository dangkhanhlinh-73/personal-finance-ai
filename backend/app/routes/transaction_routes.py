from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category import Category, CategoryGroup
from app.models.financial_account import FinancialAccount
from app.models.user import User
from app.schemas.transaction_schema import (
    CategoryResponse,
    TransactionBatchCreate,
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
)
from app.services.transaction_service import (
    cancel_transaction,
    confirm_transaction,
    create_transaction,
    create_transactions_batch,
    delete_transaction,
    get_transactions,
    update_transaction,
)
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


@router.get("/categories", response_model=list[CategoryResponse])
def get_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(
            Category.category_id,
            Category.category_name,
            Category.group_id,
            CategoryGroup.group_name,
            CategoryGroup.group_type,
        )
        .join(CategoryGroup, Category.group_id == CategoryGroup.group_id)
        .filter(
            (Category.user_id == None)
            | (Category.user_id == current_user.user_id)
        )
        .order_by(CategoryGroup.group_type.asc(), Category.category_name.asc())
        .all()
    )

    return [
        {
            "category_id": row.category_id,
            "category_name": row.category_name,
            "group_id": row.group_id,
            "group_name": row.group_name,
            "group_type": row.group_type,
        }
        for row in rows
    ]


@router.get("/options")
def get_transaction_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    accounts = (
        db.query(FinancialAccount)
        .filter(
            FinancialAccount.user_id == current_user.user_id,
            FinancialAccount.is_archived == False,
        )
        .order_by(FinancialAccount.account_id.desc())
        .all()
    )

    category_rows = (
        db.query(
            Category.category_id,
            Category.category_name,
            Category.group_id,
            CategoryGroup.group_name,
            CategoryGroup.group_type,
        )
        .join(CategoryGroup, Category.group_id == CategoryGroup.group_id)
        .filter(
            (Category.user_id == None)
            | (Category.user_id == current_user.user_id)
        )
        .order_by(CategoryGroup.group_type.asc(), Category.category_name.asc())
        .all()
    )

    return {
        "accounts": accounts,
        "categories": [
            {
                "category_id": row.category_id,
                "category_name": row.category_name,
                "group_id": row.group_id,
                "group_name": row.group_name,
                "group_type": row.group_type,
            }
            for row in category_rows
        ],
    }


@router.get("/", response_model=list[TransactionResponse])
def list_transactions(
    keyword: str = Query(default=""),
    transaction_type: str = Query(default=""),
    category_id: int = Query(default=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_transactions(
        db=db,
        user_id=current_user.user_id,
        keyword=keyword,
        transaction_type=transaction_type,
        category_id=category_id,
    )


@router.post("/", response_model=TransactionResponse)
def create_new_transaction(
    data: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_transaction(
        db=db,
        user_id=current_user.user_id,
        data=data,
        source_type="manual",
    )


@router.post("/batch", response_model=list[TransactionResponse])
def create_transactions_batch_endpoint(
    data: TransactionBatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_transactions_batch(
        db=db,
        user_id=current_user.user_id,
        items=data.items,
        source_type="image",
    )


@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_existing_transaction(
    transaction_id: int,
    data: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_transaction(
        db=db,
        user_id=current_user.user_id,
        transaction_id=transaction_id,
        data=data,
    )


@router.patch("/{transaction_id}/confirm", response_model=TransactionResponse)
def confirm_existing_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return confirm_transaction(
        db=db,
        user_id=current_user.user_id,
        transaction_id=transaction_id,
    )


@router.patch("/{transaction_id}/cancel", response_model=TransactionResponse)
def cancel_existing_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return cancel_transaction(
        db=db,
        user_id=current_user.user_id,
        transaction_id=transaction_id,
    )


@router.delete("/{transaction_id}")
def remove_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return delete_transaction(
        db=db,
        user_id=current_user.user_id,
        transaction_id=transaction_id,
    )
