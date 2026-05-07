# The Round Table Multiplayer - Terminal Commands Reference

## Quick Command Reference

### START EVERYTHING (Recommended)

**In VS Code Terminal:**
```bash
Ctrl+Shift+B
```

This runs the "Start Multiplayer + Static" task, which starts:
- Backend (port 3001)
- Static server (port 5500)

---

### Start Individually

**Backend Server Only (port 3001):**
```bash
npm run server:start
```

**Static Server Only (port 5500):**
```bash
node debug-server.js
```

**Backend in Watch Mode (auto-reload):**
```bash
npm run server:dev
```

---

### Check Server Status

**Is the backend running?**
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{"ok":true,"service":"5crowns-multiplayer","ts":1715000000}
```

**Is the static server running?**
```bash
curl http://localhost:5500/
```

Expected response: HTML content

**What's listening on port 3001? (Linux/Mac)**
```bash
lsof -i :3001
```

**What's listening on port 3001? (Windows PowerShell)**
```powershell
Get-NetTCPConnection -LocalPort 3001 | Select-Object -ExpandProperty OwningProcess
```

---

### Stop All Servers

**Option 1: VS Code Task**
```
Terminal → Run Task → "Stop Multiplayer + Static"
```

**Option 2: Manual (in each terminal where a server is running)**
```bash
Ctrl+C
```

---

### View Server Logs

**Terminal where you ran `npm run server:start`**

Look for output like:
```
[multiplayer] socket listening on port 3001
room:create { playerName: 'Alice', roomCode: 'ABC12' }
room:join { playerName: 'Bob', roomCode: 'ABC12' }
game:start { roomCode: 'ABC12' }
game:action { action: 'drawDeck', ... }
```

Each log line tells you what's happening on the server.

---

## Network Access

### Find Your Machine's IP Address

**Windows (PowerShell):**
```powershell
ipconfig
```
Look for "IPv4 Address" under your network interface (usually `192.168.x.x` or `10.0.x.x`)

**Linux/Mac (Terminal):**
```bash
hostname -I
```

**Common IPs:**
- Local: `127.0.0.1` or `localhost`
- Network: `192.168.1.100`, `10.0.0.155`, etc.

### Test Network Connection

**From another device on same network:**

Can reach static server?
```bash
curl http://10.0.0.155:5500/
```

Can reach backend?
```bash
curl http://10.0.0.155:3001/health
```

**If both return data, your network is ready!**

---

## Troubleshooting Commands

### "Connection refused" on port 3001

**Check if backend is running:**
```bash
curl http://localhost:3001/health
```

**If fails:**
1. Is another process using port 3001?
   ```bash
   # Windows PowerShell
   Get-NetTCPConnection -LocalPort 3001 -State Listen
   
   # Linux/Mac
   lsof -i :3001
   ```

2. If something is using it, kill it:
   ```bash
   # Windows PowerShell
   Get-NetTCPConnection -LocalPort 3001 -State Listen | 
     Select-Object -ExpandProperty OwningProcess | 
     ForEach-Object { Stop-Process -Id $_ -Force }
   ```

3. Then restart the backend:
   ```bash
   npm run server:start
   ```

### "Cannot GET /multiplayer.html" on port 3001

**This is expected!** The backend doesn't serve files.

✅ **Correct URL:**
```
http://10.0.0.155:5500/TheRoundTableMultiPlayer/5Crowns/multiplayer.html
```

❌ **Wrong URL:**
```
http://10.0.0.155:3001/multiplayer.html
```

The backend only provides:
- `/health` endpoint
- WebSocket connections for game data

### "Cannot connect from other device"

**Test 1: Can ping other device?**
```bash
ping 10.0.0.155
```

**Test 2: Can reach static server?**
```bash
curl http://10.0.0.155:5500/
```

**Test 3: Check firewall (Windows)**
```powershell
# Allow port 5500
New-NetFirewallRule -DisplayName "AllowPort5500" `
  -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5500

# Allow port 3001
New-NetFirewallRule -DisplayName "AllowPort3001" `
  -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001
```

**Test 4: Check firewall (Linux)**
```bash
sudo ufw allow 5500/tcp
sudo ufw allow 3001/tcp
sudo ufw enable
```

### "EADDRINUSE: address already in use"

Two programs are trying to use the same port.

**Kill whatever is using it:**
```bash
# Windows PowerShell - kill process using port 3001
Get-NetTCPConnection -LocalPort 3001 -State Listen | 
  Select-Object -ExpandProperty OwningProcess | 
  ForEach-Object { Stop-Process -Id $_ -Force }

# Linux/Mac - kill process using port 5500
lsof -i :5500 | tail -1 | awk '{print $2}' | xargs kill -9
```

Then try again.

---

## NPM Commands

### View available scripts
```bash
npm run
```

Output shows all available commands in `package.json`.

### Install dependencies (if needed)
```bash
npm install
```

### Run linter (check code style)
```bash
npm run lint
```

### Fix linter issues automatically
```bash
npm run lint:fix
```

---

## File System Commands

### Navigate to project folder
```bash
cd /run/media/victor9210/New\ Volume/TheRoundTableMultiPlayerNEW
```

### List contents
```bash
ls -la
```

### View a file
```bash
cat multiplayer.html | head -20
```

### Check file size
```bash
du -sh server/
du -sh TheRoundTableMultiPlayer/
```

### Find files by name
```bash
find . -name "*.html" -type f
find . -name "multiplayerClient.js"
```

---

## Working with Terminals

### Create a new terminal in VS Code
```
Ctrl+Shift+` (backtick)
```

### Split terminal
```
Ctrl+Shift+5
```

### Kill all terminals
```
Ctrl+K (then Ctrl+C)
```

### Run command in background (Linux/Mac)
```bash
npm run server:start &
node debug-server.js &
```

To stop background processes:
```bash
jobs
kill %1  # Kill first job
kill %2  # Kill second job
```

---

## Advanced: Custom Environment Variables

### Set port for backend (custom)
```bash
# Linux/Mac
export PORT=3002
npm run server:start

# Windows PowerShell
$env:PORT = "3002"
npm run server:start

# Then access at: http://localhost:3002
```

### Set port for static server (custom)
```bash
# Linux/Mac
export DEBUG_PORT=6000
node debug-server.js

# Windows PowerShell
$env:DEBUG_PORT = "6000"
node debug-server.js

# Then access at: http://localhost:6000
```

---

## Real-Time Monitoring

### Watch network connections
```bash
# Linux/Mac
watch -n 1 'netstat -an | grep -E "3001|5500"'

# Windows PowerShell (every 2 seconds)
while(1){ Get-NetTCPConnection -LocalPort 3001,5500 -ErrorAction SilentlyContinue; Start-Sleep 2; Clear-Host }
```

### Watch file changes (if using watch mode)
```bash
# Server should show:
# [watch] restarted due to changes in:
#   - server/index.js
```

### Monitor server logs in real-time
```bash
# Keep terminal open while running npm run server:start
# Just watch the output - new logs appear as events happen
```

---

## Copy/Paste Ready Commands

### Everything at once

**Setup (run once):**
```bash
cd /run/media/victor9210/New\ Volume/TheRoundTableMultiPlayerNEW
npm install
```

**Terminal 1 - Backend:**
```bash
npm run server:start
```

**Terminal 2 - Static:**
```bash
node debug-server.js
```

**Then open browser:**
```
http://localhost:5500/TheRoundTableMultiPlayer/5Crowns/multiplayer.html
```

---

## Quick Diagnosis Checklist

Run these commands in order if something isn't working:

```bash
# 1. Are we in the right folder?
pwd
# Should show: /run/media/victor9210/New Volume/TheRoundTableMultiPlayerNEW

# 2. Are npm modules installed?
ls node_modules | head -5
# Should show folders like: express, socket.io, etc.

# 3. Is backend accessible?
curl http://localhost:3001/health
# Should return JSON with "ok": true

# 4. Is static server accessible?
curl http://localhost:5500/
# Should return HTML

# 5. Does the multiplayer file exist?
ls -la TheRoundTableMultiPlayer/5Crowns/multiplayer.html
# Should exist and show file size

# 6. Can client reach both servers from this machine?
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:5500/

# If all 6 pass, try another device:
# Replace 127.0.0.1 with your machine IP (e.g., 10.0.0.155)
```

---

## Reference Table: Port Usage

| Port | Service | URL | Purpose |
|------|---------|-----|---------|
| 3001 | Backend (Socket.io) | http://localhost:3001 | Game logic, real-time events |
| 5500 | Static Server | http://localhost:5500 | HTML, CSS, JS files |
| N/A | Client (Browser) | http://localhost:5500/...multiplayer.html | Connects to both 3001 & 5500 |

---

## Emergency: Reset Everything

If things are really broken:

```bash
# Kill all Node processes
# Windows PowerShell
Get-Process node | Stop-Process -Force

# Linux/Mac
killall node

# Remove and reinstall dependencies
rm -rf node_modules
npm install

# Start fresh
npm run server:start
# (in another terminal)
node debug-server.js
```

---

## When to Use Each Command

| Situation | Command |
|-----------|---------|
| "How do I start?" | `Ctrl+Shift+B` |
| "Is it running?" | `curl http://localhost:3001/health` |
| "It's broken, restart!" | `Ctrl+C` then `Ctrl+Shift+B` |
| "Show me the logs" | Look at the terminal output (already running) |
| "Other device can't connect" | Check IP with `ipconfig`, then test with `curl http://YOUR_IP:5500/` |
| "Port is already in use" | Find with `lsof -i :3001` (Mac/Linux) or `Get-NetTCPConnection -LocalPort 3001` (Windows), then kill with `kill` or `Stop-Process` |
| "I want to code and have it auto-reload" | `npm run server:dev` |
| "Clean restart" | `rm -rf node_modules && npm install && Ctrl+Shift+B` |

That's it! Bookmark this page for quick reference. 🚀
