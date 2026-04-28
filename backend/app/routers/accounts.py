from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import FinancialAccount

router = APIRouter(prefix="/accounts", tags=["Accounts"])

@router.get("/")
def get_accounts(db: Session = Depends(get_db)):
    return db.query(FinancialAccount).all()