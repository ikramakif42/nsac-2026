"""
ORBIT-LENS Backend — FastAPI Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app = FastAPI(
    title="ORBIT-LENS API",
    description="SPHEREx multi-epoch infrared sky explorer backend",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
from app.routers import search, cutout, spectrum, quality, compare  # noqa: E402

app.include_router(search.router)
app.include_router(cutout.router)
app.include_router(spectrum.router)
app.include_router(quality.router)
app.include_router(compare.router)


@app.get("/health")
def health():
    return {"status": "ok", "release": os.getenv("RELEASE", "qr3")}

