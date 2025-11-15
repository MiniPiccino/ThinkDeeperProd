from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router as api_router
from .config import get_settings

settings = get_settings()

app = FastAPI(
    title="ThinkDeeper API",
    version="0.1.0",
    description="Backend services for the Thinkle production application.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/healthz", tags=["health"])
async def healthcheck() -> dict:
    return {"status": "ok"}
