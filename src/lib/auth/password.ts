import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export const SIX_DIGIT_PASSWORD_REGEX = /^\d{6}$/;

/**
 * Validates whether a password is an exact 6-digit numeric string.
 */
export function isValid6DigitPassword(password: unknown): password is string {
  return typeof password === "string" && SIX_DIGIT_PASSWORD_REGEX.test(password);
}

/**
 * Hashes a plaintext password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

