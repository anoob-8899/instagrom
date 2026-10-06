import os
import sys
import random
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from starlette.testclient import TestClient
from instagrom.main import app

def run_tests():
    print("=" * 64)
    print("   INSTAGROM - PYTHON FASTAPI DIRECT IN-MEMORY TEST SUITE")
    print("=" * 64 + "\n")

    client_a = TestClient(app)
    client_b = TestClient(app)
    client_c = TestClient(app)

    run_id = random.randint(1000, 9999)
    user_a = f"student_a_{run_id}"
    user_b = f"student_b_{run_id}"
    user_c = f"student_c_{run_id}"

    # 1. Health check
    print("[1/8] Verifying Health Check...")
    r = client_a.get("/api/health")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    print("  -> Status 200 OK: ", r.json())

    # 2. Registration & Session Isolation
    print("\n[2/8] Testing Registration & Cookies...")
    res_a = client_a.post("/api/auth/register", json={
        "username": user_a,
        "displayName": "Student Alice",
        "password": "123456",
        "confirmPassword": "123456",
    })
    assert res_a.status_code == 201, f"Reg A failed: {res_a.text}"
    user_a_id = res_a.json()["user"]["id"]
    print(f"  -> Registered @{user_a} (ID: {user_a_id})")

    res_b = client_b.post("/api/auth/register", json={
        "username": user_b,
        "displayName": "Student Bob",
        "password": "123456",
        "confirmPassword": "123456",
    })
    assert res_b.status_code == 201, f"Reg B failed: {res_b.text}"
    user_b_id = res_b.json()["user"]["id"]
    print(f"  -> Registered @{user_b} (ID: {user_b_id})")

    res_c = client_c.post("/api/auth/register", json={
        "username": user_c,
        "displayName": "Student Charlie",
        "password": "123456",
        "confirmPassword": "123456",
    })
    assert res_c.status_code == 201, f"Reg C failed: {res_c.text}"
    user_c_id = res_c.json()["user"]["id"]
    print(f"  -> Registered @{user_c} (ID: {user_c_id})")

    # Verify /api/auth/me for each client
    me_a = client_a.get("/api/auth/me").json()
    assert me_a["user"]["id"] == user_a_id, "Auth cookie mismatch for Client A"

    me_b = client_b.get("/api/auth/me").json()
    assert me_b["user"]["id"] == user_b_id, "Auth cookie mismatch for Client B"

    print("  -> Verified session isolation across clients A, B, C")

    # 3. Create Posts & Feed
    print("\n[3/8] Testing Post Creation & Feed...")
    post_res = client_a.post("/api/posts", json={
        "imageUrl": "/uploads/posts/sample.png",
        "caption": f"First post from Python backend #{run_id}",
    })
    assert post_res.status_code == 201, f"Create post failed: {post_res.text}"
    post_id = post_res.json()["post"]["id"]
    print(f"  -> Created Post ID: {post_id}")

    feed_res = client_b.get("/api/posts")
    assert feed_res.status_code == 200
    feed_posts = feed_res.json()["posts"]
    assert any(p["id"] == post_id for p in feed_posts), "Post not found in feed"
    print(f"  -> Client B read feed: {len(feed_posts)} posts found")

    # 4. Likes & Comments
    print("\n[4/8] Testing Likes & Comments...")
    like_res = client_b.post(f"/api/posts/{post_id}/like")
    assert like_res.status_code == 200
    assert like_res.json()["liked"] is True
    print(f"  -> Client B liked post (Total likes: {like_res.json()['likeCount']})")

    comment_res = client_c.post(f"/api/posts/{post_id}/comments", json={
        "content": f"Awesome post Alice! #{run_id}",
    })
    assert comment_res.status_code == 201
    print(f"  -> Client C commented (Total comments: {comment_res.json()['commentCount']})")

    # 5. Direct Messaging
    print("\n[5/8] Testing Direct Messaging...")
    dm_res = client_a.post("/api/messages", json={
        "recipientUsername": user_b,
        "content": f"Hello Bob from Python! #{run_id}",
    })
    assert dm_res.status_code in [200, 201]
    conv_id = dm_res.json()["conversationId"]
    print(f"  -> Client A messaged Client B (Conversation ID: {conv_id})")

    b_msgs = client_b.get(f"/api/messages/{conv_id}").json()["messages"]
    assert len(b_msgs) >= 1
    print(f"  -> Client B received message: '{b_msgs[-1]['content']}'")

    read_res = client_b.patch(f"/api/messages/{conv_id}/read")
    assert read_res.status_code == 200
    print("  -> Client B marked conversation as READ")

    # 6. Notifications
    print("\n[6/8] Testing Notifications & Unread Counts...")
    notifs_a = client_a.get("/api/notifications").json()["notifications"]
    print(f"  -> Client A has {len(notifs_a)} notification(s)")
    assert len(notifs_a) >= 2, "Expected LIKE and COMMENT notifications for Alice"

    unread_counts = client_a.get("/api/notifications/unread-count").json()
    print(f"  -> Unread counts for Client A: {unread_counts}")

    # 7. Follows & Profiles
    print("\n[7/8] Testing Follows & Profiles...")
    follow_res = client_c.post(f"/api/users/{user_a}/follow")
    assert follow_res.status_code == 200
    assert follow_res.json()["isFollowing"] is True
    print(f"  -> Client C followed @{user_a}")

    profile_a = client_c.get(f"/api/users/{user_a}").json()["user"]
    assert profile_a["followerCount"] >= 1
    print(f"  -> Profile @{user_a} verified: {profile_a['postCount']} post(s), {profile_a['followerCount']} follower(s)")

    # 8. Search & Presence
    print("\n[8/8] Testing Search & Presence Heartbeat...")
    search_res = client_b.get(f"/api/search?q={user_a}").json()
    assert any(u["username"] == user_a for u in search_res["users"])
    print(f"  -> Search query '{user_a}' found user successfully")

    hb_res = client_a.post("/api/presence/heartbeat")
    assert hb_res.status_code == 200
    print("  -> Presence heartbeat recorded successfully")

    print("\n" + "=" * 64)
    print("   ALL 8 TEST STAGES PASSED FLAWLESSLY! (100% PYTHON READY)")
    print("=" * 64 + "\n")

if __name__ == "__main__":
    run_tests()
