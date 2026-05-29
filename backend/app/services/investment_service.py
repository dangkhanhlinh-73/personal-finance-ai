from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.financial_account import FinancialAccount
from app.models.investment import Investment
from app.models.investment_source import InvestmentSource
from app.schemas.investment_schema import InvestmentCreate, InvestmentSourceCreate, InvestmentSourceUpdate


# ── Investment Sources ──────────────────────────────────────────────────────


def _source_to_dict(source: InvestmentSource) -> dict:
    rate = Decimal(str(source.interest_rate or 0))
    value_with_interest = source.current_balance * (1 + rate / 100)
    return {
        "source_id": source.source_id,
        "user_id": source.user_id,
        "source_name": source.source_name,
        "initial_balance": source.initial_balance,
        "current_balance": source.current_balance,
        "interest_rate": source.interest_rate,
        "value_with_interest": value_with_interest,
        "created_at": source.created_at,
        "updated_at": source.updated_at,
    }


def get_investment_sources(db: Session, user_id: int):
    sources = (
        db.query(InvestmentSource)
        .filter(InvestmentSource.user_id == user_id)
        .order_by(InvestmentSource.created_at.desc())
        .all()
    )
    return [_source_to_dict(s) for s in sources]


def create_investment_source(db: Session, user_id: int, data: InvestmentSourceCreate):
    source = InvestmentSource(
        user_id=user_id,
        source_name=data.source_name,
        initial_balance=data.initial_balance,
        current_balance=data.initial_balance,
        interest_rate=data.interest_rate,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return _source_to_dict(source)


def update_investment_source(db: Session, user_id: int, source_id: int, data: InvestmentSourceUpdate):
    source = (
        db.query(InvestmentSource)
        .filter(InvestmentSource.source_id == source_id, InvestmentSource.user_id == user_id)
        .first()
    )
    if not source:
        raise HTTPException(status_code=404, detail="Không tìm thấy nguồn đầu tư")

    if data.source_name is not None:
        source.source_name = data.source_name
    if data.interest_rate is not None:
        source.interest_rate = data.interest_rate

    db.commit()
    db.refresh(source)
    return _source_to_dict(source)


def delete_investment_source(db: Session, user_id: int, source_id: int):
    source = (
        db.query(InvestmentSource)
        .filter(
            InvestmentSource.source_id == source_id,
            InvestmentSource.user_id == user_id,
        )
        .first()
    )

    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy nguồn đầu tư",
        )

    db.delete(source)
    db.commit()

    return {"status": "success", "message": "Đã xóa nguồn đầu tư"}


# ── Investments ─────────────────────────────────────────────────────────────


def get_investments(db: Session, user_id: int):
    rows = (
        db.query(
            Investment.investment_id,
            Investment.user_id,
            Investment.investment_source_id,
            Investment.account_id,
            Investment.amount,
            Investment.direction,
            Investment.note,
            Investment.invested_at,
            InvestmentSource.source_name,
            FinancialAccount.account_name,
        )
        .join(
            InvestmentSource,
            Investment.investment_source_id == InvestmentSource.source_id,
        )
        .join(
            FinancialAccount,
            Investment.account_id == FinancialAccount.account_id,
        )
        .filter(Investment.user_id == user_id)
        .order_by(Investment.invested_at.desc(), Investment.investment_id.desc())
        .all()
    )

    return [
        {
            "investment_id": row.investment_id,
            "user_id": row.user_id,
            "investment_source_id": row.investment_source_id,
            "account_id": row.account_id,
            "amount": row.amount,
            "direction": row.direction,
            "note": row.note,
            "invested_at": row.invested_at,
            "source_name": row.source_name,
            "account_name": row.account_name,
        }
        for row in rows
    ]


def create_investment(db: Session, user_id: int, data: InvestmentCreate):
    # Validate account
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

    # Validate investment source
    source = (
        db.query(InvestmentSource)
        .filter(
            InvestmentSource.source_id == data.investment_source_id,
            InvestmentSource.user_id == user_id,
        )
        .first()
    )

    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy nguồn đầu tư",
        )

    amount = Decimal(str(data.amount))

    if data.direction == "invest":
        # Money flows out of account into investment source
        if account.balance < amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Số dư tài khoản không đủ để đầu tư",
            )
        account.balance = account.balance - amount
        source.current_balance = source.current_balance + amount

    elif data.direction == "withdraw":
        # Money flows from investment source back to account
        if source.current_balance < amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Số dư nguồn đầu tư không đủ để rút",
            )
        source.current_balance = source.current_balance - amount
        account.balance = account.balance + amount

    investment = Investment(
        user_id=user_id,
        investment_source_id=data.investment_source_id,
        account_id=data.account_id,
        amount=amount,
        direction=data.direction,
        note=data.note,
        invested_at=data.invested_at,
    )

    db.add(investment)
    db.commit()
    db.refresh(investment)

    return {
        "investment_id": investment.investment_id,
        "user_id": investment.user_id,
        "investment_source_id": investment.investment_source_id,
        "account_id": investment.account_id,
        "amount": investment.amount,
        "direction": investment.direction,
        "note": investment.note,
        "invested_at": investment.invested_at,
        "source_name": source.source_name,
        "account_name": account.account_name,
    }


def delete_investment(db: Session, user_id: int, investment_id: int):
    investment = (
        db.query(Investment)
        .filter(
            Investment.investment_id == investment_id,
            Investment.user_id == user_id,
        )
        .first()
    )

    if not investment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy giao dịch đầu tư",
        )

    account = (
        db.query(FinancialAccount)
        .filter(FinancialAccount.account_id == investment.account_id)
        .first()
    )

    source = (
        db.query(InvestmentSource)
        .filter(InvestmentSource.source_id == investment.investment_source_id)
        .first()
    )

    if not account or not source:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể hoàn tác vì tài khoản hoặc nguồn đầu tư không còn tồn tại",
        )

    amount = Decimal(str(investment.amount))

    # Reverse the original direction
    if investment.direction == "invest":
        # Originally: account -= amount, source += amount → reverse: account += amount, source -= amount
        if source.current_balance < amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nguồn đầu tư không đủ số dư để hoàn tác",
            )
        account.balance = account.balance + amount
        source.current_balance = source.current_balance - amount

    elif investment.direction == "withdraw":
        # Originally: source -= amount, account += amount → reverse: source += amount, account -= amount
        if account.balance < amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tài khoản không đủ số dư để hoàn tác",
            )
        source.current_balance = source.current_balance + amount
        account.balance = account.balance - amount

    db.delete(investment)
    db.commit()

    return {"status": "success", "message": "Đã xóa giao dịch đầu tư và hoàn tác số dư"}
