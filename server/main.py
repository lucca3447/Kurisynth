import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import APP_TITLE, APP_VERSION, APP_DESCRIPTION
from app.core.lifespan import lifespan
from app.api.v1.router import api_router

app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description=APP_DESCRIPTION,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Primary API endpoints prefixed with /api
app.include_router(api_router, prefix="/api")

# Root fallback route mapping for complete backward compatibility
app.include_router(api_router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
