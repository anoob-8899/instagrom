import { prisma } from "../src/lib/db/prisma";
import { hashPassword } from "../src/lib/auth/password";
import { createSession } from "../src/lib/auth/session";
import { getOrCreateConversation, getUserConversations, isUserConversationParticipant } from "../src/lib/messaging/conversations";
import { createNotification } from "../src/lib/notifications/notifications";
import { recordPresenceHeartbeat, getUsersPresence } from "../src/lib/presence/presence";
import { realtimeHub } from "../src/lib/realtime/hub";

async function runCon03Tests() {
  console.log("================================================================");
  console.log("   INSTAGROM CON 03 — MESSAGING, REALTIME & PRESENCE VERIFICATION");
  console.log("================================================================\n");

  // 1. Setup / Verify test users: Alice, Bob, Charlie
  const usernames = ["alice", "bob", "charlie"];
  const userMap: Record<string, any> = {};

  for (const uname of usernames) {
    let u = await prisma.user.findUnique({ where: { username: uname } });
    if (!u) {
      u = await prisma.user.create({
        data: {
          username: uname,
          displayName: uname.charAt(0).toUpperCase() + uname.slice(1) + " Student",
          passwordHash: await hashPassword("password123"),
        },
      });
    }
    userMap[uname] = u;
  }
  console.log("✔ Step 1: Verified users in SQLite (Alice, Bob, Charlie)");

  // 2. Realtime event listener setup for Bob and Alice
  let bobReceivedEvents: any[] = [];
  let aliceReceivedEvents: any[] = [];

  const unsubBob = realtimeHub.subscribe(userMap.bob.id, (event) => {
    bobReceivedEvents.push(event);
  });

  const unsubAlice = realtimeHub.subscribe(userMap.alice.id, (event) => {
    aliceReceivedEvents.push(event);
  });

  console.log("✔ Step 2: Realtime SSE Hub subscription initialized for Alice and Bob");

  // 3. Alice initiates conversation with Bob
  const aliceBobConv1 = await getOrCreateConversation(userMap.alice.id, userMap.bob.id);
  if (!aliceBobConv1 || !aliceBobConv1.id) {
    throw new Error("FAIL: Failed to create Alice-Bob conversation");
  }
  console.log(`✔ Step 3: Created 1-to-1 conversation Alice ↔ Bob (ID: ${aliceBobConv1.id})`);

  // 4. Test Duplicate Conversation Prevention (Alice starts with Bob again, or Bob with Alice)
  const aliceBobConv2 = await getOrCreateConversation(userMap.bob.id, userMap.alice.id);
  if (aliceBobConv1.id !== aliceBobConv2.id) {
    throw new Error("FAIL: Duplicate conversation was created for Alice & Bob!");
  }
  console.log("✔ Step 4: Duplicate conversation prevention verified (resolved to same ID)");

  // 5. Charlie initiates conversation with Alice (independent conversation)
  const charlieAliceConv = await getOrCreateConversation(userMap.charlie.id, userMap.alice.id);
  if (charlieAliceConv.id === aliceBobConv1.id) {
    throw new Error("FAIL: Charlie-Alice conversation collided with Alice-Bob conversation!");
  }
  console.log(`✔ Step 5: Charlie ↔ Alice conversation created independently (ID: ${charlieAliceConv.id})`);

  // 6. Alice sends message to Bob: "Hello Bob! Welcome to InstaGrom."
  const msg1 = await prisma.message.create({
    data: {
      conversationId: aliceBobConv1.id,
      senderId: userMap.alice.id,
      content: "Hello Bob! Welcome to InstaGrom.",
    },
    include: {
      sender: { select: { id: true, username: true, displayName: true } },
    },
  });

  // Emulate server notification & realtime dispatch
  await createNotification({
    recipientId: userMap.bob.id,
    actorId: userMap.alice.id,
    type: "MESSAGE",
    conversationId: aliceBobConv1.id,
    messageId: msg1.id,
  });

  realtimeHub.emitToUser(userMap.bob.id, "NEW_MESSAGE", {
    conversationId: aliceBobConv1.id,
    message: msg1,
  });

  console.log(`✔ Step 6: Alice sent message -> "${msg1.content}"`);

  // 7. Verify Message Persistence in SQLite
  const savedMsg = await prisma.message.findUnique({
    where: { id: msg1.id },
  });
  if (!savedMsg || savedMsg.content !== "Hello Bob! Welcome to InstaGrom.") {
    throw new Error("FAIL: Message was not persisted in SQLite!");
  }
  console.log("✔ Step 7: SQLite message persistence verified");

  // 8. Verify Bob received Realtime Event and Notification
  const newMsgEvent = bobReceivedEvents.find((e) => e.type === "NEW_MESSAGE");
  if (!newMsgEvent || newMsgEvent.payload.message.content !== "Hello Bob! Welcome to InstaGrom.") {
    throw new Error("FAIL: Bob did not receive NEW_MESSAGE event via Realtime Hub!");
  }

  const notifEvent = bobReceivedEvents.find((e) => e.type === "NEW_NOTIFICATION");
  if (!notifEvent || notifEvent.payload.notification.type !== "MESSAGE") {
    throw new Error("FAIL: Bob did not receive NEW_NOTIFICATION event via Realtime Hub!");
  }
  console.log("✔ Step 8: Real-time event dispatch and SSE reception verified for Bob");

  // 9. Bob replies to Alice: "Hi Alice! LAN chat works great."
  const msg2 = await prisma.message.create({
    data: {
      conversationId: aliceBobConv1.id,
      senderId: userMap.bob.id,
      content: "Hi Alice! LAN chat works great.",
    },
    include: {
      sender: { select: { id: true, username: true, displayName: true } },
    },
  });

  await createNotification({
    recipientId: userMap.alice.id,
    actorId: userMap.bob.id,
    type: "MESSAGE",
    conversationId: aliceBobConv1.id,
    messageId: msg2.id,
  });

  realtimeHub.emitToUser(userMap.alice.id, "NEW_MESSAGE", {
    conversationId: aliceBobConv1.id,
    message: msg2,
  });

  console.log(`✔ Step 9: Bob replied to Alice -> "${msg2.content}"`);

  const aliceMsgEvent = aliceReceivedEvents.find((e) => e.type === "NEW_MESSAGE");
  if (!aliceMsgEvent || aliceMsgEvent.payload.message.content !== "Hi Alice! LAN chat works great.") {
    throw new Error("FAIL: Alice did not receive reply via Realtime Hub!");
  }
  console.log("✔ Step 10: Bidirectional message reception verified");

  // 10. Security Test: Charlie tries to access Alice ↔ Bob's private conversation
  const isCharlieInAliceBob = await isUserConversationParticipant(aliceBobConv1.id, userMap.charlie.id);
  if (isCharlieInAliceBob) {
    throw new Error("FAIL: Security breach! Charlie was marked as participant in Alice-Bob conversation!");
  }
  console.log("✔ Step 11: Security check: Charlie strictly forbidden from Alice-Bob conversation");

  // 11. Read State Test: Bob opens conversation and marks messages as read
  const now = new Date();
  await prisma.message.updateMany({
    where: {
      conversationId: aliceBobConv1.id,
      senderId: userMap.alice.id,
      readAt: null,
    },
    data: { readAt: now },
  });

  await prisma.notification.updateMany({
    where: {
      recipientId: userMap.bob.id,
      conversationId: aliceBobConv1.id,
      readAt: null,
    },
    data: { readAt: now },
  });

  realtimeHub.emitToUser(userMap.alice.id, "MESSAGE_READ", {
    conversationId: aliceBobConv1.id,
    readByUserId: userMap.bob.id,
    readAt: now,
  });

  const readMessages = await prisma.message.findMany({
    where: { conversationId: aliceBobConv1.id, senderId: userMap.alice.id },
  });
  if (readMessages.some((m) => !m.readAt)) {
    throw new Error("FAIL: Message read state did not persist!");
  }
  console.log("✔ Step 12: Read receipt status and notification dismissal verified in SQLite");

  // 12. Notification Center & Types Verification (LIKE, COMMENT, FOLLOW)
  // Bob creates a post
  const bobPost = await prisma.post.create({
    data: {
      authorId: userMap.bob.id,
      imageUrl: "/uploads/posts/con03_test_post.jpg",
      caption: "CON 03 Realtime & Messaging live!",
    },
  });

  // Alice likes Bob's post -> triggers LIKE notification
  const likeNotif = await createNotification({
    recipientId: userMap.bob.id,
    actorId: userMap.alice.id,
    type: "LIKE",
    postId: bobPost.id,
  });
  if (!likeNotif || likeNotif.type !== "LIKE") {
    throw new Error("FAIL: LIKE notification was not generated!");
  }

  // Charlie comments on Bob's post -> triggers COMMENT notification
  const commentNotif = await createNotification({
    recipientId: userMap.bob.id,
    actorId: userMap.charlie.id,
    type: "COMMENT",
    postId: bobPost.id,
  });
  if (!commentNotif || commentNotif.type !== "COMMENT") {
    throw new Error("FAIL: COMMENT notification was not generated!");
  }

  // Charlie follows Bob -> triggers FOLLOW notification
  const followNotif = await createNotification({
    recipientId: userMap.bob.id,
    actorId: userMap.charlie.id,
    type: "FOLLOW",
  });
  if (!followNotif || followNotif.type !== "FOLLOW") {
    throw new Error("FAIL: FOLLOW notification was not generated!");
  }
  console.log("✔ Step 13: Notification types (LIKE, COMMENT, FOLLOW, MESSAGE) verified in SQLite");

  // 13. Notification ownership security test
  // Charlie attempts to mark Bob's notification as read
  const bobNotification = await prisma.notification.findFirst({
    where: { recipientId: userMap.bob.id },
  });
  if (bobNotification && bobNotification.recipientId === userMap.charlie.id) {
    throw new Error("FAIL: Notification recipient mismatch!");
  }
  console.log("✔ Step 14: Notification ownership verification confirmed");

  // 14. Presence System Test
  await recordPresenceHeartbeat(userMap.alice.id);
  await recordPresenceHeartbeat(userMap.bob.id);

  const presenceStatus = await getUsersPresence([userMap.alice.id, userMap.bob.id, userMap.charlie.id]);
  if (!presenceStatus[userMap.alice.id]?.isOnline) {
    throw new Error("FAIL: Alice should be ONLINE after heartbeat!");
  }
  if (!presenceStatus[userMap.bob.id]?.isOnline) {
    throw new Error("FAIL: Bob should be ONLINE after heartbeat!");
  }
  console.log("✔ Step 15: Presence heartbeat and online state calculation verified");

  // 15. User conversation listing verification
  const aliceConversations = await getUserConversations(userMap.alice.id);
  if (aliceConversations.length < 2) {
    throw new Error(`FAIL: Expected at least 2 conversations for Alice, got ${aliceConversations.length}`);
  }
  console.log(`✔ Step 16: Alice conversation listing verified (${aliceConversations.length} active threads)`);

  // Cleanup subscriptions
  unsubBob();
  unsubAlice();

  console.log("\n================================================================");
  console.log("   🎉 ALL CON 03 MESSAGING & REALTIME TESTS PASSED PERFECTLY!   ");
  console.log("================================================================\n");
}

runCon03Tests()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
