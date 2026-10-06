import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    // Get up to 8 users other than current user
    const users = await prisma.user.findMany({
      where: currentUser ? { id: { not: currentUser.id } } : undefined,
      take: 8,
      orderBy: { createdAt: "desc" },
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

    const formatted = users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      profilePhoto: u.profilePhoto,
      bio: u.bio,
      followerCount: u._count.followers,
      postCount: u._count.posts,
      isFollowing: currentUser ? (u.followers?.length ?? 0) > 0 : false,
    }));

    return NextResponse.json({ users: formatted });
  } catch (error) {
    console.error("GET /api/users/suggested error:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggested users" },
      { status: 500 }
    );
  }
}
