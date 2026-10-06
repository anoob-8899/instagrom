export {};

async function testHttpEndpoints() {
  const BASE_URL = "http://localhost:3000";
  console.log("=== TESTING LIVE INSTAGROM HTTP API ENDPOINTS ===");

  const testUsername = `user_${Date.now().toString(36)}`;
  // 1. Register a test user
  const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: testUsername,
      displayName: "System A Student",
      password: "123456",
      confirmPassword: "123456",
    }),
  });

  const registerData = await registerRes.json();
  console.log("1. Register response status:", registerRes.status);
  console.log("   Register body:", registerData);

  const cookieHeader = registerRes.headers.get("set-cookie");
  console.log("   Received session cookie:", cookieHeader ? "YES (HTTP-only)" : "NO");

  if (registerRes.status !== 201 || !cookieHeader) {
    throw new Error("FAIL: Register endpoint did not return 201 or set cookie");
  }

  // Extract session cookie
  const sessionCookie = cookieHeader.split(";")[0];

  // 2. Test duplicate registration (should return 409)
  const dupRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: testUsername,
      displayName: "Duplicate User",
      password: "123456",
      confirmPassword: "123456",
    }),
  });
  console.log("2. Duplicate register status:", dupRes.status, "(expected 409)");
  if (dupRes.status !== 409) {
    throw new Error("FAIL: Duplicate register did not return 409");
  }

  // 3. Test /api/auth/me with session cookie
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: sessionCookie },
  });
  const meData = await meRes.json();
  console.log("3. /api/auth/me authenticated user:", meData.user?.username);
  if (meData.user?.username !== testUsername) {
    throw new Error("FAIL: /api/auth/me failed to validate session cookie");
  }

  // 4. Test login with wrong password (should return 401)
  const wrongLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: testUsername,
      password: "654321",
    }),
  });
  console.log("4. Wrong password login status:", wrongLoginRes.status, "(expected 401)");
  if (wrongLoginRes.status !== 401) {
    throw new Error("FAIL: Wrong password was not rejected with 401");
  }

  // 5. Test login with correct credentials
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: testUsername,
      password: "123456",
    }),
  });
  const loginData = await loginRes.json();
  const loginCookie = loginRes.headers.get("set-cookie")?.split(";")[0];
  console.log("5. Correct login status:", loginRes.status, "User:", loginData.user?.username);
  if (loginRes.status !== 200 || !loginCookie) {
    throw new Error("FAIL: Login failed or did not set session cookie");
  }

  // 6. Test logout
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: loginCookie },
  });
  console.log("6. Logout status:", logoutRes.status);

  // 7. Verify session invalidated after logout
  const postLogoutMe = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: loginCookie },
  });
  const postLogoutData = await postLogoutMe.json();
  console.log("7. /api/auth/me after logout user:", postLogoutData.user);
  if (postLogoutData.user !== null) {
    throw new Error("FAIL: Session still valid after logout!");
  }

  console.log("\nALL LIVE HTTP ENDPOINT TESTS PASSED SUCCESSFULLY! 🚀");
}

testHttpEndpoints().catch((err) => {
  console.error("HTTP test failed:", err);
  process.exit(1);
});
