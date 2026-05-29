from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.category import Category, CategoryGroup, UserHiddenCategory
from app.models.user import User
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/categories", tags=["Categories"])


# ── Schemas ────────────────────────────────────────────────────────────────

class CategoryGroupCreate(BaseModel):
    group_name: str
    group_type: str
    description: Optional[str] = None


class CategoryGroupUpdate(BaseModel):
    group_name: str
    group_type: str
    description: Optional[str] = None


class CategoryGroupResponse(BaseModel):
    group_id: int
    group_name: str
    group_type: str
    description: Optional[str] = None
    is_system: bool

    class Config:
        from_attributes = True


class CategoryCreate(BaseModel):
    category_name: str
    group_id: int
    description: Optional[str] = None


class CategoryUpdate(BaseModel):
    category_name: str
    group_id: int
    description: Optional[str] = None


class CategoryDetailResponse(BaseModel):
    category_id: int
    category_name: str
    group_id: int
    group_name: str
    group_type: str
    description: Optional[str] = None
    is_system: bool
    is_hidden: bool

    class Config:
        from_attributes = True


# ── Category Groups ─────────────────────────────────────────────────────────

@router.get("/groups", response_model=list[CategoryGroupResponse])
def list_category_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(CategoryGroup)
        .filter(
            (CategoryGroup.user_id == None) | (CategoryGroup.user_id == current_user.user_id)
        )
        .order_by(CategoryGroup.group_type, CategoryGroup.group_name)
        .all()
    )
    return [
        {
            "group_id": g.group_id,
            "group_name": g.group_name,
            "group_type": g.group_type,
            "description": g.description,
            "is_system": g.user_id is None,
        }
        for g in rows
    ]


@router.post("/groups", response_model=CategoryGroupResponse)
def create_category_group(
    data: CategoryGroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.group_type not in ("income", "expense", "debt", "investment"):
        raise HTTPException(status_code=400, detail="Loại nhóm không hợp lệ")

    existing = db.query(CategoryGroup).filter(
        CategoryGroup.group_name == data.group_name.strip()
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tên nhóm danh mục đã tồn tại")

    group = CategoryGroup(
        group_name=data.group_name.strip(),
        group_type=data.group_type,
        user_id=current_user.user_id,
        description=data.description,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return {
        "group_id": group.group_id,
        "group_name": group.group_name,
        "group_type": group.group_type,
        "description": group.description,
        "is_system": False,
    }


@router.put("/groups/{group_id}", response_model=CategoryGroupResponse)
def update_category_group(
    group_id: int,
    data: CategoryGroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = db.query(CategoryGroup).filter(
        CategoryGroup.group_id == group_id,
        CategoryGroup.user_id == current_user.user_id,
    ).first()
    if not group:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm hoặc không có quyền sửa")

    if data.group_type not in ("income", "expense", "debt", "investment"):
        raise HTTPException(status_code=400, detail="Loại nhóm không hợp lệ")

    dup = db.query(CategoryGroup).filter(
        CategoryGroup.group_name == data.group_name.strip(),
        CategoryGroup.group_id != group_id,
    ).first()
    if dup:
        raise HTTPException(status_code=400, detail="Tên nhóm danh mục đã tồn tại")

    group.group_name = data.group_name.strip()
    group.group_type = data.group_type
    group.description = data.description
    db.commit()
    db.refresh(group)
    return {
        "group_id": group.group_id,
        "group_name": group.group_name,
        "group_type": group.group_type,
        "description": group.description,
        "is_system": False,
    }


@router.delete("/groups/{group_id}")
def delete_category_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = db.query(CategoryGroup).filter(
        CategoryGroup.group_id == group_id,
        CategoryGroup.user_id == current_user.user_id,
    ).first()
    if not group:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm hoặc không có quyền xóa")

    has_categories = db.query(Category).filter(Category.group_id == group_id).first()
    if has_categories:
        raise HTTPException(status_code=400, detail="Nhóm này còn danh mục, không thể xóa")

    db.delete(group)
    db.commit()
    return {"status": "success"}


# ── Categories ──────────────────────────────────────────────────────────────

def _build_rows(rows, hidden_ids: set) -> list:
    result = []
    for row in rows:
        result.append({
            "category_id": row.category_id,
            "category_name": row.category_name,
            "group_id": row.group_id,
            "group_name": row.group_name,
            "group_type": row.group_type,
            "description": row.description,
            "is_system": row.user_id is None,
            "is_hidden": row.category_id in hidden_ids,
        })
    return result


@router.get("/", response_model=list[CategoryDetailResponse])
def list_categories(
    show_hidden: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    hidden_ids = {
        r.category_id
        for r in db.query(UserHiddenCategory.category_id).filter(
            UserHiddenCategory.user_id == current_user.user_id
        ).all()
    }

    rows = (
        db.query(
            Category.category_id,
            Category.category_name,
            Category.group_id,
            Category.user_id,
            Category.description,
            CategoryGroup.group_name,
            CategoryGroup.group_type,
        )
        .join(CategoryGroup, Category.group_id == CategoryGroup.group_id)
        .filter(
            (Category.user_id == None) | (Category.user_id == current_user.user_id)
        )
        .order_by(CategoryGroup.group_type, Category.category_name)
        .all()
    )

    if not show_hidden:
        rows = [r for r in rows if not (r.user_id is None and r.category_id in hidden_ids)]

    return _build_rows(rows, hidden_ids)


@router.post("/", response_model=CategoryDetailResponse)
def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = db.query(CategoryGroup).filter(CategoryGroup.group_id == data.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm danh mục")

    existing = db.query(Category).filter(
        Category.category_name == data.category_name.strip(),
        Category.group_id == data.group_id,
        (Category.user_id == None) | (Category.user_id == current_user.user_id),
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tên danh mục đã tồn tại trong nhóm này")

    cat = Category(
        category_name=data.category_name.strip(),
        group_id=data.group_id,
        user_id=current_user.user_id,
        description=data.description,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return {
        "category_id": cat.category_id,
        "category_name": cat.category_name,
        "group_id": cat.group_id,
        "group_name": group.group_name,
        "group_type": group.group_type,
        "description": cat.description,
        "is_system": False,
        "is_hidden": False,
    }


@router.put("/{category_id}", response_model=CategoryDetailResponse)
def update_category(
    category_id: int,
    data: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cat = db.query(Category).filter(
        Category.category_id == category_id,
        Category.user_id == current_user.user_id,
    ).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục hoặc không có quyền sửa")

    group = db.query(CategoryGroup).filter(CategoryGroup.group_id == data.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm danh mục")

    cat.category_name = data.category_name.strip()
    cat.group_id = data.group_id
    cat.description = data.description
    db.commit()
    db.refresh(cat)
    return {
        "category_id": cat.category_id,
        "category_name": cat.category_name,
        "group_id": cat.group_id,
        "group_name": group.group_name,
        "group_type": group.group_type,
        "description": cat.description,
        "is_system": False,
        "is_hidden": False,
    }


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cat = db.query(Category).filter(
        Category.category_id == category_id,
        Category.user_id == current_user.user_id,
    ).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục hoặc không có quyền xóa")

    db.delete(cat)
    db.commit()
    return {"status": "success"}


# ── Hide / Unhide system categories ─────────────────────────────────────────

@router.post("/{category_id}/hide")
def hide_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cat = db.query(Category).filter(Category.category_id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")
    if cat.user_id is not None:
        raise HTTPException(status_code=400, detail="Chỉ có thể ẩn danh mục hệ thống")

    already = db.query(UserHiddenCategory).filter(
        UserHiddenCategory.user_id == current_user.user_id,
        UserHiddenCategory.category_id == category_id,
    ).first()
    if not already:
        db.add(UserHiddenCategory(user_id=current_user.user_id, category_id=category_id))
        db.commit()
    return {"status": "hidden"}


@router.delete("/{category_id}/hide")
def unhide_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(UserHiddenCategory).filter(
        UserHiddenCategory.user_id == current_user.user_id,
        UserHiddenCategory.category_id == category_id,
    ).first()
    if row:
        db.delete(row)
        db.commit()
    return {"status": "visible"}
