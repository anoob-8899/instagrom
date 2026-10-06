import { prisma } from "../src/lib/db/prisma";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { createSession, validateSessionToken, destroySession } from "../src/lib/auth/session";

async function runTests() {
  console.log("=== INSTAGROM AUTH & DATABASE VERIFICATION ===");

  // 1. Clear test data if any
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
  console.log("✔ Cleaned test database state");

  // 2. Test Password Hashing
  const rawPassword = "securePassword123";
  const hashed = await hashPassword(rawPassword);
  console.log("✔ Password hashed:", hashed.substring(0, 20) + "...");
  if (hashed === rawPassword) {
    throw new Error("FAIL: Password stored in plaintext!");
  }
  const passwordValid = await verifyPassword(rawPassword, hashed);
  const passwordInvalid = await verifyPassword("wrongPassword", hashed);
  if (!passwordValid || passwordInvalid) {
    throw new Error("FAIL: Password verification failed!");
  }
  console.log("✔ Password hashing & bcrypt verification passed");

  // 3. Test User Registration in SQLite
  const userAlice = await prisma.user.create({
    data: {
      username: "alice",
      displayName: "Alice Cooper",
      passwordHash: hashed,
    },
  });
  console.log("✔ Registered user 'alice' with ID:", userAlice.id);

  // 4. Test Duplicate Username Rejection
  let duplicateRejected = false;
  try {
    await prisma.user.create({
      data: {
        username: "alice",
        displayName: "Alice Clone",
        passwordHash: hashed,
      },
    });
  } catch (err: any) {
    if (err.code === "P2002" || err.message.includes("Unique constraint")) {
      duplicateRejected = true;
    }
  }
  if (!duplicateRejected) {
    throw new Error("FAIL: Duplicate username was not rejected!");
  }
  console.log("✔ Duplicate username rejection constraint passed");

  // 5. Test Registering Multiple Users (System A, B, C)
  const userBob = await prisma.user.create({
    data: {
      username: "bob",
      displayName: "Bob Smith",
      passwordHash: await hashPassword("bobPassword456"),
    },
  });
  const userCharlie = await prisma.user.create({
    data: {
      username: "charlie",
      displayName: "Charlie Brown",
      passwordHash: await hashPassword("charliePassword789"),
    },
  });
  console.log("✔ Registered 'bob' and 'charlie' in shared SQLite database");

  // Verify all 3 exist in SQLite
  const totalUsers = await prisma.user.count();
  if (totalUsers !== 3) {
    throw new Error(`FAIL: Expected 3 users, got ${totalUsers}`);
  }
  console.log("✔ Shared SQLite database contains all 3 accounts: alice, bob, charlie");

  // 6. Test Server-side Session Management
  const sessionAlice = await createSession(userAlice.id);
  const sessionBob = await createSession(userBob.id);
  console.log("✔ Created independent sessions for Alice and Bob");

  // Validate Alice Session
  const validAliceUser = await validateSessionToken(sessionAlice.token);
  if (!validAliceUser || validAliceUser.username !== "alice") {
    throw new Error("FAIL: Alice session validation failed!");
  }
  console.log("✔ Alice session validated successfully:", validAliceUser.username);

  // Validate Bob Session
  const validBobUser = await validateSessionToken(sessionBob.token);
  if (!validBobUser || validBobUser.username !== "bob") {
    throw new Error("FAIL: Bob session validation failed!");
  }
  console.log("✔ Bob session validated successfully:", validBobUser.username);

  // 7. Test Logout / Session Invalidation (Logging out Alice does NOT log out Bob)
  await destroySession(sessionAlice.token);
  console.log("✔ Destroyed Alice's session (Logout)");

  const invalidAlice = await validateSessionToken(sessionAlice.token);
  if (invalidAlice !== null) {
    throw new Error("FAIL: Alice session still valid after logout!");
  }
  console.log("✔ Alice session successfully invalidated");

  const stillValidBob = await validateSessionToken(sessionBob.token);
  if (!stillValidBob || stillValidBob.username !== "bob") {
    throw new Error("FAIL: Bob was logged out when Alice logged out!");
  }
  console.log("✔ Bob remains independently logged in (multi-user isolation verified)");

  console.log("\nALL VERIFICATION CHECKS PASSED SUCCESSFULLY! 🎉");
}

runTests()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
