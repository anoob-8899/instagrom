from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc
from instagrom.models import Conversation, ConversationParticipant, Message, User
from instagrom.presence import get_users_presence

def is_user_conversation_participant(db: Session, conversation_id: str, user_id: str) -> bool:
    participant = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversationId == conversation_id,
            ConversationParticipant.userId == user_id,
        )
        .first()
    )
    return participant is not None

def get_or_create_conversation(db: Session, user_a_id: str, user_b_id: str) -> Conversation:
    if user_a_id == user_b_id:
        raise ValueError("Cannot create conversation with yourself")

    # Find common conversations
    conv_a_ids = [
        cp.conversationId
        for cp in db.query(ConversationParticipant.conversationId)
        .filter(ConversationParticipant.userId == user_a_id)
        .all()
    ]

    if conv_a_ids:
        existing_participant_b = (
            db.query(ConversationParticipant)
            .filter(
                ConversationParticipant.conversationId.in_(conv_a_ids),
                ConversationParticipant.userId == user_b_id,
            )
            .first()
        )
        if existing_participant_b:
            conv = db.query(Conversation).filter(Conversation.id == existing_participant_b.conversationId).first()
            if conv:
                return conv

    # Create new conversation
    conv = Conversation()
    db.add(conv)
    db.flush()

    p_a = ConversationParticipant(conversationId=conv.id, userId=user_a_id)
    p_b = ConversationParticipant(conversationId=conv.id, userId=user_b_id)
    db.add_all([p_a, p_b])
    db.commit()
    db.refresh(conv)
    return conv

def get_user_conversations(db: Session, user_id: str) -> List[Dict[str, Any]]:
    # Get user's conversation participant records
    user_conv_parts = (
        db.query(ConversationParticipant)
        .filter(ConversationParticipant.userId == user_id)
        .all()
    )
    conv_ids = [cp.conversationId for cp in user_conv_parts]
    if not conv_ids:
        return []

    conversations = (
        db.query(Conversation)
        .filter(Conversation.id.in_(conv_ids))
        .all()
    )

    other_user_ids: List[str] = []
    for conv in conversations:
        for p in conv.participants:
            if p.userId != user_id and p.userId not in other_user_ids:
                other_user_ids.append(p.userId)

    presence_map = get_users_presence(db, other_user_ids)

    enriched = []
    for conv in conversations:
        other_part = next((p for p in conv.participants if p.userId != user_id), None)
        other_user = other_part.user if other_part else None

        last_msg = (
            db.query(Message)
            .filter(Message.conversationId == conv.id)
            .order_by(desc(Message.createdAt))
            .first()
        )

        unread_count = (
            db.query(Message)
            .filter(
                Message.conversationId == conv.id,
                Message.senderId != user_id,
                Message.readAt.is_(None),
            )
            .count()
        )

        presence = presence_map.get(other_user.id) if other_user else None

        enriched.append({
            "id": conv.id,
            "createdAt": conv.createdAt.isoformat() if conv.createdAt else None,
            "updatedAt": conv.updatedAt.isoformat() if conv.updatedAt else None,
            "otherUser": {
                "id": other_user.id,
                "username": other_user.username,
                "displayName": other_user.displayName,
                "profilePhoto": other_user.profilePhoto,
            } if other_user else None,
            "presence": presence or {"isOnline": False, "statusText": "Offline", "lastSeenAt": None},
            "lastMessage": {
                "id": last_msg.id,
                "content": last_msg.content,
                "senderId": last_msg.senderId,
                "createdAt": last_msg.createdAt.isoformat() if last_msg.createdAt else None,
                "readAt": last_msg.readAt.isoformat() if last_msg.readAt else None,
            } if last_msg else None,
            "unreadCount": unread_count,
            "_sortTime": last_msg.createdAt if last_msg else conv.updatedAt,
        })

    enriched.sort(key=lambda x: x["_sortTime"], reverse=True)
    for item in enriched:
        del item["_sortTime"]

    return enriched

# Export camelCase aliases as well for cross-compatibility
getUserConversations = get_user_conversations
getOrCreateConversation = get_or_create_conversation
isUserConversationParticipant = is_user_conversation_participant
