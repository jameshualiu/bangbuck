import json
import os
import re
import logging
import urllib.request
import urllib.parse

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

USDA_API_KEY = os.environ.get("USDA_API_KEY", "DEMO_KEY")  # 30 req/hr, 50/day — replace with free key from https://fdc.nal.usda.gov/api-key-signup.html
USDA_BASE = "https://api.nal.usda.gov/fdc/v1"

ULTRA_PROCESSED_FLAGS = [
    "high fructose corn syrup", "maltodextrin", "carrageenan",
    "sodium nitrite", "artificial flavor", "artificial colour",
    "partially hydrogenated", "modified starch", "potassium bromate",
    "butylated hydroxyanisole", "bha", "bht", "tbhq",
]


def load_product_json(file_path: str = "product_data.json") -> dict:
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_price(data: dict) -> tuple[float, str]:
    price_data = data["data"]["product"]["price"]
    unit_price = price_data.get("current_retail", 0.0)
    unit_suffix = price_data.get("formatted_unit_price_suffix", "")
    return unit_price, unit_suffix


def extract_ingredients_from_bullets(data: dict) -> list[str]:
    bullets = data["data"]["product"]["item"]["product_description"].get("bullet_descriptions", [])
    for bullet in bullets:
        clean = re.sub(r"<[^>]+>", "", bullet)
        if clean.lower().startswith("ingredients:"):
            raw = clean.split(":", 1)[1].strip()
            return [i.strip().lower() for i in raw.split(",")]
    return []


def usda_lookup(query: str) -> dict | None:
    """Return the first Foundation or SR Legacy food match with nutrient data."""
    params = urllib.parse.urlencode({
        "query": query,
        "dataType": "Foundation,SR Legacy",
        "pageSize": 1,
        "api_key": USDA_API_KEY,
    })
    url = f"{USDA_BASE}/foods/search?{params}"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            result = json.loads(resp.read())
        foods = result.get("foods", [])
        return foods[0] if foods else None
    except Exception as e:
        logger.error(f"USDA lookup failed: {e}")
        return None


def get_nutrient(food: dict, nutrient_name: str) -> float:
    for n in food.get("foodNutrients", []):
        if nutrient_name.lower() in n.get("nutrientName", "").lower():
            return n.get("value", 0.0)
    return 0.0


def score_ingredients(ingredients: list[str]) -> tuple[float, str]:
    """
    Whole Food Modifier score (-1.0 to +1.0).
    +1.0 = single ingredient, 0 = 5 ingredients, negative = ultra-processed flags.
    """
    if not ingredients:
        return 0.0, "No ingredient data"

    count = len(ingredients)
    if count == 1:
        modifier = 1.0
        label = "Single ingredient (whole food)"
    elif count <= 3:
        modifier = 0.5
        label = f"{count} ingredients (minimally processed)"
    elif count <= 5:
        modifier = 0.0
        label = f"{count} ingredients (neutral)"
    else:
        modifier = -0.5
        label = f"{count} ingredients (processed)"

    flags_found = [f for f in ULTRA_PROCESSED_FLAGS if any(f in ing for ing in ingredients)]
    if flags_found:
        modifier -= 0.5 * len(flags_found)
        label += f" | Ultra-processed flags: {', '.join(flags_found)}"

    return modifier, label


def worth_it_tier(score: float) -> str:
    if score >= 0.8:
        return "ELITE FUEL"
    elif score >= 0.5:
        return "SOLID CHOICE"
    elif score >= 0.2:
        return "BUDGET COMPROMISE"
    elif score >= 0.0:
        return "USE SPARINGLY"
    else:
        return "PROCESSED TRAP"


def calculate_worth_it_index(
    price_per_lb: float,
    protein_per_100g: float,
    calories_per_100g: float,
    sodium_mg_per_100g: float,
    potassium_mg_per_100g: float,
    ingredient_modifier: float,
) -> float:
    """
    Normalized 0–1 score based on the four scoring criteria.
    """
    # 1. Protein density: goal is 1g protein per 10 cal (ratio = 0.1)
    protein_ratio = (protein_per_100g / calories_per_100g) if calories_per_100g > 0 else 0
    protein_score = min(protein_ratio / 0.1, 1.0)  # capped at 1.0

    # 2. Whole food modifier already in -1 to +1 range, normalize to 0–1
    ingredient_score = (ingredient_modifier + 1) / 2

    # 3. Electrolyte: bonus for potassium, penalty for sodium without potassium
    electrolyte_ratio = (potassium_mg_per_100g / sodium_mg_per_100g) if sodium_mg_per_100g > 0 else 1.0
    electrolyte_score = min(electrolyte_ratio / 2.0, 1.0)  # ratio of 2:1 K:Na = perfect

    # 4. Cost efficiency: price per gram of protein (per lb basis)
    grams_per_lb = 453.592
    protein_grams_per_lb = (protein_per_100g / 100) * grams_per_lb
    price_per_protein_gram = price_per_lb / protein_grams_per_lb if protein_grams_per_lb > 0 else 999
    # Invert: lower cost = higher score. $0.05/g = excellent, $0.20/g = poor
    cost_score = max(0.0, 1.0 - (price_per_protein_gram / 0.20))

    # Weighted average
    final = (
        protein_score * 0.35
        + ingredient_score * 0.30
        + cost_score * 0.25
        + electrolyte_score * 0.10
    )
    return round(final, 3)


def parse_and_score(product_file: str = "product_data.json"):
    data = load_product_json(product_file)

    product_title = data["data"]["product"]["item"]["product_description"]["title"]
    clean_title = re.sub(r"&#\d+;|&\w+;", "", product_title)

    price_per_lb, unit_suffix = extract_price(data)
    ingredients = extract_ingredients_from_bullets(data)
    ingredient_modifier, ingredient_label = score_ingredients(ingredients)

    # USDA lookup for nutrition using product title keywords
    search_query = re.sub(r"[^a-zA-Z\s]", "", clean_title).strip()
    logger.info(f"USDA lookup: '{search_query}'")
    usda_food = usda_lookup(search_query)

    if usda_food:
        protein = get_nutrient(usda_food, "Protein")
        calories = get_nutrient(usda_food, "Energy")
        sodium = get_nutrient(usda_food, "Sodium")
        potassium = get_nutrient(usda_food, "Potassium")
        usda_name = usda_food.get("description", "Unknown")
    else:
        logger.warning("No USDA match found. Using zeroed nutrition values.")
        protein = calories = sodium = potassium = 0.0
        usda_name = "Not found"

    score = calculate_worth_it_index(
        price_per_lb=price_per_lb,
        protein_per_100g=protein,
        calories_per_100g=calories,
        sodium_mg_per_100g=sodium,
        potassium_mg_per_100g=potassium,
        ingredient_modifier=ingredient_modifier,
    )
    tier = worth_it_tier(score)

    print("\n" + "=" * 40)
    print("   BangBuck — WORTH-IT INDEX")
    print("=" * 40)
    print(f"Product:        {clean_title[:60]}")
    print(f"USDA Match:     {usda_name}")
    print(f"Price:          ${price_per_lb:.2f}{unit_suffix}")
    print("-" * 40)
    print(f"Protein:        {protein:.1f}g / 100g")
    print(f"Calories:       {calories:.0f} kcal / 100g")
    print(f"Sodium:         {sodium:.0f}mg / 100g")
    print(f"Potassium:      {potassium:.0f}mg / 100g")
    print(f"Ingredients:    {ingredient_label}")
    print("-" * 40)
    grams_per_lb = 453.592
    pppg = price_per_lb / ((protein / 100) * grams_per_lb) if protein > 0 else 0
    print(f"$/g protein:    ${pppg:.4f}")
    print(f"Worth-It Score: {score}")
    print(f"  >> TIER: {tier}")
    print("=" * 40 + "\n")


def score_product(product, usda_food: dict | None) -> dict:
    """Score a ProductResult using USDA nutrition data. Returns a complete scored result dict."""
    if usda_food:
        protein = get_nutrient(usda_food, "Protein")
        calories = get_nutrient(usda_food, "Energy")
        sodium = get_nutrient(usda_food, "Sodium")
        potassium = get_nutrient(usda_food, "Potassium")
    else:
        protein = calories = sodium = potassium = 0.0

    # Instacart doesn't expose ingredient lists; score as neutral (5-ingredient processed baseline)
    ingredient_modifier, ingredient_label = score_ingredients([])

    # Normalize price to $/lb for the scoring engine
    unit = product.unit.lower()
    price_per_lb = product.price_per_unit
    if "oz" in unit:
        price_per_lb = product.price_per_unit * 16
    elif "kg" in unit:
        price_per_lb = product.price_per_unit * 0.453592
    elif "100g" in unit or "per 100" in unit:
        price_per_lb = product.price_per_unit * 4.536

    # If no USDA data, return negative score (PROCESSED TRAP)
    if not usda_food:
        score = -0.1
    else:
        score = calculate_worth_it_index(
            price_per_lb=price_per_lb,
            protein_per_100g=protein,
            calories_per_100g=calories,
            sodium_mg_per_100g=sodium,
            potassium_mg_per_100g=potassium,
            ingredient_modifier=ingredient_modifier,
        )

    grams_per_lb = 453.592
    pppg = price_per_lb / ((protein / 100) * grams_per_lb) if protein > 0 else 0.0

    return {
        "store_name": product.store_name,
        "product_name": product.product_name,
        "price": product.price,
        "price_per_unit": product.price_per_unit,
        "unit": product.unit,
        "url": product.url,
        "protein_per_100g": protein,
        "calories_per_100g": calories,
        "sodium_per_100g": sodium,
        "potassium_per_100g": potassium,
        "ingredient_label": ingredient_label,
        "price_per_protein_gram": round(pppg, 4),
        "score": score,
        "tier": worth_it_tier(score),
    }


if __name__ == "__main__":
    parse_and_score()
