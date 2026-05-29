from sqlalchemy import Column, BigInteger, String, Text, TIMESTAMP, ForeignKey, Enum
from sqlalchemy.sql import func
from app.database import Base


class CategoryGroup(Base):
    __tablename__ = "category_group"

    group_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    group_name = Column(String(100), nullable=False, unique=True)
    group_type = Column(Enum("income", "expense", "debt", "investment", name="group_type", create_type=False), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=True)
    description = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


class Category(Base):
    __tablename__ = "categories"

    category_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    category_name = Column(String(100), nullable=False)
    group_id = Column(BigInteger, ForeignKey("category_group.group_id"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.user_id"), nullable=True)
    description = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


class UserHiddenCategory(Base):
    __tablename__ = "user_hidden_categories"

    user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    category_id = Column(BigInteger, ForeignKey("categories.category_id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
