from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/overview/{user_id}")
def get_overview(user_id: int, db: Session = Depends(get_db)):
    income = db.execute(
        text("SELECT total_income FROM view_total_income WHERE user_id = :user_id"),
        {"user_id": user_id}
    ).fetchone()

    expense = db.execute(
        text("SELECT total_expense FROM view_total_expense WHERE user_id = :user_id"),
        {"user_id": user_id}
    ).fetchone()

    return {
        "total_income": income[0] if income else 0,
        "total_expense": expense[0] if expense else 0,
        "saving": (income[0] if income else 0) - (expense[0] if expense else 0)
    }