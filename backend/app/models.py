from sqlalchemy import Column, BigInteger, String, DECIMAL, DateTime, Date, Enum, Text, Boolean, TIMESTAMP
from app.database import Base

class User(Base):
    __tablename__ = "users"

    user_id = Column(BigInteger, primary_key=True, index=True)
    full_name = Column(String(100))
    email = Column(String(100))
    username = Column(String(50))
    password_hash = Column(String(255))
    phone = Column(String(15))
    status = Column(Enum("active", "inactive", "locked"))


class FinancialAccount(Base):
    __tablename__ = "financial_accounts"

    account_id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger)
    account_name = Column(String(100))
    account_type = Column(Enum("cash", "bank", "ewallet"))
    balance = Column(DECIMAL(18, 2))
    currency = Column(String(10))
    is_default = Column(Boolean)


class Category(Base):
    __tablename__ = "categories"

    category_id = Column(BigInteger, primary_key=True, index=True)
    category_name = Column(String(100))
    group_id = Column(BigInteger)
    user_id = Column(BigInteger)
    description = Column(String(255))
class Transaction(Base):
    __tablename__ = "transactions"

    transaction_id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger)
    account_id = Column(BigInteger)
    category_id = Column(BigInteger)
    amount = Column(DECIMAL(18, 2))
    transaction_type = Column(String(20))
    transaction_date = Column(DateTime)
    description = Column(String(255))
    merchant_name = Column(String(100))
    source_type = Column(String(20))
    status = Column(String(20))
    created_at = Column(DateTime)
    updated_at = Column(DateTime)



class Debt(Base):
    __tablename__ = "debts"

    debt_id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger)
    account_id = Column(BigInteger)
    debt_type = Column(Enum("borrowed", "lent"))
    partner_name = Column(String(100))
    total_amount = Column(DECIMAL(18, 2))
    remaining_amount = Column(DECIMAL(18, 2))
    interest_rate = Column(DECIMAL(5, 2))
    start_date = Column(Date)
    due_date = Column(Date)
    status = Column(Enum("ongoing", "paid", "overdue"))
    note = Column(String(255))


class Investment(Base):
    __tablename__ = "investments"

    investment_id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger)
    account_id = Column(BigInteger)
    investment_name = Column(String(100))
    investment_type_id = Column(BigInteger)
    invested_amount = Column(DECIMAL(18, 2))
    current_value = Column(DECIMAL(18, 2))
    start_date = Column(Date)
    note = Column(String(255))

class DebtPayment(Base):
    __tablename__ = "debt_payment"

    payment_id = Column(BigInteger, primary_key=True, index=True)
    debt_id = Column(BigInteger)
    account_id = Column(BigInteger)
    payment_amount = Column(DECIMAL(18, 2))
    payment_date = Column(DateTime)
    note = Column(String(255))