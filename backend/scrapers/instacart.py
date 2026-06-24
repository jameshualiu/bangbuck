import asyncio
import logging
import re
import urllib.parse
from playwright.async_api import async_playwright
from playwright_stealth import Stealth
from .base import ProductResult

logger = logging.getLogger(__name__)

DEFAULT_SLUGS = ["safeway", "kroger", "whole-foods", "aldi", "target"]


class InstacartScraper:
    def search(self, query: str, zip_code: str, slugs: list[str] | None = None) -> list[ProductResult]:
        return asyncio.run(self._search_async(query, zip_code, slugs or DEFAULT_SLUGS))

    async def _search_async(self, query: str, zip_code: str, slugs: list[str]) -> list[ProductResult]:
        sem = asyncio.Semaphore(3)

        async def bounded_search(slug: str) -> list[ProductResult]:
            async with sem:
                try:
                    return await self._search_store(query, zip_code, slug)
                except Exception as e:
                    logger.warning(f"Skipping {slug} due to error: {e}")
                    return []

        nested = await asyncio.gather(*[bounded_search(s) for s in slugs])
        results = [item for sublist in nested for item in sublist]
        logger.info(f"Total products found: {len(results)}")
        return results

    async def _search_store(self, query: str, zip_code: str, slug: str) -> list[ProductResult]:
        results: list[ProductResult] = []
        response_tasks: set[asyncio.Task] = set()

        async def process_response(response):
            try:
                body = await response.json()
                items = body.get("data", {}).get("items", [])
                for item in items:
                    product = _parse_item(item, slug, query)
                    if product and _is_relevant(product.product_name, query):
                        results.append(product)
            except Exception as e:
                logger.error(f"Failed to parse Items for {slug}: {e}")

        def handle_response(response):
            if response.status != 200 or "instacart.com" not in response.url:
                return
            if "operationName=Items" not in response.url:
                return
            task = asyncio.ensure_future(process_response(response))
            response_tasks.add(task)
            task.add_done_callback(response_tasks.discard)

        try:
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

                search_url = f"https://www.instacart.com/store/{slug}/s?q={urllib.parse.quote_plus(query)}"
                logger.info(f"Searching {slug}: {search_url}")
                try:
                    await page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
                    await asyncio.sleep(6)
                except Exception as e:
                    logger.warning(f"Failed to load {slug}: {e}")

                if response_tasks:
                    await asyncio.gather(*response_tasks, return_exceptions=True)
                await browser.close()
        except Exception as e:
            logger.error(f"Browser error for {slug}: {e}")

        logger.info(f"  {slug}: {len(results)} products")
        return results


def _parse_item(item: dict, store_name: str, query: str = "") -> ProductResult | None:
    name = item.get("name", "")
    if not name:
        return None

    # Price lives at price.viewSection.itemCard (as of 2026-06)
    item_card = item.get("price", {}).get("viewSection", {}).get("itemCard", {})
    price_str = item_card.get("priceString", "")
    per_unit_str = item_card.get("pricingUnitString", "")  # e.g. "$4.09 / lb"

    try:
        # priceString can be "$8.70" or "$34.36 /pkg (est.)" — take the first token
        price = float(re.sub(r"[^\d.]", "", price_str.split()[0])) if price_str else 0.0
    except (ValueError, IndexError):
        price = 0.0

    if price <= 0:
        return None

    # Check availability
    if not item.get("availability", {}).get("available", True):
        return None

    size = item.get("size", "")

    price_per_unit, unit = _extract_unit_price(price, size, per_unit_str)

    return ProductResult(
        store_name=store_name.replace("-", " ").title(),
        product_name=name,
        price=price,
        price_per_unit=price_per_unit,
        unit=unit,
        url=f"https://www.instacart.com/store/{store_name}/s?q={urllib.parse.quote_plus(query)}",
    )


def _is_relevant(product_name: str, query: str) -> bool:
    """Return True if the product name contains at least one meaningful word from the query."""
    stopwords = {"and", "or", "the", "a", "an", "in", "of", "with", "for"}
    query_words = [w for w in re.split(r'\s+', query.lower()) if len(w) > 2 and w not in stopwords]
    name_lower = product_name.lower()
    return any(word in name_lower for word in query_words)


def _extract_unit_price(price: float, size: str, per_unit_str: str) -> tuple[float, str]:
    """Extract price-per-unit and unit label. Falls back to total price if unknown."""
    # Try parsing per_unit_str like "$4.49/lb" or "$0.32/oz"
    if per_unit_str:
        match = re.search(r'\$?([\d.]+)\s*/\s*(\w+)', per_unit_str)
        if match:
            return float(match.group(1)), match.group(2)

    # Try inferring unit from size field like "2 lb", "16 oz", "1 each"
    if size:
        size_lower = size.lower()
        for unit in ["lb", "oz", "kg", "g", "ct", "ea", "each", "fl oz"]:
            if unit in size_lower:
                match = re.search(r'([\d.]+)\s*' + re.escape(unit), size_lower)
                if match:
                    qty = float(match.group(1))
                    if qty > 0:
                        return round(price / qty, 4), unit

    return price, "ea"
