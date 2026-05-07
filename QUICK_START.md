# The Round Table Multiplayer - Quick Start Guide

## Project Structure Explained

Your project has **two separate servers**:

```
TheRoundTableMultiPlayerNEW/    ← Main project folder
├── server/                      ← Backend (Node.js + Express + Socket.io)
│   └── index.js                ← Runs on PORT 3001
├── TheRoundTable/              ← Single-player client files
└── debug-server.js             ← Static file server (PORT 5500)

TheRoundTableMultiPlayer/       ← The actual multiplayer client folder
└── 5Crowns/                    ← Client HTML, CSS, JS files
    ├── multiplayer.html        ← Main page to open
    ├── multiplayerClient.js    ← Client-server communication
    ├── classes.js              ← Game logic (cards, players, etc)
    └── functions.js            ← Helper functions
```

**Important**: You DON'T need the 90+ modules in the root. The multiplayer version only uses:
- `express` - web server framework
- `socket.io` - real-time communication
- `sweetalert2` - UI alerts

---

## How to Start

### Option 1: Using VS Code Tasks (EASIEST)

**Step 1**: Open the integrated terminal in VS Code (Ctrl+`)

**Step 2**: Run the combined task:
```bash
Ctrl+Shift+B  (or: Terminal > Run Task > "Start Multiplayer + Static")
```

This starts BOTH servers:
- Backend: http://localhost:3001
- Static: http://localhost:5500

---

### Option 2: Manual Command Line

**Terminal 1 - Backend (Socket.io server):**
```bash
npm run server:start
```
Expected output:
```
[multiplayer] socket listening on port 3001
```

**Terminal 2 - Static Server (Client files):**
```bash
node debug-server.js
```
Expected output:
```
Server listening on port 5500
```

---

## How to Check if Servers are Running

### Check Backend (Port 3001)
```bash
curl http://localhost:3001/health
```
Expected response:
```json
{"ok":true,"service":"5crowns-multiplayer","ts":1234567890}
```

### Check Static Server (Port 5500)
```bash
curl http://localhost:5500/
```
Expected: Returns the HTML content (or index.html)

---

## How to Access the Game

### On Same Machine (Localhost)
```
http://localhost:5500/TheRoundTable/multiplayer.html
```

### On Another Device (Same Network)
Replace `10.0.0.155` with your machine's IP:

**Find your IP:**
```bash
# Windows PowerShell
ipconfig

# Linux/Mac
hostname -I
```

**Then open:**
```
http://10.0.0.155:5500/TheRoundTable/multiplayer.html
```

**NOTE:** The backend does NOT serve client files. The static server (5500) serves them.

**Path rule:** The URL path must match the folder served from your terminal working directory.
- If your client folder is `TheRoundTable`, use `/TheRoundTable/multiplayer.html`
- If your client folder is `5Crowns`, use `/5Crowns/multiplayer.html`

---

## Game Flow (What Actually Happens)

1. **Player opens** `http://10.0.0.155:5500/TheRoundTable/multiplayer.html`
   - Static server (port 5500) delivers HTML, CSS, JS files

2. **multiplayerClient.js connects** to the backend
   - Opens WebSocket connection to `http://10.0.0.155:3001`
   - Sends: `room:create`, `room:join`, `game:start`, `game:action` events

3. **Backend (port 3001) handles game logic**
   - Manages rooms, players, game state
   - Broadcasts updates back to all connected players via Socket.io

4. **Both players see the same game state** in real-time

---

## Modules Actually Used in Multiplayer

### Backend (`server/index.js`):
- `express` - Web framework
- `socket.io` - Real-time bidirectional communication
- `http` - Node.js built-in for HTTP server
- `path` - Node.js built-in for file paths

### Client (`multiplayerClient.js`):
- `socket.io-client` - Connects to backend (auto-loaded from CDN in HTML)
- `classes.js` - Card and Player classes
- `functions.js` - Game logic validation functions

### UI & Styles:
- `multiplayer.html` - Main page
- `style.css` - Styling
- `sweetalert2` - Popup alerts for errors

**That's it!** The other 90+ modules (AI.js, SaveRestore.js, etc.) are from the single-player version and NOT used.

---

## Common Issues & Fixes

### Issue: "Cannot connect to server"
- **Check**: Is the backend running on port 3001?
  ```bash
  curl http://localhost:3001/health
  ```
- **Fix**: Run `npm run server:start` in terminal

### Issue: "Cannot find multiplayer.html"
- **Check**: Are you using the right URL?
  - ✅ `http://10.0.0.155:5500/TheRoundTable/multiplayer.html`
  - ✅ `http://10.0.0.155:5500/5Crowns/multiplayer.html` (if your project still uses `5Crowns`)
  - ❌ `http://10.0.0.155:3001/multiplayer.html` (backend doesn't serve files)
- **Fix**: Use port 5500 for static files

### Issue: "Other device can't connect"
- **Check**: Firewall blocks port 5500 or 3001
  ```bash
  # Windows: Check firewall rules for TCP 5500 and 3001
  netstat -an | findstr "5500\|3001"
  ```
- **Fix**: Allow ports 5500 & 3001 in Windows Firewall

### Issue: "Only one player sees 'Your Turn'"
- **This is correct!** Only the current player should see this
- The game broadcasts to both but shows different UI per player

---

## Development Tips

### Watch Mode (Auto-reload on changes)
```bash
npm run server:dev
```

### View Server Logs
The backend prints events like:
```
[multiplayer] socket connected: abc123
room:create { playerName: 'Alice', roomCode: 'ABC12' }
room:join { playerName: 'Bob', roomCode: 'ABC12' }
game:action { action: 'drawFromDeck', roomCode: 'ABC12' }
```

### Stop All Servers
```bash
# VS Code Task
Terminal > Run Task > "Stop Multiplayer + Static"

# Or manually: Ctrl+C in each terminal
```

---

## Learning Resources for Backend/Client Development

Since you mentioned tutorials were either trivial or outdated, here's what to focus on:

### Understanding This Project:
1. **Server Entry Point**: `server/index.js` - How Express & Socket.io work together
2. **Client Connection**: `TheRoundTable/multiplayerClient.js` (or `5Crowns/multiplayerClient.js`) - How to connect to backend
3. **Room Management**: `server/rooms/roomManager.js` - How players are managed

### Key Concepts:
- **Socket.io Events**: Client emits events → Server handles → Broadcasts to all players
- **Room System**: Each game is a "room" with multiple players
- **Game State**: Server holds the true game state, clients receive updates

### Files to Study (In Order):
1. `server/index.js` - Understand the structure
2. `server/rooms/roomManager.js` - How rooms work
3. `multiplayer.html` - The HTML structure
4. `multiplayerClient.js` - How the client talks to the server
5. `server/engine/` - Game logic processing

---

## Quick Reference: All Commands

| What | Command |
|------|---------|
| **Start Both Servers** | `Ctrl+Shift+B` (or `npm run server:start` + `node debug-server.js`) |
| **Stop All Servers** | `Ctrl+C` in each terminal (or Task: Stop) |
| **Check Backend** | `curl http://localhost:3001/health` |
| **Access Game (Local)** | `http://localhost:5500/TheRoundTable/multiplayer.html` |
| **Access Game (Network)** | `http://YOUR_IP:5500/TheRoundTable/multiplayer.html` |
| **Watch Mode** | `npm run server:dev` |
| **See Server Logs** | Watch the "Run Script: server:start" terminal |

---

## Next Steps

1. ✅ Open this file and follow "How to Start"
2. ✅ Run `Ctrl+Shift+B` to start both servers
3. ✅ Open `http://localhost:5500/TheRoundTable/multiplayer.html`
4. ✅ Test with another device on your network
5. ✅ Check `MULTIPLAYER_TEST_CHECKLIST.md` for full testing steps

**You've got this! Let me know when you hit any issues.** 🎯


