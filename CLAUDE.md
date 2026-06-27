# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: BangBuck (The "Worth-It" Index)

A nutritional arbitrage pipeline that scrapes grocery prices from Instacart across nearby stores, evaluates protein density, ingredient quality, and electrolyte balance, then ranks items into a tier list (e.g., "Elite Fuel", "Budget Compromise", "Processed Trap").

## Tech Stack

- **Scraping:** `playwright` + `playwright-stealth` (headless Chromium)
- **Store data:** Instacart GraphQL API interception (covers Safeway, Kroger, Whole Foods, Aldi, Target, and more)
- **Nutrition:** USDA FoodData Central API (free, DEMO_KEY works for dev)
- **Geocoding:** Nominatim / OpenStreetMap (no key required)
- **Backend:** FastAPI + SQLite (SQLAlchemy) + JWT auth (python-jose + passlib/bcrypt)
- **Frontend:** React (Vite) + TailwindCSS + Leaflet

Phase 3 (future): Redis + Celery for background jobs, PostgreSQL, order/delivery integration.

## Setup

```bash
pip install -r requirements.txt
playwright install chromium
```

## Running

```bash
# Backend (from backend/)
uvicorn main:app --reload

# Frontend (from frontend/)
npm run dev
```

## Tests

Tests are gitignored for now. Run with:

```bash
pytest tests/ -v
```

All tests make live network calls (Nominatim geocoding, Instacart store loading). No mocking.

## Architecture

```
backend/
  main.py              ← FastAPI app + CORS
  auth.py              ← /auth/register, /auth/login (JWT)
  deps.py              ← get_current_user dependency
  db.py                ← SQLite engine + session (SQLAlchemy)
  models.py            ← User, ShoppingListItem ORM models
  routes/
    stores.py          ← POST /stores/find
    search.py          ← POST /search
    list.py            ← GET/POST/DELETE /list/items
  locator.py           ← geocode_city() + find_instacart_stores()
  scrapers/
    instacart.py       ← InstacartScraper (GraphQL interception)
    base.py            ← BaseScraper
  parser.py            ← USDA lookup + Worth-It scoring
frontend/
  src/
    pages/
      Login.jsx, Register.jsx
      LocationPicker.jsx   ← Leaflet map + radius slider
      StoreSearch.jsx      ← store checkboxes + search bar
      Results.jsx          ← scored tier cards, inline re-search bar, location picker dropdown
      ShoppingList.jsx     ← saved items per user
    components/
      Map.jsx, ProductCard.jsx
      Navbar.jsx           ← shared app header (72px sticky, avatar, sign-out dropdown, optional center slot)
    **Location autocomplete (`LocationPicker.jsx`):**
    - On input focus (empty): shows up to 5 recent locations from `bangbuck_recent_locations` localStorage (clock icon, label + zip subtitle)
    - On input change (≥ 2 chars, debounced 350ms): calls Nominatim `/search?q=...&format=json&addressdetails=1&limit=5`, shows results (pin icon, "Powered by OpenStreetMap" credit)
    - Selecting a suggestion fills the input, sets `label` to the same value (so `handleFindStores` skips re-geocoding), and moves the map pin immediately
    - Keyboard: ↑↓ navigate, Enter selects highlighted item or submits, Escape closes
    - Click-outside detected via `mousedown` listener on `document`
    api.js               ← axios instance with auto JWT header
    App.jsx              ← React Router v6; only /list requires auth
```

**Data flow:** Picks location (Leaflet map) → zip code → POST /stores/find → store list → selects stores + enters query → POST /search → USDA lookup + Worth-It scoring → ranked results → (optional) user logs in + saves items → POST /list/items → SQLite.

**Auth:** `/`, `/stores`, `/results` are public. `/list` requires a JWT token. Saving items from Results redirects to `/login` if unauthenticated.

**Recent locations:** Stored in `localStorage` under `bangbuck_recent_locations` (max 5, deduped by zip code). Written in `StoreSearch` on successful search; read in `Results` location dropdown.

**Test imports:** Tests run from repo root. Import as `sys.path.insert(0, 'backend')` or run pytest with `--rootdir=backend`.

## Commit Message Conventions

Use conventional commits. Format: `<type>: <short imperative description>`

| Type | When to use |
|---|---|
| `feat` | New user-facing feature or behaviour |
| `fix` | Bug fix |
| `refactor` | Code change with no behaviour change (e.g. moving logic, renaming) |
| `style` | UI/CSS-only changes with no logic change |
| `chore` | Tooling, deps, config (no production code change) |
| `docs` | Documentation only |

Rules:
- Lowercase, no period at the end
- Imperative mood: "add X", not "added X" or "adds X"
- Keep the subject line under 72 characters
- If the change is broad, split it into multiple focused commits rather than one large one

## Worth-It Scoring Engine

Weighted 0–1 score across four criteria:

| Criterion | Weight | Logic |
|---|---|---|
| Protein density | 35% | Target: 1g protein / 10 cal. Penalty for >1:20 ratio |
| Whole food modifier | 30% | Bonus for 1-ingredient foods, penalty for ultra-processed additives |
| Cost efficiency | 25% | Price per gram of protein. $0.05/g = excellent, $0.20/g = poor |
| Electrolyte balance | 10% | Bonus for K:Na ratio ≥ 2:1 |

Tiers: ELITE FUEL (≥0.8), SOLID CHOICE (≥0.5), BUDGET COMPROMISE (≥0.2), USE SPARINGLY (≥0.0), PROCESSED TRAP (<0.0)

## Instacart Scraper Notes

The scraper intercepts Instacart's internal GraphQL API — no official API key needed.

**If the scraper stops returning results:**
1. Run `python tests/discover_instacart.py` — saves captured responses for inspection
2. Check `tests/instacart_endpoints.md` for current endpoint documentation
3. In `locator.py`: update the string matched in `handle_response` (`operationName=HomepageShopCollection`)
4. In `scrapers/instacart.py`: update `operationName=Items` and the JSON parsing path `data.items[]`; also confirm `postal_code` cookie is set on the browser context with the user's zip code

**Key GraphQL operations:**
- Store discovery: `HomepageShopCollection` → `data.shopCollection.shops[]`
- Product search: `SearchResultsPlacements` fires first (layout); then `Items` fires repeatedly with actual products → `data.items[]` (price at `price.viewSection.itemCard.priceString`)
- **Critical:** without the `postal_code` cookie, Instacart returns zero results and `Items` never fires
- Item IDs format: `items_{retailerLocationId}-{productId}`
