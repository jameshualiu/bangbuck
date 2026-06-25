import asyncio
import json
import logging
import math
import time
import urllib.parse
import urllib.request

from playwright.async_api import async_playwright
from playwright_stealth import Stealth

logger = logging.getLogger(__name__)

# Instacart retailer categories considered human food/grocery
_GROCERY_CATS = {"grocery", "alcohol", "convenience", "pharmacy", "specialty", "natural", "readymeals"}


def geocode_city(city: str) -> tuple[float, float]:
    params = urllib.parse.urlencode({"q": city, "format": "json", "limit": 1})
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "BangBuck/1.0 (educational project)"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        results = json.loads(resp.read())
    if not results:
        raise ValueError(f"City not found: {city}")
    lat, lng = float(results[0]["lat"]), float(results[0]["lon"])
    logger.info(f"Geocoded '{city}' → ({lat:.3f}, {lng:.3f})")
    return lat, lng


def haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 3958.8
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def geocode_store(store_name: str, user_lat: float, user_lng: float) -> tuple[float, float] | None:
    """Find coordinates for the nearest branch of a store chain near user location."""
    d = 0.3  # ~20 mile bounding box half-width
    params = urllib.parse.urlencode({
        "q": store_name,
        "format": "json",
        "limit": 1,
        "viewbox": f"{user_lng - d},{user_lat - d},{user_lng + d},{user_lat + d}",
        "bounded": 1,
    })
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "BangBuck/1.0 (educational project)"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            results = json.loads(resp.read())
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception:
        pass
    return None


def geocode_all_stores(stores: list[dict], user_lat: float, user_lng: float, radius_miles: float) -> list[dict]:
    """
    Geocode the first GEOCODE_LIMIT stores for map pins and distance display.
    All stores are returned — those beyond the geocoding limit have no coordinates.
    Geocoded stores within radius come first (sorted by distance); the rest follow.
    Respects Nominatim's 1 req/s rate limit.
    """
    GEOCODE_LIMIT = 20
    pinned, unpinned = [], []

    for i, store in enumerate(stores):
        if i < GEOCODE_LIMIT:
            coords = geocode_store(store["store_name"], user_lat, user_lng)
            time.sleep(1.1)
            if coords:
                dist = haversine_miles(user_lat, user_lng, coords[0], coords[1])
                if dist <= radius_miles:
                    pinned.append({**store, "lat": coords[0], "lng": coords[1], "distance_miles": round(dist, 1)})
                else:
                    unpinned.append({**store, "lat": None, "lng": None, "distance_miles": None})
            else:
                unpinned.append({**store, "lat": None, "lng": None, "distance_miles": None})
        else:
            unpinned.append({**store, "lat": None, "lng": None, "distance_miles": None})

    pinned.sort(key=lambda s: s["distance_miles"])
    logger.info(f"Returning {len(pinned)} pinned + {len(unpinned)} unpinned stores ({len(stores)} total from Instacart)")
    return pinned + unpinned


async def find_instacart_stores(lat: float, lng: float, zip_code: str) -> list[dict]:
    """
    Navigate to Instacart homepage and intercept HomepageShopCollection to get
    nearby grocery retailers. Non-grocery retailers (pets, hardware, etc.) are filtered out.
    Returns list of {store_name, store_id, slug, retailer_location_id, zip_code} dicts.
    """
    captured_stores = []
    seen_retailer_ids = set()

    async def handle_response(response):
        if response.status != 200 or "instacart.com" not in response.url:
            return
        if "graphql" not in response.url and "HomepageShopCollection" not in response.url:
            return
        try:
            body = await response.json()
            shops = body.get("data", {}).get("shopCollection", {}).get("shops", [])
            if not shops:
                return
            logger.debug(f"Captured HomepageShopCollection: {len(shops)} shops")
            for shop in shops:
                retailer = shop.get("retailer", {})
                name = retailer.get("name", "")
                slug = retailer.get("slug", "")
                retailer_id = retailer.get("id", "")
                shop_id = shop.get("id", "")
                location_id = shop.get("retailerLocationId", "")
                categories = retailer.get("categories", [])
                retailer_type = retailer.get("retailerType", "").lower()

                # Skip non-food retailers (pets, hardware, flowers, etc.)
                is_food = (
                    any(c in _GROCERY_CATS for c in categories)
                    or "grocery" in retailer_type
                    or "specialty" in retailer_type
                    or "natural" in retailer_type
                    or "convenience" in retailer_type
                )
                if not is_food:
                    logger.debug(f"Skipping non-food retailer: {name} (categories={categories})")
                    continue

                if retailer_id and retailer_id not in seen_retailer_ids:
                    seen_retailer_ids.add(retailer_id)
                    captured_stores.append({
                        "store_name": name,
                        "store_id": shop_id,
                        "slug": slug,
                        "retailer_location_id": location_id,
                        "zip_code": zip_code,
                    })
        except Exception as e:
            logger.error(f"Failed to parse HomepageShopCollection: {e}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        await context.add_cookies([
            {"name": "postal_code", "value": zip_code, "domain": ".instacart.com", "path": "/", "sameSite": "Lax"},
        ])
        page = await context.new_page()
        await Stealth().apply_stealth_async(page)
        page.on("response", handle_response)

        logger.info(f"Finding Instacart stores for zip {zip_code}...")
        await page.goto(f"https://www.instacart.com/?postalCode={zip_code}", timeout=60000, wait_until="load")
        await asyncio.sleep(5)
        await browser.close()

    logger.info(f"Found {len(captured_stores)} grocery retailers")
    return captured_stores
