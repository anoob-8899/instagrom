# INSTAGROM

> **Classroom Local Area Network (LAN) Social Media Platform**

**INSTAGROM** is a complete, self-contained social media platform designed specifically for local classroom and workshop environments. One Windows computer acts as the **Host Server**, while all student computers on the same Local Area Network (LAN) or Wi-Fi connect seamlessly using standard web browsers.

---

## 🏛️ Local Classroom Architecture

```text
  Student PC A                Student PC B                Student PC C
(http://10.71.119.74:3000)  (http://10.71.119.74:3000)  (http://10.71.119.74:3000)
       │                           │                           │
       └───────────────────────────┼───────────────────────────┘
                                   │
                           CLASSROOM WI-FI / LAN
                                   │
                                   ▼
                ┌─────────────────────────────────────┐
                │          WINDOWS HOST PC            │
                │        0.0.0.0 : 3000 (LAN)         │
                │                                     │
                │   ┌─────────────────────────────┐   │
                │   │     Next.js 15 App Router   │   │
                │   │  (SSR, API Routes, SSE Hub) │   │
                │   └──────────────┬──────────────┘   │
                │                  │                  │
                │   ┌──────────────┴──────────────┐   │
                │   │       Prisma ORM            │   │
                │   └──────────────┬──────────────┘   │
                │                  │                  │
                │   ┌──────────────┴──────────────┐   │
                │   │     Local SQLite DB         │   │
                │   │  (data/instagrom.sqlite)    │   │
                │   └─────────────────────────────┘   │
                │   ┌─────────────────────────────┐   │
                │   │   Local Filesystem Storage  │   │
                │   │     (public/uploads/*)      │   │
                │   └─────────────────────────────┘   │
                └─────────────────────────────────────┘
```

* **Single Source of Truth**: The Windows Host PC maintains the SQLite database (`data/instagrom.sqlite`) and media storage (`public/uploads/`).
* **Zero Cloud Dependencies**: 100% offline-capable. No AWS, Cloudinary, Firebase, Supabase, Neon, or Vercel required.
* **No Direct File Access**: Students never touch the SQLite file or filesystem directly; all operations flow through secure HTTP API routes.
* **Realtime SSE Updates**: Live direct messaging, notification badges, and active presence powered by Server-Sent Events (SSE).

---

# Running INSTAGROM on a Local Classroom Network

Follow these step-by-step instructions to set up and run INSTAGROM in your classroom.

### 📋 Prerequisites (Host PC)
* **Operating System**: Windows 10/11 (or macOS/Linux)
* **Node.js**: v18.17.0 or higher
* **Network**: Host PC and all student devices must be connected to the **same Wi-Fi router or Local Area Network (LAN)**.

---

### 🛠️ 1. Host Machine Setup & Installation

Open **PowerShell** or **Command Prompt** in the project directory:

```powershell
# 1. Install all required dependencies
npm install

# 2. Push Prisma schema to the local SQLite database (Non-destructive)
npm run db:push
```

> [!NOTE]
> `data/instagrom.sqlite` will be created automatically if it doesn't exist. Existing posts, comments, accounts, and messages are always preserved.

---

### 🔍 2. Identifying the Host IPv4 Address

To allow students to connect, you need the Host PC's local IPv4 address.

#### Option A: Use the Built-In INSTAGROM Tool (Recommended)
```powershell
npm run lan:info
```
This utility automatically inspects your network adapters and displays the exact connection URLs:
```text
================================================================
   📸 INSTAGROM — LOCAL CLASSROOM LAN HOST CONFIGURATION        
================================================================
  Host Computer Name : VINCENT-PC
  Port               : 3000
  Binding            : 0.0.0.0 (All local interfaces)

  🌐 Active LAN Connection URLs (For Student Computers):
  ────────────────────────────────────────────────────────
  [1] Adapter "Wi-Fi":
      IPv4 Address : 10.71.119.74
      Student URL  : http://10.71.119.74:3000
  ────────────────────────────────────────────────────────
```

#### Option B: Windows `ipconfig` Command
1. Open PowerShell and type:
   ```powershell
   ipconfig
   ```
2. Look for your active adapter (e.g., `Wireless LAN adapter Wi-Fi` or `Ethernet adapter`).
3. Locate the **IPv4 Address** (e.g., `10.71.119.74` or `192.168.1.25`).

---

### 🛡️ 3. Windows Firewall Configuration

If student computers cannot reach port `3000`, open **PowerShell as Administrator** on the Host PC and run:

```powershell
New-NetFirewallRule `
  -DisplayName "INSTAGROM Classroom Server" `
  -Direction Inbound `
  -LocalPort 3000 `
  -Protocol TCP `
  -Action Allow `
  -Profile Private
```

> [!IMPORTANT]
> This rule opens port 3000 only on the **Private** local network profile, ensuring the server is accessible only on the classroom LAN and never exposed to the public internet.

---

### 🚀 4. Starting the Server for the Classroom

#### Recommended Classroom Production Mode (Fast & Optimized):
```powershell
npm run build
npm run start:lan
```

#### Development Mode (With Hot-Reloading):
```powershell
npm run dev:lan
```

Both commands bind to `0.0.0.0:3000`, allowing inbound connections from any device on the local network.

> [!IMPORTANT]
> **Keep the terminal window open** while class is in session. The Host PC must stay powered on and connected to the Wi-Fi.

---

### 💻 5. Student Device Connection Guide

On each student computer / tablet / phone connected to the classroom Wi-Fi:

1. Open any modern web browser (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari).
2. Type the Host PC's address in the URL bar:
   ```text
   http://<HOST-IP>:3000
   ```
   *(Example: `http://10.71.119.74:3000` or `http://192.168.1.25:3000`)*

> [!WARNING]
> Do **NOT** type `localhost:3000` on student computers. `localhost` refers to the student's own computer. Students must enter the Host PC's IPv4 address.

3. Students can now:
   * **Register**: Create their individual student profile (`/register`).
   * **Login**: Access their account with secure session cookies (`/login`).
   * **Explore Feed**: Browse, create posts with photo uploads, like, and comment (`/feed`).
   * **Follow Classmates**: Follow peers and view user profiles (`/profile/[username]`).
   * **Direct Messaging**: Chat in real time with classmates (`/messages`).
   * **Realtime Notifications**: Receive instant alerts for likes, comments, follows, and direct messages (`/notifications`).

---

### 🧪 6. Testing & Multi-Computer Verification

Automated test suites are included to verify database integrity, authentication, and multi-client LAN interactions:

```powershell
# 1. Multi-Student LAN Simulation Test (Simulates Student A, B, and C over HTTP)
npm run test:lan

# 2. Test against a specific LAN IP address:
$env:HOST_URL="http://10.71.119.74:3000"; npm run test:lan

# 3. Realtime SSE Connection Test
npx tsx scripts/test-sse.ts

# 4. Auth & Database Multi-User Isolation Test
npx tsx scripts/test-auth.ts
```

---

### 🛑 7. Shutdown and Restart Procedure

* **To Stop the Server**: In the Host PC terminal window, press `Ctrl + C`.
* **To Restart the Server**: Run `npm run start:lan` (or `npm run dev:lan`).
* **Data Persistence**: All users, posts, comments, likes, follows, messages, and uploaded photos remain permanently saved on the Host PC in `data/instagrom.sqlite` and `public/uploads/`.

---

### ❓ 8. Troubleshooting Connection Issues

If a student computer cannot connect, follow these diagnostic steps in order:

1. **Same Network Check**: Confirm both the Host PC and the student computer are connected to the exact same Wi-Fi SSID or LAN switch.
2. **Verify Host IP**: Run `npm run lan:info` (or `ipconfig`) on the Host PC to confirm the current IPv4 address has not changed.
3. **Verify Server Status**: Confirm the Host terminal displays `Ready` and is actively running `next start -H 0.0.0.0 -p 3000`.
4. **Port Check**: Verify the URL includes `:3000` (e.g. `http://10.71.119.74:3000`).
5. **Firewall Rule**: Run the Windows Firewall PowerShell command (from Section 3) with Administrator privileges.
6. **Network Profile**: Ensure Windows network profile is set to **Private** (Settings > Network & Internet > Properties > Network Profile Type = Private).
7. **AP Isolation**: Some campus/enterprise guest Wi-Fi networks block device-to-device communication (Client/AP Isolation). If this occurs, connect both computers to a local Wi-Fi router, mobile hotspot, or Ethernet switch.
8. **Check Host Terminal**: Check the Host PC terminal for any runtime exceptions or errors.

---

## 📂 Project Directory Structure

```text
06.Instagrom/
├── data/
│   └── instagrom.sqlite        # SQLite shared database file
├── prisma/
│   └── schema.prisma           # Prisma schema definition
├── public/
│   └── uploads/
│       ├── posts/              # Local post media uploads
│       ├── profiles/           # Local profile photo uploads
│       └── stories/            # Local story media uploads
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/           # Login, Register, Logout, Me API
│   │   │   ├── conversations/  # Conversation creation & message retrieval
│   │   │   ├── notifications/  # Notification center API
│   │   │   ├── posts/          # Feed posts, likes, comments, bookmark API
│   │   │   ├── presence/       # Real-time online presence heartbeat
│   │   │   ├── realtime/       # Server-Sent Events (SSE) stream endpoint
│   │   │   └── upload/         # Local multipart image upload endpoint
│   │   ├── feed/               # Main social feed view
│   │   ├── login/              # Login interface
│   │   ├── messages/           # Direct messaging client view
│   │   ├── notifications/      # Realtime notification center view
│   │   ├── profile/            # User profile & posts grid view
│   │   └── register/           # Registration interface
│   ├── components/             # Modular React UI components
│   └── lib/                    # Core backend libraries (Auth, DB, Realtime, Uploads)
├── scripts/
│   ├── host-ip.ts              # Host IP detection & LAN instructions
│   ├── test-lan-multiuser.ts   # Multi-client LAN simulation test suite
│   ├── test-sse.ts             # Server-Sent Events stream tester
│   ├── test-auth.ts            # Auth & session isolation tester
│   └── seed-classroom.ts       # Classroom demo accounts seeder
├── package.json
└── README.md
```

---

## 🛡️ Data Safety & Integrity Notes

* **Never delete `data/instagrom.sqlite`** — this contains all classroom posts and accounts.
* **Do not run `npx prisma migrate reset`** — use `npm run db:push` for schema updates.
* **Uploads**: Media files uploaded by students are stored securely in `public/uploads/` on the Host PC and served directly via Next.js.
