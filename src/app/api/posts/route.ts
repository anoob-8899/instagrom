import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 50);
    const cursor = searchParams.get("cursor");
    const userId = searchParams.get("userId");
    const username = searchParams.get("username");

    // Build where filter
    const where: any = {};
    if (userId) {
      where.authorId = userId;
    } else if (username) {
      where.author = { username };
    }

    const posts = await prisma.post.findMany({
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where,
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
        comments: {
          take: 3,
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
          },
        },
        likes: currentUser
          ? {
              where: { userId: currentUser.id },
              select: { userId: true },
            }
          : false,
        savedBy: currentUser
          ? {
              where: { userId: currentUser.id },
              select: { userId: true },
            }
          : false,
      },
    });

    let nextCursor: string | null = null;
    if (posts.length > limit) {
      const nextItem = posts.pop();
      nextCursor = nextItem?.id || null;
    }

    // Format output with isLiked and isSaved booleans
    const formattedPosts = posts.map((post) => ({
      id: post.id,
      caption: post.caption,
      imageUrl: post.imageUrl,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: post.author,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      isLiked: currentUser ? (post.likes?.length ?? 0) > 0 : false,
      isSaved: currentUser ? (post.savedBy?.length ?? 0) > 0 : false,
      recentComments: post.comments.reverse(), // chronologically ordered for preview
    }));

    return NextResponse.json({
      posts: formattedPosts,
      nextCursor,
    });
  } catch (error: any) {
    console.error("GET /api/posts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { caption, imageUrl } = body;

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    if (caption && typeof caption === "string" && caption.length > 2200) {
      return NextResponse.json(
        { error: "Caption cannot exceed 2,200 characters" },
        { status: 400 }
      );
    }

    const newPost = await prisma.post.create({
      data: {
        authorId: currentUser.id,
        imageUrl: imageUrl.trim(),
        caption: caption ? caption.trim() : null,
      },
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

    return NextResponse.json(
      {
        post: {
          id: newPost.id,
          caption: newPost.caption,
          imageUrl: newPost.imageUrl,
          createdAt: newPost.createdAt,
          updatedAt: newPost.updatedAt,
          author: newPost.author,
          likeCount: 0,
          commentCount: 0,
          isLiked: false,
          isSaved: false,
          recentComments: [],
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/posts error:", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
