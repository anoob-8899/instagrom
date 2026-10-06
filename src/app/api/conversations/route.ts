import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getOrCreateConversation, getUserConversations } from "@/lib/messaging/conversations";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversations = await getUserConversations(currentUser.id);
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("GET /api/conversations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
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
    const { recipientUsername, recipientId } = body;

    let targetUserId = recipientId;

    if (!targetUserId && recipientUsername) {
      const user = await prisma.user.findUnique({
        where: { username: recipientUsername.toLowerCase().trim() },
        select: { id: true },
      });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      targetUserId = user.id;
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: "recipientUsername or recipientId is required" },
        { status: 400 }
      );
    }

    if (targetUserId === currentUser.id) {
      return NextResponse.json(
        { error: "Cannot message yourself" },
        { status: 400 }
      );
    }

    const conversation = await getOrCreateConversation(currentUser.id, targetUserId);

    return NextResponse.json({ conversation }, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/conversations error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create or open conversation" },
      { status: 500 }
    );
  }
}
