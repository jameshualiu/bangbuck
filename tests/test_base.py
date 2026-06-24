from scrapers.base import ProductResult

def test_product_result_fields():
    p = ProductResult(
        store_name="Kroger",
        product_name="Chicken Breast Boneless Skinless",
        price=8.99,
        price_per_unit=4.49,
        unit="lb",
        url="https://www.instacart.com/store/kroger/product/123",
    )
    assert p.store_name == "Kroger"
    assert p.price_per_unit == 4.49
    assert p.unit == "lb"

def test_product_result_is_dataclass():
    from dataclasses import fields
    field_names = {f.name for f in fields(ProductResult)}
    assert field_names == {"store_name", "product_name", "price", "price_per_unit", "unit", "url"}
