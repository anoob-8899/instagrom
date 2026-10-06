from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from instagrom.database import get_db
from instagrom.models import Post, Comment, Like, SavedPost, User
from instagrom.auth import get_current_user_optional, get_current_user_required
from instagrom.notifications import create_notification

router = APIRouter(prefix="/api/posts", tags=["posts"])

class CreatePostPayload(BaseModel):
    imageUrl: str
    caption: Optional[str] = None

class CreateCommentPayload(BaseModel):
    content: str

def format_post_dict(post: Post, current_user: Optional[User], db: Session):
    is_liked = False
    is_saved = False
    if current_user:
        is_liked = db.query(Like).filter(Like.postId == post.id, Like.userId == current_user.id).first() is not None
        is_saved = db.query(SavedPost).filter(SavedPost.postId == post.id, SavedPost.userId == current_user.id).first() is not None

    like_count = db.query(Like).filter(Like.postId == post.id).count()
    comment_count = db.query(Comment).filter(Comment.postId == post.id).count()

    # Recent 3 comments
    recent_comments_db = (
        db.query(Comment)
        .filter(Comment.postId == post.id)
        .order_by(desc(Comment.createdAt))
        .limit(3)
        .all()
    )
    recent_comments_db.reverse()

    recent_comments = [
        {
            "id": c.id,
            "content": c.content,
            "createdAt": c.createdAt.isoformat() if c.createdAt else None,
            "author": {
                "id": c.author.id,
                "username": c.author.username,
                "displayName": c.author.displayName,
                "profilePhoto": c.author.profilePhoto,
            } if c.author else None,
        }
        for c in recent_comments_db
    ]

    return {
        "id": post.id,
        "caption": post.caption,
        "imageUrl": post.imageUrl,
        "createdAt": post.createdAt.isoformat() if post.createdAt else None,
        "updatedAt": post.updatedAt.isoformat() if post.updatedAt else None,
        "author": {
            "id": post.author.id,
            "username": post.author.username,
            "displayName": post.author.displayName,
            "profilePhoto": post.author.profilePhoto,
        } if post.author else None,
        "likeCount": like_count,
        "commentCount": comment_count,
        "isLiked": is_liked,
        "isSaved": is_saved,
        "recentComments": recent_comments,
    }

@router.get("")
def list_posts(
    limit: int = Query(20, ge=1, le=50),
    cursor: Optional[str] = None,
    userId: Optional[str] = None,
    username: Optional[str] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    query = db.query(Post)
    if userId:
        query = query.filter(Post.authorId == userId)
    elif username:
        user = db.query(User).filter(User.username == username).first()
        if user:
            query = query.filter(Post.authorId == user.id)
        else:
            return {"posts": [], "nextCursor": None}

    if cursor:
        cursor_post = db.query(Post).filter(Post.id == cursor).first()
        if cursor_post:
            query = query.filter(Post.createdAt < cursor_post.createdAt)

    posts_list = query.order_by(desc(Post.createdAt)).limit(limit + 1).all()

    next_cursor = None
    if len(posts_list) > limit:
        next_item = posts_list.pop()
        next_cursor = next_item.id

    formatted = [format_post_dict(p, current_user, db) for p in posts_list]
    return {
        "posts": formatted,
        "nextCursor": next_cursor,
    }

@router.post("", status_code=status.HTTP_201_CREATED)
def create_post(
    payload: CreatePostPayload,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    image_url = payload.imageUrl.strip()
    if not image_url:
        raise HTTPException(status_code=400, detail="Image URL is required")

    caption = payload.caption.strip() if payload.caption else None
    if caption and len(caption) > 2200:
        raise HTTPException(status_code=400, detail="Caption cannot exceed 2,200 characters")

    new_post = Post(
        authorId=current_user.id,
        imageUrl=image_url,
        caption=caption,
    )
    db.add(new_post)
    db.commit()
    db.refresh(new_post)

    return {
        "post": {
            "id": new_post.id,
            "caption": new_post.caption,
            "imageUrl": new_post.imageUrl,
            "createdAt": new_post.createdAt.isoformat() if new_post.createdAt else None,
            "updatedAt": new_post.updatedAt.isoformat() if new_post.updatedAt else None,
            "author": {
                "id": current_user.id,
                "username": current_user.username,
                "displayName": current_user.displayName,
                "profilePhoto": current_user.profilePhoto,
            },
            "likeCount": 0,
            "commentCount": 0,
            "isLiked": False,
            "isSaved": False,
            "recentComments": [],
        }
    }

@router.get("/{id}")
def get_post(
    id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"post": format_post_dict(post, current_user, db)}

@router.delete("/{id}")
def delete_post(
    id: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.authorId != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You can only delete your own posts")

    db.delete(post)
    db.commit()
    return {"success": True}

@router.post("/{id}/like")
def toggle_like(
    id: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = db.query(Like).filter(Like.postId == id, Like.userId == current_user.id).first()
    liked = False

    if existing:
        db.delete(existing)
        db.commit()
        liked = False
    else:
        new_like = Like(postId=id, userId=current_user.id)
        db.add(new_like)
        db.commit()
        liked = True

        if post.authorId != current_user.id:
            create_notification(
                db=db,
                recipient_id=post.authorId,
                actor_id=current_user.id,
                notif_type="LIKE",
                post_id=post.id,
            )

    like_count = db.query(Like).filter(Like.postId == id).count()
    return {"liked": liked, "likeCount": like_count}

@router.post("/{id}/save")
def toggle_save(
    id: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = db.query(SavedPost).filter(SavedPost.postId == id, SavedPost.userId == current_user.id).first()
    saved = False

    if existing:
        db.delete(existing)
        db.commit()
        saved = False
    else:
        new_save = SavedPost(postId=id, userId=current_user.id)
        db.add(new_save)
        db.commit()
        saved = True

    return {"saved": saved}

@router.get("/{id}/comments")
def get_comments(
    id: str,
    db: Session = Depends(get_db),
):
    comments = db.query(Comment).filter(Comment.postId == id).order_by(Comment.createdAt.asc()).all()
    return {
        "comments": [
            {
                "id": c.id,
                "postId": c.postId,
                "authorId": c.authorId,
                "content": c.content,
                "createdAt": c.createdAt.isoformat() if c.createdAt else None,
                "author": {
                    "id": c.author.id,
                    "username": c.author.username,
                    "displayName": c.author.displayName,
                    "profilePhoto": c.author.profilePhoto,
                } if c.author else None,
            }
            for c in comments
        ]
    }

@router.post("/{id}/comments", status_code=status.HTTP_201_CREATED)
def add_comment(
    id: str,
    payload: CreateCommentPayload,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment content cannot be empty")
    if len(content) > 1000:
        raise HTTPException(status_code=400, detail="Comment cannot exceed 1,000 characters")

    post = db.query(Post).filter(Post.id == id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comment = Comment(
        postId=id,
        authorId=current_user.id,
        content=content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    if post.authorId != current_user.id:
        create_notification(
            db=db,
            recipient_id=post.authorId,
            actor_id=current_user.id,
            notif_type="COMMENT",
            post_id=post.id,
            comment_id=comment.id,
        )

    comment_count = db.query(Comment).filter(Comment.postId == id).count()

    return {
        "comment": {
            "id": comment.id,
            "postId": comment.postId,
            "authorId": comment.authorId,
            "content": comment.content,
            "createdAt": comment.createdAt.isoformat() if comment.createdAt else None,
            "author": {
                "id": current_user.id,
                "username": current_user.username,
                "displayName": current_user.displayName,
                "profilePhoto": current_user.profilePhoto,
            },
        },
        "commentCount": comment_count,
    }

@router.delete("/{id}/comments/{comment_id}")
def delete_comment(
    id: str,
    comment_id: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment or comment.postId != id:
        raise HTTPException(status_code=404, detail="Comment not found")

    post = db.query(Post).filter(Post.id == id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if comment.authorId != current_user.id and post.authorId != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You can only delete your own comments")

    db.delete(comment)
    db.commit()

    comment_count = db.query(Comment).filter(Comment.postId == id).count()
    return {"success": True, "commentCount": comment_count}
