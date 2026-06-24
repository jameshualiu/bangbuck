from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db import engine, Base
import models  # registers ORM models with Base
from auth import router as auth_router
from routes.stores import router as stores_router
from routes.search import router as search_router
from routes.list import router as list_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="BangBuck API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(stores_router)
app.include_router(search_router)
app.include_router(list_router)

@app.get("/health")
def health():
    return {"status": "ok"}
