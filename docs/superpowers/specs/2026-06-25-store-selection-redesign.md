# Store Selection Redesign

**Date:** 2026-06-25  
**Scope:** `frontend/src/pages/StoreSearch.jsx` only — no backend changes

## Problem

The current store list is a flat 2-col grid of every store returned. With 15–20+ results this is overwhelming. Most users shop at a handful of chains, but deals can hide at less familiar ones — so nothing should be hidden entirely.

## Design

### Layout (control panel, right pane)

1. **Top chains section** — 2-col grid of toggle cards, one per unique chain, up to 4 chains
2. **"View more stores (N)" expander** — inline expand, only shown when there are stores outside the top 4 chains
3. **Expanded list** — search input + scrollable checkbox list of the remaining stores

### Chain detection

Derive chain name by stripping trailing branch identifiers from `store_name`:
- Strip ` #\d+` suffixes (e.g. "Safeway #1234" → "Safeway")
- Strip ` - .*` suffixes (e.g. "Whole Foods - Downtown" → "Whole Foods")
- Group by the normalized name

Top 4 chains are chosen by the **closest store distance** for each chain (ascending). If fewer than 4 unique chains exist, show all of them.

### Chain card behaviour

- Displays: chain name, number of locations, closest distance in miles
- **Active state** (purple border + tint): all stores for that chain are in `selected`
- **Partial state** (purple border, no tint, dot indicator): some but not all stores selected — can happen when user manually unchecks a store in the expanded list
- **Inactive state** (grey border, white bg): no stores selected
- Clicking an inactive or partial card → adds all slugs for that chain to `selected`
- Clicking an active card → removes all slugs for that chain from `selected`

### "View more stores" expander

- Label: `View more stores (N)` where N is the count of stores NOT belonging to the top 4 chains
- Dashed border signals it is optional / secondary
- Clicking toggles `expandedMore` boolean
- Arrow rotates 180° when expanded

### Expanded list

- Search input at the top filters by store name (case-insensitive substring)
- Stores sorted by `distance_miles` ascending
- Each row: checkbox + store name + distance
- Checkbox state directly maps to `selected` set — toggling a single store here can put a chain card into partial state
- Max height `180px`, overflow scroll

### State additions to `StoreSearch`

| Variable | Type | Purpose |
|---|---|---|
| `topChains` | derived (memo) | Array of `{ chainName, slugs, closestMile, count }` for top 4 chains |
| `otherStores` | derived (memo) | Stores not belonging to a top-chain |
| `expandedMore` | `useState(false)` | Whether the expander is open |
| `moreSearch` | `useState('')` | Filter string for the expanded list |

`selected` (Set of slugs) is unchanged — it remains the source of truth passed to the search API.

### Initial selection

All stores start selected (same as current behaviour) so the user can just hit Search immediately.

### No backend changes

The API contract (`POST /search` with `{ query, zip_code, slugs }`) is unchanged. This is purely a presentation layer change.

## Out of scope

- Persisting store preferences across sessions
- Chain logo images
- Map pin highlighting per chain
