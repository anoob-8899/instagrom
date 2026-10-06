from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from instagrom.database import Base, engine
from instagrom.config import UPLOADS_DIR, BASE_DIR
from instagrom.routers import (
    auth,
    posts,
    conversations,
    messages,
    notifications,
    presence,
    realtime,
    users,
    search,
    stories,
    upload,
)

# Ensure all tables exist in SQLite
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="INSTAGROM",
    description="Classroom Local Area Network (LAN) Social Media Platform (Python Host)",
    version="1.0.0",
)

# CORS middleware for LAN and client cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static directories
STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
INDEX_HTML = STATIC_DIR / "index.html"

# Exception handlers for uniform error format
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )

# Include API Routers
app.include_router(auth.router)
app.include_router(posts.router)
app.include_router(conversations.router)
app.include_router(messages.router)
app.include_router(notifications.router)
app.include_router(presence.router)
app.include_router(realtime.router)
app.include_router(users.router)
app.include_router(search.router)
app.include_router(stories.router)
app.include_router(upload.router)

# Mount static uploads directory for photos and stories
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Mount client static assets (js, css)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/api/health")
def health_check():
    return {"status": "ok", "platform": "INSTAGROM Python Server"}

# Root & Web SPA Routes
@app.get("/", response_class=HTMLResponse)
@app.get("/feed", response_class=HTMLResponse)
@app.get("/login", response_class=HTMLResponse)
@app.get("/register", response_class=HTMLResponse)
@app.get("/messages", response_class=HTMLResponse)
@app.get("/messages/{conversationId}", response_class=HTMLResponse)
@app.get("/notifications", response_class=HTMLResponse)
@app.get("/profile/{username}", response_class=HTMLResponse)
@app.get("/search", response_class=HTMLResponse)
def serve_spa():
    if INDEX_HTML.exists():
        return FileResponse(str(INDEX_HTML))
    return HTMLResponse("<h1>INSTAGROM Python Server is Running</h1>", status_code=200)
