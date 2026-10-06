import time
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from instagrom.database import get_db
from instagrom.models import User
from instagrom.auth import get_current_user_required
from instagrom.presence import record_presence_heartbeat, get_users_presence

router = APIRouter(prefix="/api/presence", tags=["presence"])

@router.post("/heartbeat")
def presence_heartbeat(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    record_presence_heartbeat(db, current_user.id)
    return {"success": True, "timestamp": int(time.time() * 1000)}

@router.get("")
def query_presence(
    userIds: Optional[str] = Query(None, description="Comma-separated user IDs"),
    db: Session = Depends(get_db),
):
    if not userIds:
        return {}
    ids = [uid.strip() for uid in userIds.split(",") if uid.strip()]
    return get_users_presence(db, ids)
