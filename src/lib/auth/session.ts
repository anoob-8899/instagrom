import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";

export const SESSION_COOKIE_NAME = "instagrom_session";
export const SESSION_MAX_AGE_DAYS = 7;
export const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60;

export interface SafeUser {
  id: string;
  username: string;
  displayName: string;
  profilePhoto: string | null;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Generates a cryptographically secure random session token.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Creates a server-side session in SQLite and returns the token and expiration.
 */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: {
      userId,
      sessionToken: token,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

/**
 * Validates a session token against the SQLite database and returns the User if valid.
 */
export async function validateSessionToken(token: string): Promise<SafeUser | null> {
  if (!token) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profilePhoto: true,
            bio: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    // Check if session has expired
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    return session.user;
  } catch (error) {
    console.error("Session validation error:", error);
    return null;
  }
}

/**
 * Invalidates and deletes a session token from SQLite.
 */
export async function destroySession(token: string): Promise<void> {
  if (!token) return;

  try {
    await prisma.session.deleteMany({
      where: { sessionToken: token },
    });
  } catch (error) {
    console.error("Session destruction error:", error);
  }
}

/**
 * Retrieves the currently authenticated user from Next.js server components / server actions.
 */
export async function getCurrentUser(): Promise<SafeUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    return await validateSessionToken(token);
  } catch (error) {
    console.error("Error retrieving current user:", error);
    return null;
  }
}

/**
 * Sets the HTTP-only session cookie on a NextResponse object.
 */
export function setAuthCookie(response: NextResponse, token: string, expiresAt: Date): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Clears the HTTP-only session cookie on a NextResponse object.
 */
export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

