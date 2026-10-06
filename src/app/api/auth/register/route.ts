import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, isValid6DigitPassword } from "@/lib/auth/password";
import { createSession, setAuthCookie } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 }
      );
    }

    const { username, displayName, password, confirmPassword } = body;

    // Validate Username
    if (!username || typeof username !== "string" || !username.trim()) {
      return NextResponse.json(
        { error: "Username is required." },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim().toLowerCase();
    const usernameRegex = /^[a-zA-Z0-9._]{3,30}$/;
    if (!usernameRegex.test(trimmedUsername)) {
      return NextResponse.json(
        {
          error:
            "Username must be 3-30 characters long and contain only letters, numbers, dots, or underscores.",
        },
        { status: 400 }
      );
    }

    // Validate Display Name
    const trimmedDisplayName =
      typeof displayName === "string" && displayName.trim()
        ? displayName.trim()
        : trimmedUsername;

    // Validate Password
    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required." },
        { status: 400 }
      );
    }

    if (!isValid6DigitPassword(password)) {
      return NextResponse.json(
        { error: "Password must be exactly 6 numeric digits." },
        { status: 400 }
      );
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match." },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: trimmedUsername },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Username already exists. Please choose a different one." },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user in SQLite
    const user = await prisma.user.create({
      data: {
        username: trimmedUsername,
        displayName: trimmedDisplayName,
        passwordHash,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        profilePhoto: true,
        bio: true,
        createdAt: true,
      },
    });

    // Create server-side session
    const { token, expiresAt } = await createSession(user.id);

    const response = NextResponse.json(
      {
        success: true,
        message: "Account created successfully.",
        user,
      },
      { status: 201 }
    );

    setAuthCookie(response, token, expiresAt);
    return response;
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during registration. Please try again." },
      { status: 500 }
    );
  }
}
