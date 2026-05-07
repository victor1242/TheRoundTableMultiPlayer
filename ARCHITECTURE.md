# The Round Table Multiplayer - Backend/Client Architecture

## What Actually Happens When You Play

```
You open multiplayer.html in browser
    ↓
[CLIENT] multiplayer.html loaded (HTML + CSS)
    ↓
[CLIENT] multiplayerClient.js loaded (connects to server)
    ↓
[CLIENT] Connects to WebSocket: ws://10.0.0.155:3001
    ↓
[SERVER] backend/index.js receives connection
    ↓
[SERVER] io.on('connection', ...) fires
    ↓
You enter name and click "Create Room"
    ↓
[CLIENT] Emits event: socket.emit('room:create', { playerName: 'Alice' })
    ↓
[SERVER] socket.on('room:create', ...) handler runs
    ↓
[SERVER] roomManager.createRoom() called
    ↓
[SERVER] New game instance created, room code generated
    ↓
[SERVER] Sends back room code to client
    ↓
[CLIENT] Displays room code: "ABC12"
    ↓
Another player joins with that code
    ↓
[CLIENT] Emits: socket.emit('room:join', { roomCode: 'ABC12', playerName: 'Bob' })
    ↓
[SERVER] roomManager.joinRoom() called
    ↓
[SERVER] Adds player to room, broadcasts updated player list
    ↓
[CLIENT] Receives broadcast, both clients show 2 players
    ↓
Host clicks "Start Game"
    ↓
[CLIENT] Emits: socket.emit('game:start', { roomCode: 'ABC12' })
    ↓
[SERVER] Game logic starts, first turn assigned, state created
    ↓
[SERVER] io.to(roomCode).emit('game:state', { ...gameState })
    ↓
[CLIENT] Both clients receive and display same game state
    ↓
Current player clicks "Draw"
    ↓
[CLIENT] Emits: socket.emit('game:action', { action: 'draw' })
    ↓
[SERVER] engine/gameEngine.js processes the action
    ↓
[SERVER] Updates game state, broadcasts new state to both players
    ↓
[CLIENT] UI updates for both players
    ↓
OTHER player sees "It's your turn" appear
```

---

## File Reference: What Each File Does

### Backend Files (What the Server Runs)

| File | Purpose | Key Code |
|------|---------|----------|
| `server/index.js` | **Entry point** - Sets up Express, Socket.io, creates room manager | Listens on port 3001, handles WebSocket connections |
| `server/rooms/roomManager.js` | **Manages all active games** - Creates rooms, adds players, tracks state | `createRoom()`, `joinRoom()`, `getRoom()`, `startGame()` |
| `server/engine/gameEngine.js` | **Game logic processing** - Validates melds, handles draws, manages turns | `processAction()`, `validateMeld()`, `advanceTurn()` |
| `server/engine/deck.js` | **Card deck management** - Shuffles, deals, tracks discard pile | `createDeck()`, `drawCard()`, `addToDiscard()` |
| `server/ai/` | **AI opponent logic** (if enabled) | Not used in multiplayer, only single-player |

### Client Files (What the Browser Runs)

| File | Purpose | Key Code |
|------|---------|----------|
| `multiplayer.html` | **Main page structure** - HTML form for room creation/joining | Contains UI divs for lobby and game board |
| `multiplayerClient.js` | **Client-server communication** - Connects to server, emits/listens to events | `socket.on()`, `socket.emit()` for all game actions |
| `classes.js` | **Data structures** - Card, Player, Hand, Meld classes | `new Card()`, `new Hand()`, `new Meld()` |
| `functions.js` | **Game logic (client-side)** - Validates melds before sending to server | `isValidMeld()`, `isValidRun()`, `checkIfGoingOut()` |
| `style.css` | **Visual styling** - Layout, colors, responsive design | Grid layout for cards, player areas |
| `cards/` | **Card images** - PNG files for each card | Displays visual representation of cards |

### Static Server Files (Port 5500)

| File | Purpose |
|------|---------|
| `debug-server.js` | Simple HTTP server that serves static files from current directory |

---

## The Communication Flow: Events

### Client → Server Events

These are sent BY the client, HANDLED by the server.

```javascript
// In multiplayerClient.js
socket.emit('room:create', {
  playerName: 'Alice'
});

socket.emit('room:join', {
  roomCode: 'ABC12',
  playerName: 'Bob',
  playerId: 'player_123'
});

socket.emit('game:start', {
  roomCode: 'ABC12',
  playerId: 'player_123'
});

socket.emit('game:action', {
  roomCode: 'ABC12',
  playerId: 'player_123',
  action: 'drawDeck',
  // or: action: 'drawDiscard'
  // or: action: 'meld', meldData: [...]
  // or: action: 'discard', card: {...}
});

socket.emit('reconnect:request', {
  roomCode: 'ABC12',
  playerName: 'Alice'
});
```

### Server → Client Events (Broadcasts)

These are sent BY the server, RECEIVED by the client.

```javascript
// In server/index.js or server/rooms/roomManager.js

// New player joined
io.to(roomCode).emit('game:playerJoined', {
  players: [ {name: 'Alice', ...}, {name: 'Bob', ...} ]
});

// Game state updated
io.to(roomCode).emit('game:state', {
  round: 1,
  wild: 3,
  currentPlayer: 'Alice',
  players: [
    { name: 'Alice', handCount: 7, melds: [...], ... },
    { name: 'Bob', handCount: 7, melds: [...], ... }
  ],
  deck: { count: 20 },
  discard: { top: {...}, count: 5 },
  gamePhase: 'draw' // or 'meld', 'discard'
});

// Error occurred
socket.emit('error', {
  message: 'Invalid meld - not all same suit',
  code: 'INVALID_MELD'
});

// Game over
io.to(roomCode).emit('game:over', {
  winner: 'Alice',
  scores: { Alice: 45, Bob: 32 },
  nextRound: true
});
```

---

## Key Concepts

### What is Socket.io?

```javascript
// Traditional HTTP: Client sends request → Server responds → Connection closes

// Socket.io: Client connects once → Both can send messages anytime

socket.emit('event_name', data)      // Client sends to server
socket.on('event_name', (data) => {}) // Client receives from server

io.emit('event_name', data)           // Server sends to ALL connected clients
io.to(roomCode).emit(...)             // Server sends to specific room
socket.emit('event_name', data)       // Server sends to ONE client
```

### What is a "Room"?

```javascript
// Room = a game instance with 2 or more players
// Players join the same room to play together

// Server maintains:
{
  'ABC12': {           // roomCode
    players: [
      { name: 'Alice', socket: socket_1, hand: [...], ... },
      { name: 'Bob', socket: socket_2, hand: [...], ... }
    ],
    gameState: {
      round: 1,
      wild: 3,
      deck: [...],
      discard: [...],
      currentPlayer: 0,
      ...
    }
  }
}

// When Alice sends a message, server puts her in her room and broadcasts to Bob
```

### What is a WebSocket?

```
Traditional HTTP:
Client: GET /api/gamestate
Server: 200 OK [gamestate]
(Connection closes)

WebSocket:
Client connects: ws://server:3001
Server accepts: Connection established
Client: { "action": "draw" }
Server: { "newState": {...} }
Client: { "meld": [...] }
Server: { "error": "..." }
(Connection stays open)
```

---

## Finding Code That Matters

### If you want to change the game rules:

1. Server-side validation: `server/engine/gameEngine.js`
   - Look for `processAction()`, `validateMeld()`
   
2. Client-side preview: `functions.js`
   - Look for `isValidMeld()`, `isValidRun()`

### If you want to fix turn sequence bugs:

1. Where turns advance: `server/rooms/roomManager.js`
   - Look for `advanceTurn()`, `endTurn()`

2. Where UI updates: `multiplayerClient.js`
   - Look for `socket.on('game:state', ...)` handlers

### If you want to add a new game action (e.g., "Buy" action):

1. Client sends event: `multiplayerClient.js`
   - Add: `socket.emit('game:action', { action: 'buy', ... })`

2. Server receives event: `server/index.js`
   - Add handler: `socket.on('game:action', ...)`

3. Server processes: `server/engine/gameEngine.js`
   - Add logic: `case 'buy': ...`

4. Server broadcasts: `io.to(roomCode).emit('game:state', newState)`

5. Client updates UI: `multiplayerClient.js`
   - `socket.on('game:state', ...)` already handles this

---

## Files You Can IGNORE (Not Used in Multiplayer)

```
❌ AI.js                    - Single-player AI opponent
❌ aiMeldPlanner.js         - Single-player AI logic
❌ aiLogicTest.html         - Testing single-player AI
❌ SaveRestore.js           - Local storage (not in multiplayer)
❌ animation..js            - Probably unused
❌ animationSpeedExample.html - Example file
❌ checkBrackets.js         - Validation utility (unused)
❌ TestTheRoundTable.js     - Test file
❌ TheRoundTable/...        - Single-player files
❌ ScoreBoard.html          - Single-player score display
```

These exist because this project evolved from a single-player version. The multiplayer version is clean in the `server/` and `TheRoundTableMultiPlayer/5Crowns/` directories.

---

## Server Folder Deep Dive

```
server/
├── index.js                  ← Main entry point
├── rooms/
│   ├── roomManager.js        ← Creates/manages rooms
│   ├── room.js               ← Single room instance
│   └── player.js             ← Player instance
├── engine/
│   ├── gameEngine.js         ← Game logic processing
│   ├── deck.js               ← Deck management
│   ├── hand.js               ← Player hand
│   └── meld.js               ← Meld validation
├── ai/
│   ├── index.js              ← AI initialization (not used)
│   └── ...
└── indexbu.js                ← Backup (ignore)
```

### What Runs on Startup?

```javascript
// 1. server/index.js loads
const { createRoomManager } = require("./rooms/roomManager");

// 2. Creates a room manager (handles all games)
const roomManager = createRoomManager(io);

// 3. Waits for client connections
io.on('connection', (socket) => {
  // When a client connects, handlers are ready
});

// 4. Listens on port 3001
server.listen(PORT, () => {
  console.log('Listening on port:', PORT);
});
```

---

## How to Debug

### Backend Debug Output

The server logs important events to the terminal:

```bash
# When a client connects:
[multiplayer] socket connected: abc123xyz

# When events are received:
room:create { playerName: 'Alice', roomCode: 'ABC12' }

# When errors occur:
Error processing action: Invalid meld - suit mismatch
```

### View the logs:

1. Terminal running `npm run server:start`
2. Look for these prefixes: `[multiplayer]`, `room:`, `game:`

### Browser Debug (Client-side)

Open browser DevTools (F12):
1. Console tab - see client errors
2. Network tab → WS filter - see WebSocket messages in real-time
3. Storage tab → LocalStorage - see if any data is cached

### Example Debug Flow

```
1. Open http://localhost:5500/.../multiplayer.html
   → Check browser console for errors

2. Enter name, click "Create Room"
   → Check Network tab (WS tab) - should see message sent
   → Check server terminal - should see "room:create" log

3. Check the received room code on screen
   → Should match what server logged

4. Open second browser window, enter other player name + room code
   → Check server terminal - should see "room:join" log
   → Check first browser - both should show 2 players
```

---

## Summary: The Minimal Understanding You Need

**Backend (Server):**
- Listens for WebSocket connections on port 3001
- Receives events from clients (room:create, game:action, etc.)
- Processes game logic
- Broadcasts updated state back to all players in a room

**Client (Browser):**
- Connects to server via WebSocket
- Sends user actions as events
- Receives game state updates
- Displays UI based on received state

**Communication:**
- Client → Server: `socket.emit('event', data)`
- Server → Client: `io.to(room).emit('event', data)`

That's it! Everything else is plumbing around this core concept.
