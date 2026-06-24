import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from locator import find_instacart_stores, geocode_all_stores

router = APIRouter(prefix="/stores", tags=["stores"])

class StoreFindRequest(BaseModel):
    lat: float
    lng: float
    zip_code: str = Field(pattern=r'^\d{5}(-\d{4})?$')
    radius_miles: float = 5.0

@router.post("/find")
def find_stores(body: StoreFindRequest):
    try:
        raw = asyncio.run(find_instacart_stores(body.lat, body.lng, body.zip_code))
        return geocode_all_stores(raw, body.lat, body.lng, body.radius_miles)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Store discovery unavailable") from exc
