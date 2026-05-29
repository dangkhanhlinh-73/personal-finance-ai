from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.transfer_schema import TransferCreate, TransferResponse
from app.services.transfer_service import create_transfer, delete_transfer, get_transfers
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/transfers", tags=["Transfers"])


@router.get("/", response_model=list[TransferResponse])
def list_transfers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_transfers(db=db, user_id=current_user.user_id)


@router.post("/", response_model=TransferResponse)
def create_new_transfer(
    data: TransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_transfer(db=db, user_id=current_user.user_id, data=data)


@router.delete("/{transfer_id}")
def remove_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return delete_transfer(db=db, user_id=current_user.user_id, transfer_id=transfer_id)