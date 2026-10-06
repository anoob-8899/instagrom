from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from instagrom.database import get_db
from instagrom.models import User, Conversation, ConversationParticipant, Message, Notification
from instagrom.auth import get_current_user_required
from instagrom.messaging import (
    getUserConversations,
    getOrCreateConversation,
    isUserConversationParticipant,
)
from instagrom.notifications import create_notification
from instagrom.realtime import realtime_hub

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

class OpenConversationPayload(BaseModel):
    recipientUsername: Optional[str] = None
    recipientId: Optional[str] = None

class SendMessagePayload(BaseModel):
    content: str

def format_message(m: Message):
    return {
        "id": m.id,
        "conversationId": m.conversationId,
        "senderId": m.senderId,
        "content": m.content,
        "readAt": m.readAt.isoformat() if m.readAt else None,
        "createdAt": m.createdAt.isoformat() if m.createdAt else None,
        "updatedAt": m.updatedAt.isoformat() if m.updatedAt else None,
        "sender": {
            "id": m.sender.id,
            "username": m.sender.username,
            "displayName": m.sender.displayName,
            "profilePhoto": m.sender.profilePhoto,
        } if m.sender else None,
    }

@router.get("")
def list_conversations(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    conversations = getUserConversations(db, current_user.id)
    return {"conversations": conversations}

@router.post("")
def open_conversation(
    payload: OpenConversationPayload,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    target_user_id = payload.recipientId
    if not target_user_id and payload.recipientUsername:
        user = db.query(User).filter(User.username == payload.recipientUsername.strip().lower()).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        target_user_id = user.id

    if not target_user_id:
        raise HTTPException(status_code=400, detail="recipientUsername or recipientId is required")

    if target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    conv = getOrCreateConversation(db, current_user.id, target_user_id)
    return {
        "conversation": {
            "id": conv.id,
            "createdAt": conv.createdAt.isoformat() if conv.createdAt else None,
            "updatedAt": conv.updatedAt.isoformat() if conv.updatedAt else None,
        }
    }

@router.get("/{id}/messages")
def get_conversation_messages(
    id: str,
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[str] = None,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    if not isUserConversationParticipant(db, id, current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden: Not a participant in this conversation")

    query = db.query(Message).filter(Message.conversationId == id)
    if cursor:
        cursor_msg = db.query(Message).filter(Message.id == cursor).first()
        if cursor_msg:
            query = query.filter(Message.createdAt < cursor_msg.createdAt)
        messages = query.order_by(Message.createdAt.asc()).limit(limit).all()
    else:
        raw = query.order_by(desc(Message.createdAt)).limit(limit).all()
        raw.reverse()
        messages = raw

    return {"messages": [format_message(m) for m in messages]}

@router.post("/{id}/messages", status_code=status.HTTP_201_CREATED)
def send_conversation_message(
    id: str,
    payload: SendMessagePayload,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    if not isUserConversationParticipant(db, id, current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden: Cannot send messages to this conversation")

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty")
    if len(content) > 2000:
        raise HTTPException(status_code=400, detail="Message cannot exceed 2,000 characters")

    new_msg = Message(
        conversationId=id,
        senderId=current_user.id,
        content=content,
    )
    db.add(new_msg)

    # Update conversation timestamp
    conv = db.query(Conversation).filter(Conversation.id == id).first()
    if conv:
        conv.updatedAt = datetime.utcnow()

    db.commit()
    db.refresh(new_msg)

    formatted = format_message(new_msg)

    # Notify other participants
    participants = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversationId == id,
            ConversationParticipant.userId != current_user.id,
        )
        .all()
    )

    for p in participants:
        create_notification(
            db=db,
            recipient_id=p.userId,
            actor_id=current_user.id,
            notif_type="MESSAGE",
            conversation_id=id,
            message_id=new_msg.id,
        )
        realtime_hub.emit_to_user(
            p.userId,
            "NEW_MESSAGE",
            {
                "conversationId": id,
                "message": formatted,
            },
        )

    return {"message": formatted}

@router.patch("/{id}/read")
@router.post("/{id}/read")
def mark_conversation_read(
    id: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    if not isUserConversationParticipant(db, id, current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")

    now = datetime.utcnow()

    # Mark unread messages sent by others as read
    unread_messages = (
        db.query(Message)
        .filter(
            Message.conversationId == id,
            Message.senderId != current_user.id,
            Message.readAt.is_(None),
        )
        .all()
    )
    for m in unread_messages:
        m.readAt = now

    # Update lastReadAt
    part = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversationId == id,
            ConversationParticipant.userId == current_user.id,
        )
        .first()
    )
    if part:
        part.lastReadAt = now

    # Mark message notifications as read
    notifs = (
        db.query(Notification)
        .filter(
            Notification.recipientId == current_user.id,
            Notification.conversationId == id,
            Notification.readAt.is_(None),
        )
        .all()
    )
    for n in notifs:
        n.readAt = now

    db.commit()

    # Notify other participants
    other_parts = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversationId == id,
            ConversationParticipant.userId != current_user.id,
        )
        .all()
    )
    for op in other_parts:
        realtime_hub.emit_to_user(
            op.userId,
            "MESSAGE_READ",
            {
                "conversationId": id,
                "readByUserId": current_user.id,
                "readAt": now.isoformat(),
            },
        )

    return {"success": True, "markedCount": len(unread_messages)}
