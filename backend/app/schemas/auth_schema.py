from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: str
    username: str = Field(..., min_length=3, max_length=50)
    phone: str | None = None
    password: str = Field(..., min_length=6, max_length=72)
    confirm_password: str = Field(..., min_length=6, max_length=72)


class LoginRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=1, max_length=72)


class UserResponse(BaseModel):
    user_id: int
    full_name: str
    email: str
    username: str
    phone: str | None = None
    role: str
    status: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse