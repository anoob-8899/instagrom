import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

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

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const existingSave = await prisma.savedPost.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: currentUser.id,
        },
      },
    });

    let saved = false;
    if (existingSave) {
      await prisma.savedPost.delete({
        where: {
          postId_userId: {
            postId,
            userId: currentUser.id,
          },
        },
      });
      saved = false;
    } else {
      await prisma.savedPost.create({
        data: {
          postId,
          userId: currentUser.id,
        },
      });
      saved = true;
    }

    return NextResponse.json({ saved });
  } catch (error) {
    console.error("POST /api/posts/[id]/save error:", error);
    return NextResponse.json(
      { error: "Failed to toggle saved post" },
      { status: 500 }
    );
  }
}
