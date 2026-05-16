# Suspended Games Feature - Implementation Complete

## Overview
Implemented persistent multi-day game recovery system for The Round Table multiplayer. Players can pause games, leave, and resume the exact same game the following day with all original players.

## Architecture

### Storage Layer (`server/suspendedGames.js`)
- **Location**: `server/suspendedGames/` directory (auto-created)
- **File format**: `{roomCode}.json` 
- **Contents**: Full game state, players, round number, pause timestamp
- **Functions**:
  - `savePausedGame()` - Save game to storage when paused
  - `loadPausedGame()` - Load game from storage for recovery
  - `deletePausedGame()` - Remove game from storage (on completion/abandon)
  - `listPausedGames()` - Get list of all paused games
  - `hasPausedGame()` - Check if game exists

### Backend Integration

#### GameRoom (`server/rooms/gameRoom.js`)
- `pauseGame()` - Now persists game state to storage
- `resumeGame()` - Cleans up storage on resume  
- `restartGame()` - Cleans up storage when starting new game
- `_endRound()` - Auto-cleans up when game reaches gameOver phase

#### Room Manager (`server/rooms/roomManager.js`)
- `getOrRestoreRoom()` - New function that:
  1. Checks if room exists in memory
  2. If not, loads from suspended games storage
  3. Recreates room with full game state
- `joinRoom()` - Uses getOrRestoreRoom() to enable session recovery
- Room destruction - Cleans up suspended games when room times out

#### Server API (`server/index.js`)
- `GET /api/suspended-games` - Returns list of paused games
  - Response: `{ ok: true, games: [ {roomCode, round, playerNames, pausedAt, pausedBy}, ... ] }`
- `DELETE /api/suspended-games/{roomCode}` - Delete abandoned game
  - Requires user confirmation in UI

### Client UI (`TheRoundTable/multiplayer.html`)

#### Lobby UI
- New button: "📋 Paused Games" in the button row
- Displays modal showing:
  - **Room Code** - Unique room identifier
  - **Round** - Current round (e.g., 3/11)
  - **Players** - Original player names (allows verification before resuming)
  - **Paused At** - Date/time game was paused
  - **Actions**: Resume button (rejoin game) or Delete button (abandon)

#### Modal Styling
- Overlay modal (fixed positioning, semi-transparent background)
- Game list items show all relevant info
- Empty state message if no paused games
- Close button and click-outside-to-close functionality

### Client Logic (`TheRoundTable/multiplayerClient.js`)

#### New Functions
- `fetchSuspendedGames()` - Fetch list from server API
- `showSuspendedGamesModal()` - Display modal with game list
- `hideSuspendedGamesModal()` - Close modal
- `resumeSuspendedGame(roomCode)` - Join paused room (triggers state restoration)
- `deleteSuspendedGame(roomCode)` - Delete game with confirmation dialog

#### Integration
- Browse button triggers `showSuspendedGamesModal()`
- Resume button calls `resumeSuspendedGame()` which joins the room
- Delete button calls `deleteSuspendedGame()` with confirmation
- Modal closes automatically after action or via close button

## Workflow

### Pause & Leave Game
1. Host clicks "Pause Game" button
2. Game state saved to `server/suspendedGames/{roomCode}.json`
3. Players can close browser/app
4. Server keeps room in memory for ~2 minutes before cleanup

### Resume Suspended Game (Next Day)
1. Player launches app, joins multiplayer
2. Clicks "📋 Paused Games" button
3. Sees list showing: "Room ABC123 - Round 3/11 - Players: Alice, Bob, Charlie"
4. Clicks "Resume" 
5. Client joins room code from list
6. Server detects room doesn't exist but suspended game does
7. Room is recreated with full game state from storage
8. Game continues from exact point it was paused
9. All players can rejoin (verifies player roster before allowing play)

### Delete Abandoned Game
1. Player clicks "📋 Paused Games" 
2. Clicks "Delete" on unwanted game
3. Confirms: "Delete suspended game in room ABC123? Cannot be undone."
4. Game removed from storage
5. List refreshes

## Cleanup Scenarios

Games are **automatically removed** from storage when:
1. **Game completes** - When final round ends (gameOver phase)
2. **Game resumed** - When players rejoin and continue play
3. **New game started** - When host restarts with same players
4. **Room timeout** - If no players connected for ~2 minutes
5. **Manual deletion** - Player clicks Delete button

## Data Persistence

- **Server restart**: Paused games persist (stored in files)
- **Browser reload**: Client can rejoin by selecting from list
- **Player disconnect**: Game remains paused, available for recovery
- **Multiple players**: Any original player can resume; all see same list

## Validation & Error Handling

- `fetchSuspendedGames()` handles network errors gracefully
- `deleteSuspendedGame()` requires confirmation before deletion
- `resumeSuspendedGame()` validates room code before joining
- Server validates room exists before allowing game actions
- Empty state message if no paused games in storage

## Testing Checklist

- [ ] Create game with 2-3 players, play a few rounds
- [ ] Click "Pause Game" - verify pause message appears
- [ ] Close browser/tab completely
- [ ] Reopen multiplayer, click "📋 Paused Games"
- [ ] Verify paused game appears in list with correct round and players
- [ ] Click "Resume" - verify game state restored exactly
- [ ] Continue playing - verify game logic continues correctly
- [ ] Play to completion - verify game removed from suspended list
- [ ] Test "Delete" button on suspended game
- [ ] Verify deleted game doesn't reappear in list
- [ ] Test server restart - verify suspended games persist
- [ ] Verify browser reload shows list of available games

## Files Modified

1. **server/suspendedGames.js** (NEW) - Storage module
2. **server/rooms/gameRoom.js** - Pause/resume integration + cleanup
3. **server/rooms/roomManager.js** - Session recovery + getOrRestoreRoom()
4. **server/index.js** - REST API endpoints
5. **TheRoundTable/multiplayer.html** - UI modal + styling  
6. **TheRoundTable/multiplayerClient.js** - Client handlers + API calls

## Future Enhancements

- [ ] Add expiration date for abandoned games (e.g., 7 days)
- [ ] Show who paused the game and when
- [ ] Add password protection for sensitive game resumption
- [ ] Include scoreboard snapshot in paused games list
- [ ] Auto-resume if only one paused game available
- [ ] Batch cleanup task for expired games
- [ ] Database storage (vs. file-based) for scale
