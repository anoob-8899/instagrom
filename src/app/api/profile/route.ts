import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { displayName, bio, profilePhoto } = body;

    if (displayName !== undefined) {
      if (typeof displayName !== "string" || displayName.trim().length === 0) {
        return NextResponse.json(
          { error: "Display name cannot be empty" },
          { status: 400 }
        );
      }
      if (displayName.trim().length > 50) {
        return NextResponse.json(
          { error: "Display name cannot exceed 50 characters" },
          { status: 400 }
        );
      }
    }

    if (bio !== undefined && typeof bio === "string" && bio.length > 300) {
      return NextResponse.json(
        { error: "Bio cannot exceed 300 characters" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        ...(displayName !== undefined ? { displayName: displayName.trim() } : {}),
        ...(bio !== undefined ? { bio: bio.trim() || null } : {}),
        ...(profilePhoto !== undefined ? { profilePhoto: profilePhoto || null } : {}),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        profilePhoto: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      user: updatedUser,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("PUT /api/profile error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
