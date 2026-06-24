from locator import geocode_city
import pytest
import asyncio


def test_geocode_known_city():
    lat, lng = geocode_city("Atlanta, GA")
    # Atlanta is roughly 33.7°N, 84.4°W
    assert 33.0 < lat < 34.5
    assert -85.0 < lng < -84.0


def test_geocode_invalid_city():
    with pytest.raises(ValueError, match="City not found"):
        geocode_city("Zzzznotacityzzz")


def test_find_instacart_stores_returns_list():
    from locator import find_instacart_stores
    stores = asyncio.run(find_instacart_stores(33.749, -84.388, "30301"))
    assert isinstance(stores, list)
    assert len(stores) > 0
    first = stores[0]
    assert "store_name" in first
    assert "store_id" in first


def test_find_instacart_stores_have_names():
    from locator import find_instacart_stores
    stores = asyncio.run(find_instacart_stores(33.749, -84.388, "30301"))
    names = [s["store_name"] for s in stores]
    assert any(name for name in names)
