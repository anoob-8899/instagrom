import uuid
from datetime import datetime, timezone
from typing import Optional, Union
from sqlalchemy import (
    Column,
    String,
    Boolean,
    ForeignKey,
    UniqueConstraint,
    Index,
    Text,
    TypeDecorator,
    Integer,
)
from sqlalchemy.orm import relationship
from instagrom.database import Base

def generate_id() -> str:
    # Generates a CUID-like string
    return "c" + uuid.uuid4().hex[:24]

class PrismaDateTime(TypeDecorator):
    """
    Handles SQLite DateTime stored as epoch milliseconds integer by Prisma,
    or ISO strings, transparently converting to/from Python datetime objects.
    """
    impl = Integer
    cache_ok = True

    def process_bind_param(self, value: Optional[Union[datetime, int, float]], dialect):
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, datetime):
            ts = value.timestamp()
            return int(ts * 1000)
        return value

    def process_result_value(self, value: Optional[Union[int, float, str, datetime]], dialect) -> Optional[datetime]:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(value / 1000.0, tz=timezone.utc).replace(tzinfo=None)
        if isinstance(value, str):
            try:
                # Try parsing as integer millisecond string
                return datetime.fromtimestamp(float(value) / 1000.0, tz=timezone.utc).replace(tzinfo=None)
            except ValueError:
                # Try ISO format
                return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        return None


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_id)
    username = Column(String, unique=True, nullable=False, index=True)
    passwordHash = Column(String, nullable=False)
    displayName = Column(String, nullable=False)
    profilePhoto = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    createdAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False)
    updatedAt = Column(PrismaDateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan", foreign_keys="Post.authorId")
    comments = relationship("Comment", back_populates="author", cascade="all, delete-orphan", foreign_keys="Comment.authorId")
    likes = relationship("Like", back_populates="user", cascade="all, delete-orphan")
    saved_posts = relationship("SavedPost", back_populates="user", cascade="all, delete-orphan")
    stories = relationship("Story", back_populates="author", cascade="all, delete-orphan")
    
    following = relationship(
        "Follow",
        foreign_keys="Follow.followerId",
        back_populates="follower",
        cascade="all, delete-orphan",
    )
    followers = relationship(
        "Follow",
        foreign_keys="Follow.followingId",
        back_populates="following",
        cascade="all, delete-orphan",
    )

    conversation_participants = relationship("ConversationParticipant", back_populates="user", cascade="all, delete-orphan")
    sent_messages = relationship("Message", back_populates="sender", cascade="all, delete-orphan")
    
    received_notifications = relationship(
        "Notification",
        foreign_keys="Notification.recipientId",
        back_populates="recipient",
        cascade="all, delete-orphan",
    )
    sent_notifications = relationship(
        "Notification",
        foreign_keys="Notification.actorId",
        back_populates="actor",
        cascade="all, delete-orphan",
    )
    
    presence = relationship("UserPresence", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=generate_id)
    sessionToken = Column(String, unique=True, nullable=False, index=True)
    userId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    expiresAt = Column(PrismaDateTime, nullable=False)
    createdAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False)
    updatedAt = Column(PrismaDateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="sessions")


class Post(Base):
    __tablename__ = "posts"

    id = Column(String, primary_key=True, default=generate_id)
    authorId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    caption = Column(String, nullable=True)
    imageUrl = Column(String, nullable=False)
    createdAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False, index=True)
    updatedAt = Column(PrismaDateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    author = relationship("User", back_populates="posts", foreign_keys=[authorId])
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="post", cascade="all, delete-orphan")
    savedBy = relationship("SavedPost", back_populates="post", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="post", cascade="all, delete-orphan")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(String, primary_key=True, default=generate_id)
    postId = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    authorId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(String, nullable=False)
    createdAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False)
    updatedAt = Column(PrismaDateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    post = relationship("Post", back_populates="comments")
    author = relationship("User", back_populates="comments", foreign_keys=[authorId])


class Like(Base):
    __tablename__ = "likes"

    id = Column(String, primary_key=True, default=generate_id)
    postId = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    userId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    createdAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("postId", "userId", name="likes_postId_userId_key"),
    )

    post = relationship("Post", back_populates="likes")
    user = relationship("User", back_populates="likes")


class Follow(Base):
    __tablename__ = "follows"

    id = Column(String, primary_key=True, default=generate_id)
    followerId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    followingId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    createdAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("followerId", "followingId", name="follows_followerId_followingId_key"),
    )

    follower = relationship("User", foreign_keys=[followerId], back_populates="following")
    following = relationship("User", foreign_keys=[followingId], back_populates="followers")


class SavedPost(Base):
    __tablename__ = "saved_posts"

    id = Column(String, primary_key=True, default=generate_id)
    postId = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    userId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    createdAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("postId", "userId", name="saved_posts_postId_userId_key"),
    )

    post = relationship("Post", back_populates="savedBy")
    user = relationship("User", back_populates="saved_posts")


class Story(Base):
    __tablename__ = "stories"

    id = Column(String, primary_key=True, default=generate_id)
    authorId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    mediaUrl = Column(String, nullable=False)
    caption = Column(String, nullable=True)
    expiresAt = Column(PrismaDateTime, nullable=True)
    createdAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False, index=True)

    author = relationship("User", back_populates="stories")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=generate_id)
    createdAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False)
    updatedAt = Column(PrismaDateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    participants = relationship("ConversationParticipant", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"

    id = Column(String, primary_key=True, default=generate_id)
    conversationId = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    userId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    lastReadAt = Column(PrismaDateTime, nullable=True)
    joinedAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("conversationId", "userId", name="conversation_participants_conversationId_userId_key"),
    )

    conversation = relationship("Conversation", back_populates="participants")
    user = relationship("User", back_populates="conversation_participants")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=generate_id)
    conversationId = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    senderId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(String, nullable=False)
    readAt = Column(PrismaDateTime, nullable=True)
    createdAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False, index=True)
    updatedAt = Column(PrismaDateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=generate_id)
    recipientId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    actorId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String, nullable=False)  # "LIKE" | "COMMENT" | "FOLLOW" | "MESSAGE"
    postId = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=True)
    commentId = Column(String, nullable=True)
    conversationId = Column(String, nullable=True)
    messageId = Column(String, nullable=True)
    readAt = Column(PrismaDateTime, nullable=True, index=True)
    createdAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False, index=True)

    recipient = relationship("User", foreign_keys=[recipientId], back_populates="received_notifications")
    actor = relationship("User", foreign_keys=[actorId], back_populates="sent_notifications")
    post = relationship("Post", back_populates="notifications")


class UserPresence(Base):
    __tablename__ = "user_presence"

    id = Column(String, primary_key=True, default=generate_id)
    userId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    lastSeenAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False, index=True)
    isOnline = Column(Boolean, default=True, nullable=False)

    user = relationship("User", back_populates="presence")
