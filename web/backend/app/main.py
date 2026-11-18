from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

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


@app.middleware("http")
async def bound_answer_request_body(request: Request, call_next):  # type: ignore[no-untyped-def]
    if request.url.path == "/v1/answers" and request.method == "POST":
        declared = request.headers.get("content-length")
        if declared and (not declared.isdigit() or int(declared) > 16_384):
            return JSONResponse(
                status_code=413, content={"detail": "Request body is too large."}
            )
        body = await request.body()
        if len(body) > 16_384:
            return JSONResponse(
                status_code=413, content={"detail": "Request body is too large."}
            )
    return await call_next(request)


app.include_router(api_router)


@app.get("/healthz", tags=["health"])
async def healthcheck() -> dict:
    return {"status": "ok"}
