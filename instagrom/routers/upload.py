from fastapi import APIRouter, Depends, UploadFile, File, Form, status
from instagrom.models import User
from instagrom.auth import get_current_user_required
from instagrom.storage import save_uploaded_image

router = APIRouter(prefix="/api/upload", tags=["upload"])

@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    category: str = Form("posts"),
    current_user: User = Depends(get_current_user_required),
):
    url = await save_uploaded_image(file, category)
    return {
        "success": True,
        "url": url,
    }
