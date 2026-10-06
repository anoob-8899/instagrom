import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() || "";
    const currentUser = await getCurrentUser();

    if (!query) {
      return NextResponse.json({ users: [], posts: [] });
    }

    const cleanQuery = query.startsWith("#") ? query.substring(1) : query;

    // Search users in SQLite
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: cleanQuery } },
          { displayName: { contains: cleanQuery } },
          { bio: { contains: cleanQuery } },
        ],
      },
      take: 10,
      select: {
        id: true,
        username: true,
        displayName: true,
        profilePhoto: true,
        bio: true,
        _count: {
          select: {
            followers: true,
            posts: true,
          },
        },
        followers: currentUser
          ? {
              where: { followerId: currentUser.id },
              select: { id: true },
            }
          : false,
      },
    });

    // Search posts in SQLite (searching captions / hashtags)
    const posts = await prisma.post.findMany({
      where: {
        caption: { contains: query },
      },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profilePhoto: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    const formattedUsers = users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      profilePhoto: u.profilePhoto,
      bio: u.bio,
      followerCount: u._count.followers,
      postCount: u._count.posts,
      isFollowing: currentUser ? (u.followers?.length ?? 0) > 0 : false,
      isSelf: currentUser ? currentUser.id === u.id : false,
    }));

    const formattedPosts = posts.map((p) => ({
      id: p.id,
      imageUrl: p.imageUrl,
      caption: p.caption,
      createdAt: p.createdAt,
      author: p.author,
      likeCount: p._count.likes,
      commentCount: p._count.comments,
    }));

    return NextResponse.json({
      query,
      users: formattedUsers,
      posts: formattedPosts,
    });
  } catch (error) {
    console.error("GET /api/search error:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
}
