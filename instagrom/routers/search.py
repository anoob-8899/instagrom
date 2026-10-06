from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from instagrom.database import get_db
from instagrom.models import User, Post, Follow, Like, Comment
from instagrom.auth import get_current_user_optional

router = APIRouter(prefix="/api/search", tags=["search"])

@router.get("")
def search(
    q: Optional[str] = Query("", description="Search term"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    query_str = q.strip() if q else ""
    if not query_str:
        return {"users": [], "posts": []}

    clean_query = query_str[1:] if query_str.startswith("#") else query_str

    # Search Users
    users_db = (
        db.query(User)
        .filter(
            or_(
                User.username.contains(clean_query),
                User.displayName.contains(clean_query),
                User.bio.contains(clean_query),
            )
        )
        .limit(10)
        .all()
    )

    formatted_users = []
    for u in users_db:
        is_following = False
        if current_user:
            is_following = (
                db.query(Follow)
                .filter(Follow.followerId == current_user.id, Follow.followingId == u.id)
                .first()
                is not None
            )

        formatted_users.append({
            "id": u.id,
            "username": u.username,
            "displayName": u.displayName,
            "profilePhoto": u.profilePhoto,
            "bio": u.bio,
            "followerCount": db.query(Follow).filter(Follow.followingId == u.id).count(),
            "postCount": db.query(Post).filter(Post.authorId == u.id).count(),
            "isFollowing": is_following,
            "isSelf": current_user.id == u.id if current_user else False,
        })

    # Search Posts
    posts_db = (
        db.query(Post)
        .filter(Post.caption.contains(query_str))
        .order_by(desc(Post.createdAt))
        .limit(20)
        .all()
    )

    formatted_posts = [
        {
            "id": p.id,
            "imageUrl": p.imageUrl,
            "caption": p.caption,
            "createdAt": p.createdAt.isoformat() if p.createdAt else None,
            "author": {
                "id": p.author.id,
                "username": p.author.username,
                "displayName": p.author.displayName,
                "profilePhoto": p.author.profilePhoto,
            } if p.author else None,
            "likeCount": db.query(Like).filter(Like.postId == p.id).count(),
            "commentCount": db.query(Comment).filter(Comment.postId == p.id).count(),
        }
        for p in posts_db
    ]

    return {
        "query": query_str,
        "users": formatted_users,
        "posts": formatted_posts,
    }
