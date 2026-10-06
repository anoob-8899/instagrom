import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const currentUser = await getCurrentUser();

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase().trim() },
      select: {
        id: true,
        username: true,
        displayName: true,
        profilePhoto: true,
        bio: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
        posts: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            imageUrl: true,
            caption: true,
            createdAt: true,
            _count: {
              select: {
                likes: true,
                comments: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isSelf = currentUser ? currentUser.id === user.id : false;

    let isFollowing = false;
    if (currentUser && !isSelf) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUser.id,
            followingId: user.id,
          },
        },
      });
      isFollowing = !!follow;
    }

    // If it's currentUser looking at their own profile, also get saved posts
    let savedPosts: any[] = [];
    if (isSelf && currentUser) {
      const saved = await prisma.savedPost.findMany({
        where: { userId: currentUser.id },
        orderBy: { createdAt: "desc" },
        include: {
          post: {
            select: {
              id: true,
              imageUrl: true,
              caption: true,
              createdAt: true,
              _count: {
                select: {
                  likes: true,
                  comments: true,
                },
              },
            },
          },
        },
      });
      savedPosts = saved.map((s) => s.post);
    }

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        profilePhoto: user.profilePhoto,
        bio: user.bio,
        createdAt: user.createdAt,
        postCount: user._count.posts,
        followerCount: user._count.followers,
        followingCount: user._count.following,
        isFollowing,
        isSelf,
      },
      posts: user.posts.map((p) => ({
        id: p.id,
        imageUrl: p.imageUrl,
        caption: p.caption,
        createdAt: p.createdAt,
        likeCount: p._count.likes,
        commentCount: p._count.comments,
      })),
      savedPosts: savedPosts.map((p) => ({
        id: p.id,
        imageUrl: p.imageUrl,
        caption: p.caption,
        createdAt: p.createdAt,
        likeCount: p._count.likes,
        commentCount: p._count.comments,
      })),
    });
  } catch (error) {
    console.error("GET /api/users/[username] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }
}
