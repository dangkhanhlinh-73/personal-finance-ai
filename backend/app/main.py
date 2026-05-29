from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import engine

# ── Model imports (required so SQLAlchemy metadata is populated) ──────────────
from app.models.user import User
from app.models.financial_account import FinancialAccount
from app.models.category import Category, CategoryGroup, UserHiddenCategory
from app.models.ocr_job import OcrJob
from app.models.transaction import Transaction
from app.models.transfer import Transfer
from app.models.ai_classification_history import AiClassificationHistory
from app.models.investment_source import InvestmentSource
from app.models.investment import Investment
from app.models.debt import Debt
from app.models.debt_payment import DebtPayment

# ── Router imports ────────────────────────────────────────────────────────────
from app.routes.auth_routes import router as auth_router
from app.routes.account_routes import router as account_router
from app.routes.dashboard_routes import router as dashboard_router
from app.routes.transaction_routes import router as transaction_router
from app.routes.transfer_routes import router as transfer_router
from app.routes.investment_routes import router as investment_router
from app.routes.debt_routes import router as debt_router
from app.routes.ocr_job_routes import router as ocr_job_router
from app.routes.category_routes import router as category_router

app = FastAPI(
    title="Personal Finance AI API",
    description="Backend API cho hệ thống quản lý tài chính cá nhân tích hợp AI",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(account_router)
app.include_router(dashboard_router)
app.include_router(transaction_router)
app.include_router(transfer_router)
app.include_router(investment_router)
app.include_router(debt_router)
app.include_router(ocr_job_router)
app.include_router(category_router)


@app.get("/")
def home():
    return {
        "message": "Personal Finance AI Backend is running",
        "status": "success",
    }


@app.get("/test-db")
def test_database_connection():
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT current_database()"))
            db_name = result.fetchone()[0]

        return {
            "status": "success",
            "message": "Kết nối PostgreSQL thành công",
            "database": db_name,
        }

    except Exception as e:
        return {
            "status": "error",
            "message": "Không thể kết nối PostgreSQL",
            "detail": str(e),
        }
