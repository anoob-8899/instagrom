import os
import uuid
import aiofiles
from pathlib import Path
from fastapi import UploadFile, HTTPException
from instagrom.config import UPLOADS_DIR

ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB

async def save_uploaded_image(file: UploadFile, category: str = "posts") -> str:
    if category not in {"posts", "profiles", "stories"}:
        raise HTTPException(status_code=400, detail="Invalid upload category")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = Path(file.filename).suffix.lower()
    if not ext:
        ext = ".jpg"

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Invalid file extension. Allowed: .jpg, .jpeg, .png, .webp, .gif",
        )

    if file.content_type and file.content_type.lower() not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid image format. Allowed: JPEG, PNG, WEBP, GIF.",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")

    unique_filename = f"{uuid.uuid4().hex}{ext}"
    target_dir = UPLOADS_DIR / category
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / unique_filename

    async with aiofiles.open(target_path, "wb") as f:
        await f.write(content)

    return f"/uploads/{category}/{unique_filename}"
