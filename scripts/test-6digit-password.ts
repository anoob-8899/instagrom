import { isValid6DigitPassword, hashPassword, verifyPassword, SIX_DIGIT_PASSWORD_REGEX } from "../src/lib/auth/password";
import { prisma } from "../src/lib/db/prisma";
import { createSession, validateSessionToken, destroySession } from "../src/lib/auth/session";

async function runSixDigitPasswordTests() {
  console.log("==================================================================");
  console.log("   INSTAGROM — 6-DIGIT PASSWORD VERIFICATION SUITE               ");
  console.log("==================================================================\n");

  // ---------------------------------------------------------
  // SECTION 1: PASSWORD FORMAT & VALIDATION TESTS
  // ---------------------------------------------------------
  console.log("▶ Section 1: Testing 6-Digit Password Format Validation");

  const validPasswords = ["123456", "000123", "000000", "999999", "908172"];
  for (const pw of validPasswords) {
    if (!isValid6DigitPassword(pw)) {
      throw new Error(`FAIL: Valid password '${pw}' was incorrectly rejected!`);
    }
    console.log(`  ✔ Valid password accepted: "${pw}" (leading zeros & length preserved)`);
  }

  const invalidPasswords = [
    "12345",      // 5 digits (too short)
    "1234567",    // 7 digits (too long)
    "12345a",     // contains alphabetic char
    "abcdef",     // all alphabetic
    "12 3456",    // contains whitespace
    "",           // empty string
    " ",          // single space
    "12345 ",     // trailing space
    " 123456",    // leading space
    "12-345",     // hyphenated
    "12345.0",    // float style
    null,         // null
    undefined,    // undefined
    123456,       // number instead of string
  ];

  for (const pw of invalidPasswords) {
    if (isValid6DigitPassword(pw)) {
      throw new Error(`FAIL: Invalid password '${pw}' was incorrectly accepted!`);
    }
    console.log(`  ✔ Invalid password rejected: ${JSON.stringify(pw)}`);
  }

  // ---------------------------------------------------------
  // SECTION 2: PASSWORD HASHING (BCRYPT) & STRING PRESERVATION
  // ---------------------------------------------------------
  console.log("\n▶ Section 2: Password Hashing Architecture & Bcrypt Verification");

  const testPw = "000123";
  const hashed = await hashPassword(testPw);

  if (hashed === testPw) {
    throw new Error("FAIL: Password stored as plaintext!");
  }
  if (!hashed.startsWith("$2a$") && !hashed.startsWith("$2b$")) {
    throw new Error(`FAIL: Password hash does not match bcrypt format: ${hashed}`);
  }
  console.log(`  ✔ Password "${testPw}" securely hashed to bcrypt: ${hashed.substring(0, 25)}...`);

  const isValidMatch = await verifyPassword("000123", hashed);
  const isInvalidMatch1 = await verifyPassword("123", hashed); // number conversion would fail
  const isInvalidMatch2 = await verifyPassword("000124", hashed);

  if (!isValidMatch || isInvalidMatch1 || isInvalidMatch2) {
    throw new Error("FAIL: Bcrypt verification failed for 6-digit string with leading zeros!");
  }
  console.log("  ✔ Leading zeros correctly preserved as string in hash comparison");

  // ---------------------------------------------------------
  // SECTION 3: DATABASE PRESERVATION & EXISTING USERS
  // ---------------------------------------------------------
  console.log("\n▶ Section 3: Existing Users & Database Integrity");

  const existingUsers = await prisma.user.findMany({
    select: { id: true, username: true, displayName: true, createdAt: true },
  });

  console.log(`  ✔ Existing user count in instagrom.sqlite: ${existingUsers.length}`);
  console.log(`  ✔ Existing accounts: ${existingUsers.map((u) => u.username).join(", ")}`);

  if (existingUsers.length === 0) {
    throw new Error("FAIL: Existing users were lost or database was reset!");
  }

  // ---------------------------------------------------------
  // SECTION 4: SERVER-SIDE SESSION CREATION & LIFECYCLE
  // ---------------------------------------------------------
  console.log("\n▶ Section 4: Session Lifecycle Verification");

  const firstUser = existingUsers[0];
  const session = await createSession(firstUser.id);
  console.log(`  ✔ Created session for '${firstUser.username}' with token: ${session.token.substring(0, 16)}...`);

  const validatedUser = await validateSessionToken(session.token);
  if (!validatedUser || validatedUser.username !== firstUser.username) {
    throw new Error("FAIL: Session validation failed!");
  }
  console.log(`  ✔ Session validated: username = '${validatedUser.username}', id = '${validatedUser.id}'`);

  await destroySession(session.token);
  const afterLogoutUser = await validateSessionToken(session.token);
  if (afterLogoutUser !== null) {
    throw new Error("FAIL: Session still valid after destruction (logout)!");
  }
  console.log("  ✔ Session destruction (logout) verified successfully");

  console.log("\n==================================================================");
  console.log("   🎉 ALL 6-DIGIT PASSWORD VERIFICATION CHECKS PASSED!           ");
  console.log("==================================================================");
}

runSixDigitPasswordTests()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
