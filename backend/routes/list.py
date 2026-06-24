from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session
from db import get_db
from models import User, ShoppingListItem
from deps import get_current_user

router = APIRouter(prefix="/list", tags=["list"])

class ListItemCreate(BaseModel):
    product_name: str
    store_name: str
    price: float | None = None
    score: float | None = None
    tier: str | None = None
    url: str | None = Field(default=None, max_length=2048)

class ListItemOut(BaseModel):
    id: int
    product_name: str
    store_name: str
    price: float | None
    score: float | None
    tier: str | None
    url: str | None
    added_at: datetime
    model_config = ConfigDict(from_attributes=True)

@router.get("/items", response_model=list[ListItemOut])
def get_items(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(ShoppingListItem)
        .filter(ShoppingListItem.user_id == current_user.id)
        .order_by(ShoppingListItem.added_at.desc())
        .all()
    )

@router.post("/items", status_code=status.HTTP_201_CREATED, response_model=ListItemOut)
def add_item(
    body: ListItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = ShoppingListItem(user_id=current_user.id, **body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(ShoppingListItem).filter(
        ShoppingListItem.id == item_id,
        ShoppingListItem.user_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    db.delete(item)
    db.commit()
