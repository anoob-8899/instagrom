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

# Classroom LAN Hosting

Follow these step-by-step instructions to configure and host INSTAGROM for your local classroom network.

### 🐍 Python Server (Zero Node.js Dependency)

You can run INSTAGROM completely in **Python** (FastAPI + SQLite + Tailwind UI):

1. **Install Python Dependencies**:
   ```powershell
   pip install -r requirements.txt
   ```

2. **Start the Python LAN Server**:
   ```powershell
   python run.py
   ```

3. **Open in Browser**:
   * Local: `http://localhost:3000`
   * LAN: `http://<HOST-IP>:3000` (e.g. `http://10.200.69.74:3000`)

4. **Run Multi-Client Automated Tests**:
   ```powershell
   python scripts/test_python_direct.py
   ```

---

### 📋 Node.js / Next.js Setup (Alternative)
* **Operating System**: Windows 10/11
* **Node.js**: v18.17.0 or higher
* **Network**: Host PC and all student devices must connect to the **same Wi-Fi router / LAN switch**.
* **Dependencies & Database**:
  ```powershell
  npm install
  npm run db:push
  ```
  *(Note: `data/instagrom.sqlite` remains the single shared SQLite database. Existing users, posts, and media are safely preserved).*

---

### 🚀 2. Starting the Server
Start the Next.js server so it binds to `0.0.0.0:3000` (listening on all local interfaces):

#### Recommended Production Mode:
```powershell
npm run build
npm run start:lan
```
*(Runs: `next start -H 0.0.0.0 -p 3000`)*

#### Development Mode:
```powershell
npm run dev:lan
```
*(Runs: `next dev -H 0.0.0.0 -p 3000`)*

> [!IMPORTANT]
> **Keep the PowerShell window open** while class is in session. The host PC acts as the local classroom server.

---

### 🔍 3. Finding the Host IP Address
To share the URL with students, find your computer's local Wi-Fi or Ethernet IPv4 address:

#### Option A: Built-in INSTAGROM Detection Tool (Recommended)
```powershell
npm run lan:info
```
This utility inspects all network interfaces, filters out virtual/VPN adapters (e.g. VirtualBox, VMware, Tailscale, APIPA `169.254.x.x`), and displays your active LAN address:
```text
================================================================
   INSTAGROM CLASSROOM SERVER
================================================================

Local:
http://localhost:3000

LAN:
http://10.200.69.74:3000 (Wi-Fi)

Other computers on the same Wi-Fi can connect using the LAN address.
```

#### Option B: Windows `ipconfig` Command
1. Open PowerShell and run:
   ```powershell
   ipconfig
   ```
2. Look under `Wireless LAN adapter Wi-Fi` (or `Ethernet adapter`).
3. Locate the line **IPv4 Address** (e.g., `10.200.69.74` or `192.168.1.25`).
4. *Do not use virtual adapter IPs (like `192.168.56.1` for VirtualBox or `169.254.x.x`).*

---

### 🛡️ 4. Windows Firewall Setup
Allow inbound TCP traffic on port `3000` for the Private network profile. Run **PowerShell as Administrator**:

```powershell
New-NetFirewallRule `
  -DisplayName "INSTAGROM Classroom Server" `
  -Direction Inbound `
  -LocalPort 3000 `
  -Protocol TCP `
  -Action Allow `
  -Profile Private
```

> [!NOTE]
> Ensure your Windows Network Profile is set to **Private** (Settings > Network & internet > Wi-Fi/Ethernet > Properties > Network Profile Type = Private).

---

### 💻 5. Client Connection (Student Devices)
Student computers only need a web browser (Chrome, Edge, Firefox, Safari). They do **NOT** need Node.js, Git, or a copy of the database.

1. Connect the student laptop/tablet/phone to the **same classroom Wi-Fi**.
2. Open any web browser.
3. In the address bar, type:
   ```text
   http://<HOST-IP>:3000
   ```
   *Example: `http://10.200.69.74:3000` or `http://192.168.1.25:3000`*

> [!WARNING]
> Do **NOT** type `http://localhost:3000` on student computers. `localhost` refers to the student computer itself. Students must enter the Host PC's LAN IPv4 address.

---

### 🔌 6. Port Testing & Connectivity Verification

#### On the Host PC:
Check that Next.js is actively listening on all interfaces:
```powershell
netstat -ano | findstr :3000
```
*(Expected output includes `TCP 0.0.0.0:3000 ... LISTENING`)*

#### On a Student / Client PC (or Host):
Test direct TCP connectivity to port 3000:
```powershell
Test-NetConnection 10.200.69.74 -Port 3000
```
Expected output:
```text
TcpTestSucceeded : True
```

#### Automated Multi-Client LAN Test:
Simulate concurrent multi-student browser activity over LAN HTTP:
```powershell
$env:HOST_URL="http://10.200.69.74:3000"; npm run test:lan
```

---

### ❓ 7. Troubleshooting Connection Issues

If a student computer cannot load the page:

1. **Test-NetConnection Result is False**:
   - Verify Windows Firewall rule is active on the Host (`Get-NetFirewallRule -DisplayName "INSTAGROM*"`).
   - Ensure the Host PC network profile is set to **Private**.
   - Check that the Host IP address has not changed (`npm run lan:info`).
2. **Wi-Fi Client Isolation (AP Isolation)**:
   - Some institutional / school guest Wi-Fi networks block device-to-device communication.
   - If `Test-NetConnection` fails despite correct IP and Firewall, AP isolation is active on the router.
   - *Fix*: Connect Host and student computers to a dedicated Wi-Fi router, mobile hotspot, or local network switch.
3. **Different Subnets / Wi-Fi Networks**:
   - Ensure student devices are not on 5GHz Guest while Host is on 2.4GHz Main. Both must be on the same subnet.
4. **Server Not Running**:
   - Check that the Host PowerShell window is running `npm run start:lan` and displaying `Ready`.

---

### 🛑 8. How to Stop the Server
In the Host PC PowerShell window running INSTAGROM, press:
```powershell
Ctrl + C
```
Type `Y` if prompted to terminate batch job.

---

### 🔄 9. How to Restart the Server
To restart the server at any time:
```powershell
cd "d:\Vincnet\10.Websites\06.Instagrom"
npm run start:lan
```
*(All posts, comments, likes, messages, and student accounts in `data/instagrom.sqlite` and images in `public/uploads/` will persist).*

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
