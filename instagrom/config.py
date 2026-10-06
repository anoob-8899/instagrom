import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Database configuration
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
SQLITE_PATH = DATA_DIR / "instagrom.sqlite"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{SQLITE_PATH.as_posix()}")

# Uploads configuration
UPLOADS_DIR = BASE_DIR / "public" / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
(UPLOADS_DIR / "posts").mkdir(parents=True, exist_ok=True)
(UPLOADS_DIR / "profiles").mkdir(parents=True, exist_ok=True)
(UPLOADS_DIR / "stories").mkdir(parents=True, exist_ok=True)

# Session configuration
SESSION_COOKIE_NAME = "instagrom_session"
SESSION_MAX_AGE_DAYS = 7
SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

# Server configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "3000"))
