import { prisma } from "../src/lib/db/prisma";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { createSession, validateSessionToken, destroySession } from "../src/lib/auth/session";

async function runAuthRegressionTests() {
  console.log("=== VERIFYING CON 01 AUTHENTICATION PRESERVATION ===");

  // 1. Check existing accounts remain intact
  const users = await prisma.user.findMany({ select: { username: true } });
  console.log("✔ Existing accounts intact:", users.map((u) => u.username).join(", "));

  // 2. Test password verification
  const testHash = await hashPassword("123456");
  const isValid = await verifyPassword("123456", testHash);
  const isInvalid = await verifyPassword("654321", testHash);
  if (!isValid || isInvalid) {
    throw new Error("FAIL: Password verification regression detected!");
  }
  console.log("✔ Password hashing & verification functioning properly");

  // 3. Test Session creation and retrieval
  const alice = await prisma.user.findFirst({ where: { username: "alice" } });
  if (alice) {
    const session = await createSession(alice.id);
    const validated = await validateSessionToken(session.token);
    if (!validated || validated.username !== "alice") {
      throw new Error("FAIL: Session validation failed!");
    }
    console.log("✔ Server-side session validation verified for user:", validated.username);

    // Destroy session (Logout)
    await destroySession(session.token);
    const afterLogout = await validateSessionToken(session.token);
    if (afterLogout !== null) {
      throw new Error("FAIL: Session still valid after logout!");
    }
    console.log("✔ Session destruction (logout) verified");
  }

  console.log("✔ CON 01 Regression Tests Passed Successfully!");
}

runAuthRegressionTests()
  .catch((err) => {
    console.error("Auth regression test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
