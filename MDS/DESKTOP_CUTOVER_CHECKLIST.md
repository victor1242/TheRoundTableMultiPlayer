# Desktop Host Cutover Checklist

Last updated: 2026-03-30

## Goal

Move multiplayer hosting from laptop to desktop with minimal risk.

## 1) Sync Code to Desktop

- [ ] Copy the full project folder to desktop host machine
- [ ] Confirm required files exist:
  - [ ] server/index.js
  - [ ] server/rooms/gameRoom.js
  - [ ] server/engine/gameEngine.js
  - [ ] 5Crowns/multiplayer.html
  - [ ] 5Crowns/multiplayerClient.js

## 2) Install Runtime and Dependencies

- [ ] Install Node.js LTS on desktop
- [ ] From project root, run: npm install
- [ ] Verify dependencies installed without errors

## 3) Open Firewall Ports (Private network)

- [ ] Allow inbound TCP 3001 (multiplayer server)
- [ ] If serving static page via debug server, allow inbound TCP 5500
- [ ] Ensure Node.js is allowed on Private networks

## 4) Start Services on Desktop

- [ ] Start multiplayer backend: npm run server:start
- [ ] Optional static page host: Start Local Static Server task (5500)
- [ ] Verify health endpoint from desktop browser:
  - http://localhost:3001/health

## 5) Validate LAN Reachability

- [ ] Find desktop LAN IP (example: 10.0.0.x)
- [ ] From another device, open:
  - Preferred: http://<DESKTOP_IP>:3001/multiplayer.html
  - Alternate: http://<DESKTOP_IP>:5500/5Crowns/multiplayer.html

## 6) Run Quick Multiplayer Smoke Test

- [ ] Device A create room
- [ ] Device B join room
- [ ] Host start game
- [ ] Complete one full turn: draw -> meld attempt -> discard
- [ ] Refresh one device and verify reconnect works (no duplicate player)

## 7) Stability Check (10-15 min)

- [ ] Play several turns across 2 devices
- [ ] Confirm no desyncs or frozen turn state
- [ ] Confirm invalid meld messages are clear and include wild reminder context

## 8) Production-Ready Decision

- [ ] PASS all smoke checks
- [ ] Keep desktop as host
- [ ] Keep this checklist for future updates

If FAIL, capture:

- Step number:
- Desktop IP used:
- Error shown:
- Repro steps:
- Screenshot/log notes:
