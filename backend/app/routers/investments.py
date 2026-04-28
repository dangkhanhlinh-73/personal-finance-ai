from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Investment

router = APIRouter(prefix="/investments", tags=["Investments"])

@router.get("/")
def get_investments(db: Session = Depends(get_db)):
    return db.query(Investment).all()