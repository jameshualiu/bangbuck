from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator
from scrapers.instacart import InstacartScraper
from parser import score_product, usda_lookup

router = APIRouter(prefix="/search", tags=["search"])

class SearchRequest(BaseModel):
    query: str
    zip_code: str
    slugs: list[str] = Field(min_length=1, max_length=50)

    @field_validator("slugs")
    @classmethod
    def slugs_not_empty(cls, v: list[str]) -> list[str]:
        if any(not s.strip() for s in v):
            raise ValueError("slugs must not contain blank strings")
        return v

@router.post("")
def search(body: SearchRequest):
    try:
        scraper = InstacartScraper()
        products = scraper.search(body.query, body.zip_code, slugs=body.slugs)
        results = [score_product(p, usda_lookup(p.product_name)) for p in products]
        results.sort(key=lambda r: r["score"], reverse=True)
        return results
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Search unavailable — scraper error") from exc
