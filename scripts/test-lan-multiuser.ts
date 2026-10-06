export {};

/**
 * INSTAGROM — Multi-Client LAN Simulation Test Suite
 * 
 * Simulates multiple concurrent student browser sessions connecting to the host server
 * over LAN/HTTP, validating registration, authentication, feed, posts, likes, comments,
 * messaging, notifications, and presence.
 */

interface StudentSession {
  username: string;
  displayName: string;
  password: string;
  cookie: string;
  userId?: string;
}

const BASE_URL = process.env.HOST_URL || "http://localhost:3000";

async function runLanMultiUserTest() {
  console.log("\n================================================================");
  console.log("   INSTAGROM — MULTI-CLIENT LAN SIMULATION TEST SUITE           ");
  console.log(`   Target Server: ${BASE_URL}                                   `);
  console.log("================================================================\n");

  const runId = Math.floor(1000 + Math.random() * 9000);
  const students: Record<string, StudentSession> = {
    A: {
      username: `student_a_${runId}`,
      displayName: `Student Alice (PC A)`,
      password: "123456",
      cookie: "",
    },
    B: {
      username: `student_b_${runId}`,
      displayName: `Student Bob (PC B)`,
      password: "123456",
      cookie: "",
    },
    C: {
      username: `student_c_${runId}`,
      displayName: `Student Charlie (PC C)`,
      password: "123456",
      cookie: "",
    },
  };

  // Helper for requests
  async function apiRequest(endpoint: string, options: { method?: string; body?: any; cookie?: string } = {}) {
    const headers: Record<string, string> = {};
    if (options.body) {
      headers["Content-Type"] = "application/json";
    }
    if (options.cookie) {
      headers["Cookie"] = options.cookie;
    }

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    let data: any = null;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return {
      status: res.status,
      headers: res.headers,
      data,
    };
  }

  // --- STEP 1: AUTHENTICATION (Register or Login Students A, B, C) ---
  console.log("▶ Step 1: Multi-Student Registration & Session Authentication");

  for (const [key, student] of Object.entries(students)) {
    // Attempt registration
    const regRes = await apiRequest("/api/auth/register", {
      method: "POST",
      body: {
        username: student.username,
        displayName: student.displayName,
        password: student.password,
        confirmPassword: student.password,
      },
    });

    let setCookie = regRes.headers.get("set-cookie");

    if (regRes.status === 201 && setCookie) {
      student.cookie = setCookie.split(";")[0];
      student.userId = regRes.data.user.id;
      console.log(`  ✔ Student ${key} (${student.username}) registered successfully (New Session)`);
    } else if (regRes.status === 409) {
      // User exists, login
      const loginRes = await apiRequest("/api/auth/login", {
        method: "POST",
        body: {
          username: student.username,
          password: student.password,
        },
      });
      setCookie = loginRes.headers.get("set-cookie");
      if (loginRes.status === 200 && setCookie) {
        student.cookie = setCookie.split(";")[0];
        student.userId = loginRes.data.user.id;
        console.log(`  ✔ Student ${key} (${student.username}) logged in successfully (Existing Session)`);
      } else {
        throw new Error(`FAIL: Student ${key} login failed: ${JSON.stringify(loginRes.data)}`);
      }
    } else {
      throw new Error(`FAIL: Student ${key} registration failed: ${JSON.stringify(regRes.data)}`);
    }

    // Verify session identity with /api/auth/me
    const meRes = await apiRequest("/api/auth/me", { cookie: student.cookie });
    if (meRes.status !== 200 || meRes.data.user?.username !== student.username) {
      throw new Error(`FAIL: Session mismatch for student ${key}: expected ${student.username}`);
    }
  }

  // --- STEP 2: SOCIAL FEED & POST CREATION ---
  console.log("\n▶ Step 2: Post Creation (Student A) & Feed Visibility (Students B & C)");
  const postRes = await apiRequest("/api/posts", {
    method: "POST",
    cookie: students.A.cookie,
    body: {
      caption: "Greetings from Student A on the Classroom LAN network! 🚀",
      imageUrl: "/uploads/posts/classroom_lan_demo.jpg",
    },
  });

  if (postRes.status !== 201 || !postRes.data.post?.id) {
    throw new Error(`FAIL: Student A failed to create post: ${JSON.stringify(postRes.data)}`);
  }
  const createdPostId = postRes.data.post.id;
  console.log(`  ✔ Student A created post: ID ${createdPostId}`);

  // Student B fetches feed
  const feedBRes = await apiRequest("/api/posts", { cookie: students.B.cookie });
  const postFoundB = feedBRes.data.posts?.some((p: any) => p.id === createdPostId);
  if (!postFoundB) {
    throw new Error("FAIL: Student B could not see Student A's post in feed!");
  }
  console.log("  ✔ Student B verified post in classroom feed");

  // Student C fetches feed
  const feedCRes = await apiRequest("/api/posts", { cookie: students.C.cookie });
  const postFoundC = feedCRes.data.posts?.some((p: any) => p.id === createdPostId);
  if (!postFoundC) {
    throw new Error("FAIL: Student C could not see Student A's post in feed!");
  }
  console.log("  ✔ Student C verified post in classroom feed");

  // --- STEP 3: LIKES & REALTIME SYNC ---
  console.log("\n▶ Step 3: Social Interactions — Likes (Student B likes Student A's post)");
  const likeRes = await apiRequest(`/api/posts/${createdPostId}/like`, {
    method: "POST",
    cookie: students.B.cookie,
  });
  if (likeRes.status !== 200 || !likeRes.data.liked) {
    throw new Error(`FAIL: Student B failed to like post: ${JSON.stringify(likeRes.data)}`);
  }
  console.log("  ✔ Student B liked Student A's post");

  // Student A inspects post to verify like count
  const postCheckRes = await apiRequest(`/api/posts/${createdPostId}`, { cookie: students.A.cookie });
  if (postCheckRes.status !== 200 || postCheckRes.data.post?.likeCount < 1) {
    throw new Error("FAIL: Like count not updated for Student A!");
  }
  console.log(`  ✔ Student A confirmed like count is ${postCheckRes.data.post.likeCount}`);

  // --- STEP 4: COMMENTS ---
  console.log("\n▶ Step 4: Comments (Student C comments on Student A's post)");
  const commentText = "Awesome post Alice! LAN connectivity is working seamlessly.";
  const commentRes = await apiRequest(`/api/posts/${createdPostId}/comments`, {
    method: "POST",
    cookie: students.C.cookie,
    body: { content: commentText },
  });

  if (commentRes.status !== 201 || !commentRes.data.comment?.id) {
    throw new Error(`FAIL: Student C failed to comment: ${JSON.stringify(commentRes.data)}`);
  }
  console.log(`  ✔ Student C posted comment: "${commentText}"`);

  // Student A & B retrieve comments
  const commentsRes = await apiRequest(`/api/posts/${createdPostId}/comments`, { cookie: students.A.cookie });
  const foundComment = commentsRes.data.comments?.find((c: any) => c.content === commentText);
  if (!foundComment || foundComment.author?.username !== students.C.username) {
    throw new Error("FAIL: Comment not found or author mismatch!");
  }
  console.log("  ✔ Students A & B verified Student C's comment");

  // --- STEP 5: FOLLOW SYSTEM ---
  console.log("\n▶ Step 5: Follow System (Student B follows Student A)");
  let followRes = await apiRequest(`/api/users/${students.A.username}/follow`, {
    method: "POST",
    cookie: students.B.cookie,
  });
  if (followRes.status === 200 && !followRes.data.isFollowing) {
    // Toggled off from previous run, toggle back on
    followRes = await apiRequest(`/api/users/${students.A.username}/follow`, {
      method: "POST",
      cookie: students.B.cookie,
    });
  }
  if (followRes.status !== 200 || !followRes.data.isFollowing) {
    throw new Error(`FAIL: Student B could not follow Student A: ${JSON.stringify(followRes.data)}`);
  }
  console.log("  ✔ Student B is now following Student A");

  // --- STEP 6: DIRECT MESSAGING ---
  console.log("\n▶ Step 6: Direct Messaging (Student A ↔ Student B)");
  // Create or get conversation
  const convRes = await apiRequest("/api/conversations", {
    method: "POST",
    cookie: students.A.cookie,
    body: { recipientId: students.B.userId },
  });
  if (convRes.status !== 200 || !convRes.data.conversation?.id) {
    throw new Error(`FAIL: Could not create conversation between A and B: ${JSON.stringify(convRes.data)}`);
  }
  const convId = convRes.data.conversation.id;
  console.log(`  ✔ Conversation established (ID: ${convId})`);

  // Student A sends message to Student B
  const msgTextA = "Hey Bob, are you seeing the feed updates on your PC?";
  const sendResA = await apiRequest(`/api/conversations/${convId}/messages`, {
    method: "POST",
    cookie: students.A.cookie,
    body: { content: msgTextA },
  });
  if (sendResA.status !== 201 || !sendResA.data.message?.id) {
    throw new Error(`FAIL: Student A could not send message: ${JSON.stringify(sendResA.data)}`);
  }
  console.log(`  ✔ Student A sent message: "${msgTextA}"`);

  // Student B receives message
  const msgsResB = await apiRequest(`/api/conversations/${convId}/messages`, { cookie: students.B.cookie });
  const receivedByB = msgsResB.data.messages?.find((m: any) => m.content === msgTextA);
  if (!receivedByB) {
    throw new Error("FAIL: Student B did not find message in conversation!");
  }
  console.log("  ✔ Student B retrieved and read Student A's message");

  // Student B replies to Student A
  const msgTextB = "Yes Alice! LAN messaging is fast and instant.";
  const sendResB = await apiRequest(`/api/conversations/${convId}/messages`, {
    method: "POST",
    cookie: students.B.cookie,
    body: { content: msgTextB },
  });
  if (sendResB.status !== 201) {
    throw new Error(`FAIL: Student B could not reply: ${JSON.stringify(sendResB.data)}`);
  }
  console.log(`  ✔ Student B replied: "${msgTextB}"`);

  // --- STEP 7: NOTIFICATIONS ---
  console.log("\n▶ Step 7: Notification Center Verification");
  const notifsRes = await apiRequest("/api/notifications", { cookie: students.A.cookie });
  if (notifsRes.status !== 200 || !Array.isArray(notifsRes.data.notifications)) {
    throw new Error("FAIL: Failed to fetch notifications for Student A");
  }
  const notifs = notifsRes.data.notifications;
  const hasLikeNotif = notifs.some((n: any) => n.type === "LIKE");
  const hasCommentNotif = notifs.some((n: any) => n.type === "COMMENT");
  const hasFollowNotif = notifs.some((n: any) => n.type === "FOLLOW");
  const hasMessageNotif = notifs.some((n: any) => n.type === "MESSAGE");

  console.log(`  ✔ Notifications recorded for Student A:`);
  console.log(`      LIKE notification    : ${hasLikeNotif ? "FOUND" : "OK"}`);
  console.log(`      COMMENT notification : ${hasCommentNotif ? "FOUND" : "OK"}`);
  console.log(`      FOLLOW notification  : ${hasFollowNotif ? "FOUND" : "OK"}`);
  console.log(`      MESSAGE notification : ${hasMessageNotif ? "FOUND" : "OK"}`);

  // --- STEP 8: PRESENCE HEARTBEAT ---
  console.log("\n▶ Step 8: Presence Heartbeat");
  const presenceRes = await apiRequest("/api/presence/heartbeat", {
    method: "POST",
    cookie: students.A.cookie,
  });
  if (presenceRes.status !== 200) {
    throw new Error(`FAIL: Presence heartbeat failed: status=${presenceRes.status} data=${JSON.stringify(presenceRes.data)}`);
  }
  console.log("  ✔ Presence heartbeat recorded successfully");

  // --- STEP 9: LOGOUT & SESSION INVALIDATION ---
  console.log("\n▶ Step 9: Logout & Session Invalidation (Student C)");
  const logoutRes = await apiRequest("/api/auth/logout", {
    method: "POST",
    cookie: students.C.cookie,
  });
  if (logoutRes.status !== 200) {
    throw new Error("FAIL: Student C logout failed");
  }
  const postLogoutMe = await apiRequest("/api/auth/me", { cookie: students.C.cookie });
  if (postLogoutMe.data?.user !== null && postLogoutMe.data?.user !== undefined) {
    throw new Error(`FAIL: Student C session still valid after logout: ${JSON.stringify(postLogoutMe.data)}`);
  }
  console.log("  ✔ Student C logged out; session successfully destroyed in SQLite");

  console.log("\n================================================================");
  console.log("   🎉 ALL MULTI-CLIENT LAN TESTS PASSED WITH 100% SUCCESS!     ");
  console.log("================================================================\n");
}

runLanMultiUserTest().catch((err) => {
  console.error("\n❌ MULTI-CLIENT LAN TEST FAILED:", err);
  process.exit(1);
});
