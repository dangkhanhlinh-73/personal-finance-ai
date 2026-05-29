from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.user import User
from app.schemas.auth_schema import RegisterRequest, LoginRequest, TokenResponse
from app.utils.security import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register", response_model=TokenResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    if request.password != request.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu xác nhận không khớp"
        )

    existing_email = db.query(User).filter(User.email == request.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email đã được sử dụng"
        )

    existing_username = db.query(User).filter(User.username == request.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên đăng nhập đã tồn tại"
        )

    new_user = User(
        full_name=request.full_name,
        email=request.email,
        username=request.username,
        phone=request.phone,
        password_hash=hash_password(request.password),
        role="user",
        status="active"
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(
        data={
            "sub": str(new_user.user_id),
            "email": new_user.email,
            "role": new_user.role
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": new_user
    }


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không đúng"
        )

    if not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không đúng"
        )

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản không hoạt động hoặc đã bị khóa"
        )

    token = create_access_token(
        data={
            "sub": str(user.user_id),
            "email": user.email,
            "role": user.role
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }


@router.post("/logout")
def logout():
    return {
        "status": "success",
        "message": "Đăng xuất thành công. Token đã được xóa ở phía frontend."
    }


# ── Profile ───────────────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    full_name: str
    username: str
    email: str
    phone: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str
    confirm_new_password: str


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "user_id": current_user.user_id,
        "full_name": current_user.full_name,
        "username": current_user.username,
        "email": current_user.email,
        "phone": current_user.phone,
        "role": current_user.role,
        "status": current_user.status,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }


@router.put("/me")
def update_profile(
    data: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not data.full_name.strip():
        raise HTTPException(status_code=400, detail="Họ tên không được để trống")
    if not data.username.strip():
        raise HTTPException(status_code=400, detail="Tên đăng nhập không được để trống")
    if not data.email.strip():
        raise HTTPException(status_code=400, detail="Email không được để trống")

    # Check uniqueness (exclude self)
    dup_email = db.query(User).filter(
        User.email == data.email.strip(),
        User.user_id != current_user.user_id,
    ).first()
    if dup_email:
        raise HTTPException(status_code=400, detail="Email đã được sử dụng bởi tài khoản khác")

    dup_username = db.query(User).filter(
        User.username == data.username.strip(),
        User.user_id != current_user.user_id,
    ).first()
    if dup_username:
        raise HTTPException(status_code=400, detail="Tên đăng nhập đã tồn tại")

    current_user.full_name = data.full_name.strip()
    current_user.username = data.username.strip()
    current_user.email = data.email.strip()
    current_user.phone = data.phone.strip() if data.phone else None
    db.commit()
    db.refresh(current_user)

    return {
        "user_id": current_user.user_id,
        "full_name": current_user.full_name,
        "username": current_user.username,
        "email": current_user.email,
        "phone": current_user.phone,
        "role": current_user.role,
        "status": current_user.status,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }


@router.put("/me/password")
def change_password(
    data: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 6 ký tự")
    if data.new_password != data.confirm_new_password:
        raise HTTPException(status_code=400, detail="Xác nhận mật khẩu không khớp")
    if data.new_password == data.current_password:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải khác mật khẩu hiện tại")

    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"status": "success", "message": "Đổi mật khẩu thành công"}