import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stories = await prisma.story.findMany({
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
    });

    // Group stories by author
    const userStoryMap = new Map<string, { author: any; stories: any[] }>();

    for (const story of stories) {
      if (!userStoryMap.has(story.authorId)) {
        userStoryMap.set(story.authorId, {
          author: story.author,
          stories: [],
        });
      }
      userStoryMap.get(story.authorId)!.stories.push({
        id: story.id,
        mediaUrl: story.mediaUrl,
        caption: story.caption,
        createdAt: story.createdAt,
      });
    }

    const groupedStories = Array.from(userStoryMap.values());

    return NextResponse.json({
      stories: groupedStories,
    });
  } catch (error) {
    console.error("GET /api/stories error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stories" },
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
    const { mediaUrl, caption } = body;

    if (!mediaUrl || typeof mediaUrl !== "string") {
      return NextResponse.json(
        { error: "Story media URL is required" },
        { status: 400 }
      );
    }

    const story = await prisma.story.create({
      data: {
        authorId: currentUser.id,
        mediaUrl: mediaUrl.trim(),
        caption: caption ? String(caption).trim() : null,
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
      },
    });

    return NextResponse.json({ story }, { status: 201 });
  } catch (error) {
    console.error("POST /api/stories error:", error);
    return NextResponse.json(
      { error: "Failed to create story" },
      { status: 500 }
    );
  }
}
