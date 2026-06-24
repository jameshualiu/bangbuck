from scrapers.base import ProductResult
from parser import score_product

CHICKEN = ProductResult(
    store_name="Kroger",
    product_name="Boneless Skinless Chicken Breast",
    price=8.99,
    price_per_unit=4.49,
    unit="lb",
    url="https://instacart.com/fake",
)

USDA_CHICKEN = {
    "description": "Chicken, broilers or fryers, breast, meat only, raw",
    "foodNutrients": [
        {"nutrientName": "Protein", "value": 22.5},
        {"nutrientName": "Energy", "value": 106},
        {"nutrientName": "Sodium, Na", "value": 66},
        {"nutrientName": "Potassium, K", "value": 330},
    ],
}

def test_score_product_returns_dict():
    result = score_product(CHICKEN, USDA_CHICKEN)
    assert isinstance(result, dict)

def test_score_product_has_required_keys():
    result = score_product(CHICKEN, USDA_CHICKEN)
    for key in ["store_name", "product_name", "price_per_unit", "unit",
                "protein_per_100g", "calories_per_100g", "score", "tier",
                "price_per_protein_gram", "ingredient_label"]:
        assert key in result, f"Missing key: {key}"

def test_score_product_chicken_is_solid_choice():
    result = score_product(CHICKEN, USDA_CHICKEN)
    assert result["score"] >= 0.7
    assert result["tier"] == "SOLID CHOICE"

def test_score_product_none_usda():
    result = score_product(CHICKEN, None)
    assert result["score"] < 0.0
    assert result["tier"] == "PROCESSED TRAP"

def test_score_product_preserves_store_name():
    result = score_product(CHICKEN, USDA_CHICKEN)
    assert result["store_name"] == "Kroger"
