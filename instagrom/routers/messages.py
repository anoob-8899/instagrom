from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from instagrom.database import get_db
from instagrom.models import User
from instagrom.auth import get_current_user_required
from instagrom.messaging import (
    getUserConversations,
    getOrCreateConversation,
    isUserConversationParticipant,
)
from instagrom.routers.conversations import (
    get_conversation_messages,
    send_conversation_message,
    mark_conversation_read,
    SendMessagePayload,
)

router = APIRouter(prefix="/api/messages", tags=["messages"])

class DirectMessagePayload(BaseModel):
    conversationId: Optional[str] = None
    recipientUsername: Optional[str] = None
    recipientId: Optional[str] = None
    content: str

@router.get("")
def list_messages_conversations(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    conversations = getUserConversations(db, current_user.id)
    return {"conversations": conversations}

@router.post("", status_code=status.HTTP_201_CREATED)
def send_direct_message(
    payload: DirectMessagePayload,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    target_conv_id = payload.conversationId

    if not target_conv_id:
        target_user_id = payload.recipientId
        if not target_user_id and payload.recipientUsername:
            u = db.query(User).filter(User.username == payload.recipientUsername.strip().lower()).first()
            if not u:
                raise HTTPException(status_code=404, detail="Recipient not found")
            target_user_id = u.id

        if not target_user_id:
            raise HTTPException(status_code=400, detail="conversationId or recipient is required")

        conv = getOrCreateConversation(db, current_user.id, target_user_id)
        target_conv_id = conv.id

    res = send_conversation_message(
        id=target_conv_id,
        payload=SendMessagePayload(content=payload.content),
        current_user=current_user,
        db=db,
    )
    return {
        "message": res["message"],
        "conversationId": target_conv_id,
    }

@router.get("/{conversationId}")
def get_messages(
    conversationId: str,
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[str] = None,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    return get_conversation_messages(
        id=conversationId,
        limit=limit,
        cursor=cursor,
        current_user=current_user,
        db=db,
    )

@router.patch("/{conversationId}/read")
@router.post("/{conversationId}/read")
def read_messages(
    conversationId: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    return mark_conversation_read(
        id=conversationId,
        current_user=current_user,
        db=db,
    )
