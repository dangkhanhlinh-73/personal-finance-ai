from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.financial_account import FinancialAccount
from app.schemas.account_schema import AccountCreate, AccountResponse
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])

@router.get("/", response_model=list[AccountResponse])
def get_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    accounts = db.query(FinancialAccount).filter(
        FinancialAccount.user_id == current_user.user_id,
        FinancialAccount.is_archived == False
    ).order_by(FinancialAccount.account_id.desc()).all()

    return accounts

@router.post("/", response_model=AccountResponse)
def create_account(
    request: AccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if request.account_type not in ["cash", "bank", "ewallet"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Loại tài khoản không hợp lệ"
        )

    if request.balance < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Số dư không được nhỏ hơn 0"
        )

    if request.is_default:
        db.query(FinancialAccount).filter(
            FinancialAccount.user_id == current_user.user_id
        ).update({"is_default": False})

    new_account = FinancialAccount(
        user_id=current_user.user_id,
        account_name=request.account_name,
        account_type=request.account_type,
        balance=request.balance,
        currency=request.currency,
        is_default=request.is_default,
        is_archived=False
    )

    db.add(new_account)
    db.commit()
    db.refresh(new_account)

    return new_account

@router.put("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: int,
    request: AccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    account = db.query(FinancialAccount).filter(
        FinancialAccount.account_id == account_id,
        FinancialAccount.user_id == current_user.user_id,
        FinancialAccount.is_archived == False
    ).first()

    if not account:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")

    if request.is_default and not account.is_default:
        db.query(FinancialAccount).filter(
            FinancialAccount.user_id == current_user.user_id
        ).update({"is_default": False})

    account.account_name = request.account_name
    account.account_type = request.account_type
    account.balance = request.balance
    account.currency = request.currency
    account.is_default = request.is_default

    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}")
def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    account = db.query(FinancialAccount).filter(
        FinancialAccount.account_id == account_id,
        FinancialAccount.user_id == current_user.user_id
    ).first()

    if not account:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")

    # Xóa mềm (đổi trạng thái is_archived = True để giữ lại lịch sử giao dịch)
    account.is_archived = True
    db.commit()
    
    return {"status": "success", "message": "Đã xóa tài khoản"}