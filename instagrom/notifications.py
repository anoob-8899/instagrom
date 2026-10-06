from typing import Optional, Any, Dict
from sqlalchemy.orm import Session
from instagrom.models import Notification, User, Post
from instagrom.realtime import realtime_hub

def format_notification(n: Notification) -> Dict[str, Any]:
    return {
        "id": n.id,
        "recipientId": n.recipientId,
        "actorId": n.actorId,
        "type": n.type,
        "postId": n.postId,
        "commentId": n.commentId,
        "conversationId": n.conversationId,
        "messageId": n.messageId,
        "readAt": n.readAt.isoformat() if n.readAt else None,
        "createdAt": n.createdAt.isoformat() if n.createdAt else None,
        "actor": {
            "id": n.actor.id,
            "username": n.actor.username,
            "displayName": n.actor.displayName,
            "profilePhoto": n.actor.profilePhoto,
        } if n.actor else None,
        "post": {
            "id": n.post.id,
            "imageUrl": n.post.imageUrl,
            "caption": n.post.caption,
        } if n.post else None,
    }

def create_notification(
    db: Session,
    recipient_id: str,
    actor_id: str,
    notif_type: str,
    post_id: Optional[str] = None,
    comment_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
    message_id: Optional[str] = None,
) -> Optional[Notification]:
    if recipient_id == actor_id:
        return None

    # Avoid duplicate unread follow/like notifications
    if notif_type == "LIKE" and post_id:
        existing = (
            db.query(Notification)
            .filter(
                Notification.recipientId == recipient_id,
                Notification.actorId == actor_id,
                Notification.type == "LIKE",
                Notification.postId == post_id,
                Notification.readAt.is_(None),
            )
            .first()
        )
        if existing:
            return existing

    if notif_type == "FOLLOW":
        existing = (
            db.query(Notification)
            .filter(
                Notification.recipientId == recipient_id,
                Notification.actorId == actor_id,
                Notification.type == "FOLLOW",
                Notification.readAt.is_(None),
            )
            .first()
        )
        if existing:
            return existing

    try:
        notif = Notification(
            recipientId=recipient_id,
            actorId=actor_id,
            type=notif_type,
            postId=post_id,
            commentId=comment_id,
            conversationId=conversation_id,
            messageId=message_id,
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)

        # Real-time event dispatch
        realtime_hub.emit_to_user(
            recipient_id,
            "NEW_NOTIFICATION",
            {"notification": format_notification(notif)},
        )
        return notif
    except Exception as e:
        db.rollback()
        print(f"Failed to create notification: {e}")
        return None
