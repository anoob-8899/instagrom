import os
import sys
import json
import random
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from starlette.testclient import TestClient
from instagrom.main import app

def test_sse():
    print("=" * 64)
    print("   INSTAGROM - SSE REAL-TIME STREAM TEST")
    print("=" * 64 + "\n")

    client = TestClient(app)
    run_id = random.randint(1000, 9999)
    username = f"sse_user_{run_id}"

    # Register & login
    res = client.post("/api/auth/register", json={
        "username": username,
        "displayName": "SSE Tester",
        "password": "123456",
        "confirmPassword": "123456",
    })
    assert res.status_code == 201, f"Registration failed: {res.text}"
    user_id = res.json()["user"]["id"]
    print(f"  -> Registered @{username} (ID: {user_id})")

    # Connect to SSE stream
    with client.stream("GET", "/api/realtime/stream") as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        print("  -> Connected to /api/realtime/stream (200 OK, text/event-stream)")

        # Read initial CONNECTED event
        lines = []
        for line in response.iter_lines():
            if line:
                lines.append(line)
                if line.startswith("data:"):
                    data_str = line[len("data:"):].strip()
                    event = json.loads(data_str)
                    print(f"  -> Received Initial Handshake Event: {event}")
                    assert event["type"] == "CONNECTED"
                    assert event["payload"]["userId"] == user_id
                    break

    print("\n" + "=" * 64)
    print("   SSE STREAMING TEST PASSED SUCCESSFULLY!")
    print("=" * 64 + "\n")

if __name__ == "__main__":
    test_sse()
