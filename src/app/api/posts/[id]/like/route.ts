import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/notifications";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check existing like
    const existingLike = await prisma.like.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: currentUser.id,
        },
      },
    });

    let liked = false;
    if (existingLike) {
      // Unlike
      await prisma.like.delete({
        where: {
          postId_userId: {
            postId,
            userId: currentUser.id,
          },
        },
      });
      liked = false;
    } else {
      // Like
      await prisma.like.create({
        data: {
          postId,
          userId: currentUser.id,
        },
      });
      liked = true;

      // Trigger notification for post author
      if (post.authorId !== currentUser.id) {
        await createNotification({
          recipientId: post.authorId,
          actorId: currentUser.id,
          type: "LIKE",
          postId: post.id,
        });
      }
    }

    const likeCount = await prisma.like.count({
      where: { postId },
    });

    return NextResponse.json({
      liked,
      likeCount,
    });
  } catch (error: any) {
    console.error("POST /api/posts/[id]/like error:", error);
    return NextResponse.json(
      { error: "Failed to toggle like" },
      { status: 500 }
    );
  }
}
