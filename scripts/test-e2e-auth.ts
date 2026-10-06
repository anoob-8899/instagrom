export {};

const BASE_URL = "http://localhost:3000";

async function runE2EAuthTests() {
  console.log("==================================================================");
  console.log("   INSTAGROM — FULL HTTP E2E 6-DIGIT AUTH INTEGRATION TESTS       ");
  console.log("==================================================================\n");

  const timestamp = Date.now().toString(36);

  // 1. Test registration with all required 6-digit password cases
  const validCases = [
    { pw: "123456", label: "Standard 6-digit" },
    { pw: "000123", label: "6-digit with leading zeros" },
    { pw: "000000", label: "All zeros 6-digit" },
    { pw: "999999", label: "All nines 6-digit" },
  ];

  console.log("▶ Step 1: Testing Valid 6-Digit Password Registrations");
  for (let i = 0; i < validCases.length; i++) {
    const { pw, label } = validCases[i];
    const username = `u_${timestamp}_${i}`;
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        displayName: `User ${label}`,
        password: pw,
        confirmPassword: pw,
      }),
    });

    const body = await res.json();
    const cookie = res.headers.get("set-cookie");

    if (res.status !== 201 || !cookie) {
      throw new Error(`FAIL: Registration failed for valid password "${pw}" (${label}): ${JSON.stringify(body)}`);
    }
    console.log(`  ✔ Successfully registered user '${username}' with password "${pw}" (${label})`);

    // Verify session immediately works
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: cookie.split(";")[0] },
    });
    const meBody = await meRes.json();
    if (meRes.status !== 200 || meBody.user?.username !== username) {
      throw new Error(`FAIL: Session verification failed for user '${username}'`);
    }
    console.log(`    ✔ Session verified via /api/auth/me for '${username}'`);

    // Test login with the same 6-digit password
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password: pw,
      }),
    });
    const loginCookie = loginRes.headers.get("set-cookie");
    if (loginRes.status !== 200 || !loginCookie) {
      throw new Error(`FAIL: Login failed for valid 6-digit password "${pw}"`);
    }
    console.log(`    ✔ Login verified with 6-digit password "${pw}"`);
  }

  // 2. Test registration rejection of invalid passwords
  console.log("\n▶ Step 2: Testing Rejection of Invalid Passwords at Registration");
  const invalidCases = [
    { pw: "12345", label: "5 digits (too short)" },
    { pw: "1234567", label: "7 digits (too long)" },
    { pw: "12345a", label: "Contains letter" },
    { pw: "abcdef", label: "All letters" },
    { pw: "12 3456", label: "Contains space" },
  ];

  for (let i = 0; i < invalidCases.length; i++) {
    const { pw, label } = invalidCases[i];
    const username = `invalid_${timestamp}_${i}`;
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        displayName: `Invalid ${label}`,
        password: pw,
        confirmPassword: pw,
      }),
    });

    const body = await res.json();
    if (res.status === 201) {
      throw new Error(`FAIL: Invalid password "${pw}" (${label}) was accepted by /api/auth/register!`);
    }
    console.log(`  ✔ Correctly rejected invalid password "${pw}" (${label}) -> HTTP ${res.status}: ${body.error}`);
  }

  // 3. Test wrong password login rejection (401)
  console.log("\n▶ Step 3: Testing Login Authentication with Wrong Password");
  const targetUsername = `u_${timestamp}_0`;
  const wrongLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: targetUsername,
      password: "000000", // target was 123456
    }),
  });
  if (wrongLoginRes.status !== 401) {
    throw new Error(`FAIL: Wrong password login returned ${wrongLoginRes.status} instead of 401`);
  }
  console.log(`  ✔ Wrong password login correctly rejected with HTTP 401 Unauthorized`);

  // 4. Test Logout & Session Invalidation
  console.log("\n▶ Step 4: Testing Logout & Session Invalidation");
  const legitLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: targetUsername,
      password: "123456",
    }),
  });
  const legitCookie = legitLoginRes.headers.get("set-cookie")?.split(";")[0]!;

  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: legitCookie },
  });
  if (logoutRes.status !== 200) {
    throw new Error(`FAIL: Logout returned ${logoutRes.status}`);
  }
  console.log("  ✔ Logout completed successfully (HTTP 200)");

  const postLogoutMe = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: legitCookie },
  });
  const postLogoutBody = await postLogoutMe.json();
  if (postLogoutBody.user !== null) {
    throw new Error("FAIL: Session still valid after logout!");
  }
  console.log("  ✔ Session properly invalidated after logout");

  // 5. Protected pages check
  console.log("\n▶ Step 5: Testing Protected API Endpoints without Auth");
  const unauthFeed = await fetch(`${BASE_URL}/api/posts`);
  console.log(`  ✔ Public/feed endpoint responsive (HTTP ${unauthFeed.status})`);

  console.log("\n==================================================================");
  console.log("   🎉 ALL E2E 6-DIGIT AUTHENTICATION TESTS PASSED PERFECTLY!     ");
  console.log("==================================================================");
}

runE2EAuthTests().catch((err) => {
  console.error("E2E Test failed:", err);
  process.exit(1);
});
