import os
import sys
import random
import requests
from typing import Dict, Any

BASE_URL = os.getenv("HOST_URL", "http://localhost:3000")

def run_test():
    print("=" * 64)
    print("   INSTAGROM - PYTHON MULTI-CLIENT SIMULATION TEST SUITE")
    print(f"   Target Server: {BASE_URL}")
    print("=" * 64 + "\n")

    run_id = random.randint(1000, 9999)
    students = {
        "A": {
            "username": f"student_a_{run_id}",
            "displayName": "Alice Student (PC A)",
            "password": "123456",
            "session": requests.Session(),
            "userId": None,
        },
        "B": {
            "username": f"student_b_{run_id}",
            "displayName": "Bob Student (PC B)",
            "password": "123456",
            "session": requests.Session(),
            "userId": None,
        },
        "C": {
            "username": f"student_c_{run_id}",
            "displayName": "Charlie Student (PC C)",
            "password": "123456",
            "session": requests.Session(),
            "userId": None,
        },
    }

    # 1. Health check
    print("[1/8] Verifying Server Health...")
    r = requests.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200, f"Health check failed: {r.status_code} {r.text}"
    print("  -> Server is HEALTHY (200 OK)")

    # 2. Registration & Login
    print("\n[2/8] Testing Multi-Student Registration & Session Isolation...")
    for key, s in students.items():
        reg_res = s["session"].post(
            f"{BASE_URL}/api/auth/register",
            json={
                "username": s["username"],
                "displayName": s["displayName"],
                "password": s["password"],
                "confirmPassword": s["password"],
            },
        )
        assert reg_res.status_code in [201, 409], f"Registration failed for {s['username']}: {reg_res.text}"
        data = reg_res.json()
        if reg_res.status_code == 201:
            s["userId"] = data["user"]["id"]
            print(f"  -> Registered Student {key}: @{s['username']} (ID: {s['userId']})")

        # Verify /api/auth/me
        me_res = s["session"].get(f"{BASE_URL}/api/auth/me")
        assert me_res.status_code == 200, f"/api/auth/me failed for {s['username']}"
        me_data = me_res.json()
        assert me_data.get("user") is not None, f"Session cookie not recognized for Student {key}"
        s["userId"] = me_data["user"]["id"]

    # 3. Create Posts
    print("\n[3/8] Testing Post Creation & Feed Rendering...")
    post_res = students["A"]["session"].post(
        f"{BASE_URL}/api/posts",
        json={
            "imageUrl": "/uploads/posts/sample_classroom.jpg",
            "caption": f"Hello from Student Alice! Run ID #{run_id}",
        },
    )
    assert post_res.status_code == 201, f"Create post failed: {post_res.text}"
    post_data = post_res.json()
    post_id = post_data["post"]["id"]
    print(f"  -> Student A created Post (ID: {post_id})")

    # Feed check from Student B
    feed_res = students["B"]["session"].get(f"{BASE_URL}/api/posts")
    assert feed_res.status_code == 200, f"Get posts failed: {feed_res.text}"
    posts = feed_res.json().get("posts", [])
    assert any(p["id"] == post_id for p in posts), "New post not found in Student B feed"
    print(f"  -> Student B successfully viewed post in feed ({len(posts)} posts in feed)")

    # 4. Likes and Comments
    print("\n[4/8] Testing Likes & Real-time Commenting...")
    # Student B likes Student A's post
    like_res = students["B"]["session"].post(f"{BASE_URL}/api/posts/{post_id}/like")
    assert like_res.status_code == 200 and like_res.json()["liked"] is True, "Like failed"
    print(f"  -> Student B liked post (Total likes: {like_res.json()['likeCount']})")

    # Student C comments on post
    comment_res = students["C"]["session"].post(
        f"{BASE_URL}/api/posts/{post_id}/comments",
        json={"content": f"Great post Alice! - Charlie #{run_id}"},
    )
    assert comment_res.status_code == 201, f"Comment failed: {comment_res.text}"
    print(f"  -> Student C commented on post (Total comments: {comment_res.json()['commentCount']})")

    # 5. Direct Messaging
    print("\n[5/8] Testing 1-on-1 Direct Messaging & Notifications...")
    # Student A opens conversation with Student B
    dm_res = students["A"]["session"].post(
        f"{BASE_URL}/api/messages",
        json={
            "recipientUsername": students["B"]["username"],
            "content": f"Hey Bob! Are you ready for class today? #{run_id}",
        },
    )
    assert dm_res.status_code in [200, 201], f"Send message failed: {dm_res.text}"
    conv_id = dm_res.json()["conversationId"]
    print(f"  -> Student A sent direct message to Student B (Conv ID: {conv_id})")

    # Student B reads messages
    b_msgs = students["B"]["session"].get(f"{BASE_URL}/api/messages/{conv_id}")
    assert b_msgs.status_code == 200, f"Get messages failed: {b_msgs.text}"
    print(f"  -> Student B retrieved conversation ({len(b_msgs.json()['messages'])} message(s))")

    # Student B sends read receipt
    read_res = students["B"]["session"].patch(f"{BASE_URL}/api/messages/{conv_id}/read")
    assert read_res.status_code == 200, f"Mark read failed: {read_res.text}"
    print("  -> Student B marked messages as READ")

    # 6. Notifications & Unread Counts
    print("\n[6/8] Testing Notification Center...")
    notif_res = students["A"]["session"].get(f"{BASE_URL}/api/notifications")
    assert notif_res.status_code == 200, f"Get notifications failed: {notif_res.text}"
    notifs = notif_res.json().get("notifications", [])
    print(f"  -> Student A received {len(notifs)} notification(s)")

    unread_res = students["A"]["session"].get(f"{BASE_URL}/api/notifications/unread-count")
    assert unread_res.status_code == 200, f"Unread count failed: {unread_res.text}"
    print(f"  -> Student A unread counts: {unread_res.json()}")

    # 7. Follows & Profile View
    print("\n[7/8] Testing Social Graph (Follows & Profiles)...")
    follow_res = students["C"]["session"].post(f"{BASE_URL}/api/users/{students['A']['username']}/follow")
    assert follow_res.status_code == 200 and follow_res.json()["isFollowing"] is True, "Follow failed"
    print(f"  -> Student C followed Student A (Followers: {follow_res.json()['followerCount']})")

    profile_res = students["C"]["session"].get(f"{BASE_URL}/api/users/{students['A']['username']}")
    assert profile_res.status_code == 200, f"Profile get failed: {profile_res.text}"
    prof = profile_res.json()["user"]
    print(f"  -> Profile @{prof['username']} verified: {prof['postCount']} posts, {prof['followerCount']} followers")

    # 8. Search & Presence
    print("\n[8/8] Testing Search & Active Presence Heartbeat...")
    search_res = students["B"]["session"].get(f"{BASE_URL}/api/search?q={students['A']['username']}")
    assert search_res.status_code == 200, f"Search failed: {search_res.text}"
    found_users = search_res.json().get("users", [])
    assert any(u["username"] == students["A"]["username"] for u in found_users), "Search did not return user"
    print(f"  -> Search for @{students['A']['username']} succeeded")

    hb_res = students["A"]["session"].post(f"{BASE_URL}/api/presence/heartbeat")
    assert hb_res.status_code == 200, f"Presence heartbeat failed: {hb_res.text}"
    print("  -> Presence heartbeat recorded")

    print("\n" + "=" * 64)
    print("   ALL TESTS PASSED SUCCESSFULLY! (100% PYTHON COMPATIBLE)")
    print("=" * 64 + "\n")

if __name__ == "__main__":
    run_test()
