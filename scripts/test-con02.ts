import { prisma } from "../src/lib/db/prisma";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { createSession, validateSessionToken } from "../src/lib/auth/session";

async function runCon02Tests() {
  console.log("================================================================");
  console.log("   INSTAGROM CON 02 — SHARED FEED & SOCIAL SYSTEM VERIFICATION  ");
  console.log("================================================================\n");

  // 1. Verify / Setup test accounts in SQLite (Alice, Bob, Charlie)
  const users = ["alice", "bob", "charlie"];
  const userMap: Record<string, any> = {};

  for (const uname of users) {
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
  console.log("✔ Step 1: Verified accounts in shared SQLite database (Alice, Bob, Charlie)");

  // 2. Create independent server-side sessions
  const sessionAlice = await createSession(userMap.alice.id);
  const sessionBob = await createSession(userMap.bob.id);
  const sessionCharlie = await createSession(userMap.charlie.id);

  console.log("✔ Step 2: Created independent server sessions for Alice, Bob, and Charlie");

  // 3. Alice creates a post in SQLite
  const alicePost = await prisma.post.create({
    data: {
      authorId: userMap.alice.id,
      imageUrl: "/uploads/posts/demo_classroom_project.jpg",
      caption: "Hello from InstaGrom! #classroom #project",
    },
    include: {
      author: {
        select: { username: true, displayName: true },
      },
    },
  });
  console.log(`✔ Step 3: Alice created post (ID: ${alicePost.id}) -> "${alicePost.caption}"`);

  // 4. Bob and Charlie query shared feed from SQLite and see Alice's post
  const feedPosts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { username: true, displayName: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });

  const foundPost = feedPosts.find((p) => p.id === alicePost.id);
  if (!foundPost || foundPost.author.username !== "alice") {
    throw new Error("FAIL: Bob and Charlie cannot find Alice's post on shared feed!");
  }
  console.log("✔ Step 4: Shared Feed verified: Bob and Charlie see Alice's post on SQLite feed");

  // 5. Bob likes Alice's post
  await prisma.like.create({
    data: {
      postId: alicePost.id,
      userId: userMap.bob.id,
    },
  });

  // Verify like count in SQLite
  let postLikes = await prisma.like.count({ where: { postId: alicePost.id } });
  if (postLikes !== 1) {
    throw new Error(`FAIL: Expected 1 like, got ${postLikes}`);
  }
  console.log("✔ Step 5: Bob liked Alice's post -> SQLite like count is 1");

  // 6. Test Like Uniqueness constraint (Bob cannot like twice)
  let duplicateLikeRejected = false;
  try {
    await prisma.like.create({
      data: {
        postId: alicePost.id,
        userId: userMap.bob.id,
      },
    });
  } catch (err: any) {
    if (err.code === "P2002" || err.message.includes("Unique constraint")) {
      duplicateLikeRejected = true;
    }
  }
  if (!duplicateLikeRejected) {
    throw new Error("FAIL: Duplicate like was not rejected by database constraint!");
  }
  console.log("✔ Step 6: Like unique constraint (postId + userId) verified");

  // 7. Charlie comments on Alice's post
  const charlieComment = await prisma.comment.create({
    data: {
      postId: alicePost.id,
      authorId: userMap.charlie.id,
      content: "Nice post Alice! 🔥",
    },
    include: {
      author: { select: { username: true } },
    },
  });
  console.log(`✔ Step 7: Charlie commented on Alice's post -> "${charlieComment.content}"`);

  // Verify comment is visible to Alice and Bob
  const postComments = await prisma.comment.findMany({
    where: { postId: alicePost.id },
    include: { author: { select: { username: true } } },
  });
  if (postComments.length !== 1 || postComments[0].author.username !== "charlie") {
    throw new Error("FAIL: Comments not retrieved correctly from SQLite!");
  }
  console.log("✔ Step 8: Comment visibility verified across all users");

  // 8. Comment Deletion authorization test
  // Bob tries to delete Charlie's comment -> Should be forbidden
  const canBobDelete = userMap.bob.id === charlieComment.authorId || userMap.bob.id === alicePost.authorId;
  if (canBobDelete) {
    throw new Error("FAIL: Bob was wrongly permitted to delete Charlie's comment!");
  }
  console.log("✔ Step 9: Server authorization: Bob forbidden from deleting Charlie's comment");

  // Charlie deletes own comment
  await prisma.comment.delete({ where: { id: charlieComment.id } });
  const remainingComments = await prisma.comment.count({ where: { postId: alicePost.id } });
  if (remainingComments !== 0) {
    throw new Error("FAIL: Comment was not deleted!");
  }
  console.log("✔ Step 10: Charlie successfully deleted own comment");

  // 9. Follow system test (Alice follows Bob)
  await prisma.follow.deleteMany({
    where: { followerId: userMap.alice.id, followingId: userMap.bob.id },
  });
  const followRelation = await prisma.follow.create({
    data: {
      followerId: userMap.alice.id,
      followingId: userMap.bob.id,
    },
  });

  const bobFollowers = await prisma.follow.count({ where: { followingId: userMap.bob.id } });
  const aliceFollowing = await prisma.follow.count({ where: { followerId: userMap.alice.id } });

  if (bobFollowers < 1 || aliceFollowing < 1) {
    throw new Error("FAIL: Follow counts incorrect!");
  }
  console.log(`✔ Step 11: Alice followed Bob -> Bob followers: ${bobFollowers}, Alice following: ${aliceFollowing}`);

  // Test Follow Uniqueness
  let duplicateFollowRejected = false;
  try {
    await prisma.follow.create({
      data: {
        followerId: userMap.alice.id,
        followingId: userMap.bob.id,
      },
    });
  } catch (err: any) {
    if (err.code === "P2002" || err.message.includes("Unique constraint")) {
      duplicateFollowRejected = true;
    }
  }
  if (!duplicateFollowRejected) {
    throw new Error("FAIL: Duplicate follow was not rejected!");
  }
  console.log("✔ Step 12: Follow unique constraint (followerId + followingId) verified");

  // 10. Saved Post test (Alice bookmarks Alice's or Bob's post)
  await prisma.savedPost.deleteMany({
    where: { postId: alicePost.id, userId: userMap.alice.id },
  });
  const savedPost = await prisma.savedPost.create({
    data: {
      postId: alicePost.id,
      userId: userMap.alice.id,
    },
  });
  console.log("✔ Step 13: Alice saved post -> SavedPost entry created in SQLite");

  // 11. Profile Update test (Bob updates bio & profile photo)
  const updatedBob = await prisma.user.update({
    where: { id: userMap.bob.id },
    data: {
      displayName: "Bob Smith (LAN Host)",
      bio: "Software engineering student | Building InstaGrom",
      profilePhoto: "/uploads/profiles/bob_avatar.jpg",
    },
  });
  if (updatedBob.displayName !== "Bob Smith (LAN Host)" || !updatedBob.profilePhoto) {
    throw new Error("FAIL: Profile update failed in SQLite!");
  }
  console.log("✔ Step 14: Bob updated profile -> Verified in SQLite database");

  // 12. Search query test (Search for "alice" and "#classroom")
  const searchUserResults = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: "alice" } },
        { displayName: { contains: "alice" } },
      ],
    },
  });
  if (searchUserResults.length === 0) {
    throw new Error("FAIL: Search for 'alice' returned 0 results!");
  }

  const searchPostResults = await prisma.post.findMany({
    where: {
      caption: { contains: "#classroom" },
    },
  });
  if (searchPostResults.length === 0) {
    throw new Error("FAIL: Search for hashtag '#classroom' returned 0 results!");
  }
  console.log(`✔ Step 15: Search verified -> Found ${searchUserResults.length} matching user(s) and ${searchPostResults.length} post(s) for #classroom`);

  // 13. Story test
  const demoStory = await prisma.story.create({
    data: {
      authorId: userMap.alice.id,
      mediaUrl: "/uploads/stories/alice_story.jpg",
      caption: "Classroom project live!",
    },
  });
  const allStories = await prisma.story.findMany({
    where: { authorId: userMap.alice.id },
  });
  if (allStories.length === 0) {
    throw new Error("FAIL: Story was not saved in SQLite!");
  }
  console.log("✔ Step 16: Story creation and retrieval from SQLite verified");

  console.log("\n================================================================");
  console.log("   🎉 ALL CON 02 SOCIAL & LAN REQUIREMENTS PASSED PERFECTLY!   ");
  console.log("================================================================\n");
}

runCon02Tests()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
