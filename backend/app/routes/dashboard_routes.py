from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category import Category, CategoryGroup
from app.models.debt import Debt
from app.models.financial_account import FinancialAccount
from app.models.investment_source import InvestmentSource
from app.models.transaction import Transaction
from app.models.user import User
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def _month_bounds(year: int, month: int):
    first = datetime(year, month, 1)
    if month == 12:
        last = datetime(year + 1, 1, 1)
    else:
        last = datetime(year, month + 1, 1)
    return first, last


def _months_ago(now: datetime, n: int):
    month = now.month - n
    year = now.year
    while month <= 0:
        month += 12
        year -= 1
    return year, month


@router.get("/summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now()
    uid = current_user.user_id
    first_day = datetime(now.year, now.month, 1)

    # ── KPI cards ─────────────────────────────────────────────────────────────
    total_balance = db.query(
        func.coalesce(func.sum(FinancialAccount.balance), 0)
    ).filter(
        FinancialAccount.user_id == uid,
        FinancialAccount.is_archived == False,
    ).scalar()

    monthly_income = db.query(
        func.coalesce(func.sum(Transaction.amount), 0)
    ).filter(
        Transaction.user_id == uid,
        Transaction.transaction_type == "income",
        Transaction.status == "confirmed",
        Transaction.transaction_date >= first_day,
    ).scalar()

    monthly_expense = db.query(
        func.coalesce(func.sum(Transaction.amount), 0)
    ).filter(
        Transaction.user_id == uid,
        Transaction.transaction_type == "expense",
        Transaction.status == "confirmed",
        Transaction.transaction_date >= first_day,
    ).scalar()

    saving = float(monthly_income) - float(monthly_expense)

    inv_sources_all = (
        db.query(InvestmentSource).filter(InvestmentSource.user_id == uid).all()
    )
    total_investment_value = sum(
        float(s.current_balance) * (1 + float(s.interest_rate or 0) / 100)
        for s in inv_sources_all
    )

    total_borrow_remaining = db.query(
        func.coalesce(func.sum(Debt.remaining_amount), 0)
    ).filter(
        Debt.user_id == uid,
        Debt.debt_type == "borrow",
        Debt.status == "active",
    ).scalar()

    total_lend_remaining = db.query(
        func.coalesce(func.sum(Debt.remaining_amount), 0)
    ).filter(
        Debt.user_id == uid,
        Debt.debt_type == "lend",
        Debt.status == "active",
    ).scalar()

    active_debts_count = db.query(func.count(Debt.debt_id)).filter(
        Debt.user_id == uid, Debt.status == "active",
    ).scalar()

    # ── Monthly trend — last 6 months ─────────────────────────────────────────
    monthly_trend = []
    for i in range(5, -1, -1):
        y, m = _months_ago(now, i)
        first, last = _month_bounds(y, m)

        inc = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
            Transaction.user_id == uid,
            Transaction.transaction_type == "income",
            Transaction.status == "confirmed",
            Transaction.transaction_date >= first,
            Transaction.transaction_date < last,
        ).scalar()

        exp = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
            Transaction.user_id == uid,
            Transaction.transaction_type == "expense",
            Transaction.status == "confirmed",
            Transaction.transaction_date >= first,
            Transaction.transaction_date < last,
        ).scalar()

        monthly_trend.append({
            "month": f"{m:02d}/{y}",
            "income": float(inc),
            "expense": float(exp),
        })

    # ── Expense by category group (this month) ────────────────────────────────
    expense_rows = (
        db.query(
            CategoryGroup.group_name,
            CategoryGroup.group_type,
            func.sum(Transaction.amount).label("total"),
        )
        .join(Category, Transaction.category_id == Category.category_id)
        .join(CategoryGroup, Category.group_id == CategoryGroup.group_id)
        .filter(
            Transaction.user_id == uid,
            Transaction.transaction_type == "expense",
            Transaction.status == "confirmed",
            Transaction.transaction_date >= first_day,
        )
        .group_by(CategoryGroup.group_id, CategoryGroup.group_name, CategoryGroup.group_type)
        .order_by(func.sum(Transaction.amount).desc())
        .all()
    )
    expense_by_group = [
        {"group_name": r.group_name, "group_type": r.group_type, "amount": float(r.total)}
        for r in expense_rows
    ]

    # ── Recent transactions (last 5 confirmed) ────────────────────────────────
    recent_rows = (
        db.query(
            Transaction.transaction_id,
            Transaction.amount,
            Transaction.transaction_type,
            Transaction.transaction_date,
            Transaction.merchant_name,
            Transaction.description,
            Category.category_name,
            CategoryGroup.group_name,
        )
        .join(Category, Transaction.category_id == Category.category_id)
        .join(CategoryGroup, Category.group_id == CategoryGroup.group_id)
        .filter(
            Transaction.user_id == uid,
            Transaction.status == "confirmed",
        )
        .order_by(Transaction.transaction_date.desc())
        .limit(5)
        .all()
    )
    recent_transactions = [
        {
            "transaction_id": r.transaction_id,
            "amount": float(r.amount),
            "transaction_type": r.transaction_type,
            "transaction_date": r.transaction_date.isoformat(),
            "title": r.merchant_name or r.description or "Không có tiêu đề",
            "category_name": r.category_name,
            "group_name": r.group_name,
        }
        for r in recent_rows
    ]

    # ── Accounts ──────────────────────────────────────────────────────────────
    account_rows = (
        db.query(FinancialAccount)
        .filter(FinancialAccount.user_id == uid, FinancialAccount.is_archived == False)
        .order_by(FinancialAccount.balance.desc())
        .all()
    )
    accounts = [
        {
            "account_id": a.account_id,
            "account_name": a.account_name,
            "account_type": a.account_type,
            "balance": float(a.balance),
            "currency": a.currency,
        }
        for a in account_rows
    ]

    # ── Investment sources ─────────────────────────────────────────────────────
    inv_rows = sorted(inv_sources_all, key=lambda s: float(s.current_balance), reverse=True)
    investment_sources = [
        {
            "source_id": s.source_id,
            "source_name": s.source_name,
            "initial_balance": float(s.initial_balance),
            "current_balance": float(s.current_balance),
            "interest_rate": float(s.interest_rate or 0),
            "value_with_interest": float(s.current_balance) * (1 + float(s.interest_rate or 0) / 100),
            "profit": float(s.current_balance) * (1 + float(s.interest_rate or 0) / 100) - float(s.initial_balance),
        }
        for s in inv_rows
    ]

    # ── Active debts ───────────────────────────────────────────────────────────
    debt_rows = (
        db.query(Debt)
        .filter(Debt.user_id == uid, Debt.status == "active")
        .order_by(Debt.due_date.asc().nullslast())
        .limit(5)
        .all()
    )
    active_debts = [
        {
            "debt_id": d.debt_id,
            "debt_type": d.debt_type,
            "partner_name": d.partner_name,
            "total_amount": float(d.total_amount),
            "remaining_amount": float(d.remaining_amount),
            "due_date": d.due_date.isoformat() if d.due_date else None,
            "interest_rate": float(d.interest_rate),
        }
        for d in debt_rows
    ]

    return {
        "user": {
            "user_id": current_user.user_id,
            "full_name": current_user.full_name,
            "email": current_user.email,
            "username": current_user.username,
        },
        "summary": {
            "total_balance": float(total_balance),
            "monthly_income": float(monthly_income),
            "monthly_expense": float(monthly_expense),
            "monthly_saving": saving,
            "total_investment_value": float(total_investment_value),
            "total_borrow_remaining": float(total_borrow_remaining),
            "total_lend_remaining": float(total_lend_remaining),
            "active_debts_count": int(active_debts_count),
        },
        "monthly_trend": monthly_trend,
        "expense_by_group": expense_by_group,
        "recent_transactions": recent_transactions,
        "accounts": accounts,
        "investment_sources": investment_sources,
        "active_debts": active_debts,
    }
