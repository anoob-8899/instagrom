export {};

const BASE_URL = process.env.HOST_URL || "http://127.0.0.1:3000";

async function testSseStream() {
  console.log(`Connecting to SSE stream at ${BASE_URL}...`);
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "student_a", password: "123456" }),
  });
  const cookie = loginRes.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Could not log in student_a");

  console.log("Logged in successfully. Connecting to /api/realtime/stream...");
  const sseRes = await fetch(`${BASE_URL}/api/realtime/stream`, {
    headers: { Cookie: cookie },
  });

  console.log("SSE HTTP Status:", sseRes.status);
  console.log("SSE Content-Type:", sseRes.headers.get("content-type"));

  if (sseRes.status !== 200) {
    throw new Error(`SSE stream failed with status ${sseRes.status}`);
  }

  const reader = sseRes.body?.getReader();
  if (!reader) throw new Error("Stream reader not available");

  const decoder = new TextDecoder();
  const { value, done } = await reader.read();
  if (value) {
    const text = decoder.decode(value);
    console.log("Received initial SSE payload:\n", text);
  }
  await reader.cancel();
  console.log("✔ SSE Realtime Stream Connection verified successfully!");
}

testSseStream().catch((err) => {
  console.error("SSE Test failed:", err);
  process.exit(1);
});
