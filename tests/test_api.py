import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from db import Base, get_db
from main import app

TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=TEST_ENGINE)
    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)
    app.dependency_overrides.clear()

def test_api_health():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_register_and_login():
    client = TestClient(app)
    payload = {"email": "test@example.com", "password": "hunter22"}
    r = client.post("/auth/register", json=payload)
    assert r.status_code == 200
    assert "access_token" in r.json()

    r2 = client.post("/auth/login", json=payload)
    assert r2.status_code == 200
    assert "access_token" in r2.json()

def test_duplicate_register():
    client = TestClient(app)
    payload = {"email": "dup@example.com", "password": "abc12345"}
    client.post("/auth/register", json=payload)
    r = client.post("/auth/register", json=payload)
    assert r.status_code == 400

def test_wrong_password():
    client = TestClient(app)
    client.post("/auth/register", json={"email": "x@x.com", "password": "correctpass"})
    r = client.post("/auth/login", json={"email": "x@x.com", "password": "wrongpass"})
    assert r.status_code == 401

def _get_token(client):
    import time
    email = f"user_{time.time()}@example.com"
    r = client.post("/auth/register", json={"email": email, "password": "password123"})
    return r.json()["access_token"]

def test_list_empty_by_default():
    client = TestClient(app)
    token = _get_token(client)
    r = client.get("/list/items", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json() == []

def test_add_and_delete_item():
    client = TestClient(app)
    token = _get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    item = {
        "product_name": "Chicken Breast",
        "store_name": "Whole Foods",
        "price": 9.99,
        "score": 0.85,
        "tier": "ELITE FUEL",
        "url": "https://example.com"
    }
    r = client.post("/list/items", json=item, headers=headers)
    assert r.status_code == 201
    item_id = r.json()["id"]

    r2 = client.get("/list/items", headers=headers)
    assert len(r2.json()) == 1
    assert r2.json()[0]["product_name"] == "Chicken Breast"

    r3 = client.delete(f"/list/items/{item_id}", headers=headers)
    assert r3.status_code == 204

    r4 = client.get("/list/items", headers=headers)
    assert r4.json() == []

def test_cannot_delete_other_users_item():
    client = TestClient(app)
    token_a = _get_token(client)
    token_b = _get_token(client)
    item = {
        "product_name": "Eggs",
        "store_name": "Aldi",
        "price": 3.99,
        "score": 0.6,
        "tier": "SOLID CHOICE",
        "url": "https://example.com"
    }
    r = client.post("/list/items", json=item, headers={"Authorization": f"Bearer {token_a}"})
    item_id = r.json()["id"]
    r2 = client.delete(f"/list/items/{item_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert r2.status_code == 404

def test_unauthenticated_list_access():
    client = TestClient(app)
    r = client.get("/list/items")
    assert r.status_code in (401, 403)  # HTTPBearer returns 401 in FastAPI 0.125+

def test_cannot_read_other_users_items():
    client = TestClient(app)
    token_a = _get_token(client)
    token_b = _get_token(client)
    client.post(
        "/list/items",
        json={"product_name": "Secret Item", "store_name": "Store A"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    r = client.get("/list/items", headers={"Authorization": f"Bearer {token_b}"})
    assert r.status_code == 200
    assert r.json() == []
