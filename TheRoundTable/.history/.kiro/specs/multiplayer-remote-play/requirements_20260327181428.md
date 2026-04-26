# Requirements: Multiplayer Remote Play

## Functional Requirements

### Room Management
- Players can create a room and receive a 6-character room code
- Players can join a room using a room code
- A room supports 2 to 6 players
- The first player to create a room is the host
- Only the host can start the game
- A player can reconnect to their seat within a grace window using a reconnect token

### Game Rules (Server-Authoritative)
- All game rules are enforced on the server; client actions are intents only
- The server rejects invalid moves (out-of-turn, illegal melds, illegal discards)
- Server validates turn order, legal melds, discard rules, and scoring
- Wild card discard rules are enforced server-side
- Going out (no cards left) is detected and finalTurn flag is set server-side

### Turn Sync
- Each client receives minimal event payload + canonical game state version after every valid action
- Only the current player can submit draw, meld, discard, and endTurn actions
- Other players receive public game state updates (opponent hand counts, discard pile, etc.)
- Each player's private hand is sent only to that player

### Persistence and Recovery
- Game state is persisted at key points: round start, each action commit, round end
- Server restart must be able to restore all active games from storage
- Room and player metadata is stored with each game snapshot

### Reconnect
- A player who disconnects retains their seat for a configurable grace window
- On reconnect, client receives latest game state snapshot and private hand
- Reconnect token is issued at join time and used to reclaim seat

### AI Players
- AI players can fill unseated positions
- AI turn logic runs headlessly on the server (no DOM)
- AI difficulty settings are preserved from existing AI engine

## Non-Functional Requirements

### Hosting
- Server runs on Node.js LTS on a Windows 10 desktop
- PM2 manages the process: auto-restart on crash, auto-start on reboot
- HTTPS is terminated at a reverse proxy (Caddy or Nginx)
- A dynamic DNS service keeps the home IP reachable for remote players
- Static LAN IP is assigned to the desktop in the router
- Windows Firewall allows only required inbound ports

### Security
- Server never trusts client game state
- Every player action is validated before application
- Input throttling and basic abuse protection are in place
- HTTPS only; no plain HTTP in production
- Server process runs under a dedicated non-admin Windows user account

### Reliability
- Server exposes a /health endpoint
- Structured logs capture game events and errors
- PM2 log rotation is enabled
- Nightly database backup to a secondary disk or cloud target

### Compatibility
- Existing local single-player game continues to work unchanged
- Game engine is extracted as a shared pure-JS module (no DOM) usable by both client and server

## Out of Scope (for MVP)
- Matchmaking and ranked play
- Spectator mode
- Chat (nice to have; added after core game sync)
- Mobile-specific UI
- Multi-server scaling (single server is sufficient for private groups)
