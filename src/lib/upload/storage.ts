import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export type UploadCategory = "posts" | "profiles" | "stories";

/**
 * Validates uploaded file metadata (size, mime type, extension).
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file || file.size === 0) {
    return { valid: false, error: "No file provided or file is empty." };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: "File size exceeds 10MB limit." };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    return { valid: false, error: "Invalid image format. Allowed: JPEG, PNG, WEBP, GIF." };
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: "Invalid file extension." };
  }

  return { valid: true };
}

/**
 * Saves an uploaded image file securely to the local filesystem under public/uploads/{category}.
 * Returns the public URL path (e.g. /uploads/posts/abc123xyz.jpg).
 */
export async function saveUploadedImage(file: File, category: UploadCategory): Promise<string> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || "File validation failed.");
  }

  const ext = path.extname(file.name).toLowerCase() || ".jpg";
  const uniqueId = crypto.randomUUID();
  const safeFilename = `${uniqueId}${ext}`;

  // Target directory
  const targetDir = path.join(process.cwd(), "public", "uploads", category);
  await fs.mkdir(targetDir, { recursive: true });

  const filePath = path.join(targetDir, safeFilename);

  // Convert File arrayBuffer to Buffer and write
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  await fs.writeFile(filePath, buffer);

  // Return public web URL
  return `/uploads/${category}/${safeFilename}`;
}
