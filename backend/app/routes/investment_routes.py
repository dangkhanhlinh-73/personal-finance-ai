from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.investment_schema import (
    InvestmentCreate,
    InvestmentResponse,
    InvestmentSourceCreate,
    InvestmentSourceResponse,
    InvestmentSourceUpdate,
)
from app.services.investment_service import (
    create_investment,
    create_investment_source,
    delete_investment,
    delete_investment_source,
    get_investment_sources,
    get_investments,
    update_investment_source,
)
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/investments", tags=["Investments"])


# ── Sources ──────────────────────────────────────────────────────────────────


@router.get("/sources", response_model=list[InvestmentSourceResponse])
def list_investment_sources(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_investment_sources(db=db, user_id=current_user.user_id)


@router.post("/sources", response_model=InvestmentSourceResponse)
def create_new_investment_source(
    data: InvestmentSourceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_investment_source(db=db, user_id=current_user.user_id, data=data)


@router.put("/sources/{source_id}", response_model=InvestmentSourceResponse)
def edit_investment_source(
    source_id: int,
    data: InvestmentSourceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_investment_source(db=db, user_id=current_user.user_id, source_id=source_id, data=data)


@router.delete("/sources/{source_id}")
def remove_investment_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return delete_investment_source(
        db=db, user_id=current_user.user_id, source_id=source_id
    )


# ── Investments ──────────────────────────────────────────────────────────────


@router.get("/", response_model=list[InvestmentResponse])
def list_investments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_investments(db=db, user_id=current_user.user_id)


@router.post("/", response_model=InvestmentResponse)
def create_new_investment(
    data: InvestmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_investment(db=db, user_id=current_user.user_id, data=data)


@router.delete("/{investment_id}")
def remove_investment(
    investment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return delete_investment(
        db=db, user_id=current_user.user_id, investment_id=investment_id
    )
