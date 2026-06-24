from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass
class ProductResult:
    store_name: str
    product_name: str
    price: float
    price_per_unit: float
    unit: str
    url: str


@runtime_checkable
class StoreAdapter(Protocol):
    def search(self, query: str, zip_code: str) -> list[ProductResult]:
        ...
