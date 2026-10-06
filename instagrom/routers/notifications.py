from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from instagrom.database import get_db
from instagrom.models import User, Notification, ConversationParticipant, Message
from instagrom.auth import get_current_user_required
from instagrom.notifications import format_notification

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("")
def get_notifications(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    notifs = (
        db.query(Notification)
        .filter(Notification.recipientId == current_user.id)
        .order_by(desc(Notification.createdAt))
        .limit(50)
        .all()
    )
    return {"notifications": [format_notification(n) for n in notifs]}

@router.get("/unread-count")
def get_unread_counts(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    unread_notifs = (
        db.query(Notification)
        .filter(
            Notification.recipientId == current_user.id,
            Notification.readAt.is_(None),
        )
        .count()
    )

    # Unread messages across user conversations
    conv_ids = [
        cp.conversationId
        for cp in db.query(ConversationParticipant.conversationId)
        .filter(ConversationParticipant.userId == current_user.id)
        .all()
    ]

    unread_messages = 0
    if conv_ids:
        unread_messages = (
            db.query(Message)
            .filter(
                Message.conversationId.in_(conv_ids),
                Message.senderId != current_user.id,
                Message.readAt.is_(None),
            )
            .count()
        )

    return {
        "unreadNotifications": unread_notifs,
        "unreadMessages": unread_messages,
    }

@router.post("/read-all")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    unread = (
        db.query(Notification)
        .filter(
            Notification.recipientId == current_user.id,
            Notification.readAt.is_(None),
        )
        .all()
    )
    for n in unread:
        n.readAt = now
    db.commit()

    return {"success": True, "count": len(unread)}

@router.patch("/{id}/read")
@router.post("/{id}/read")
def mark_single_notification_read(
    id: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    notif = db.query(Notification).filter(Notification.id == id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    if notif.recipientId != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    notif.readAt = datetime.utcnow()
    db.commit()
    db.refresh(notif)

    return {"success": True, "notification": format_notification(notif)}
