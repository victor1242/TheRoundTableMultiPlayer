# Games Directory Function Purpose

This document gives a basic reference for the functions used by the Games Directory design in `main.js`.

## Core Keys

- `GAMES_DIRECTORY_KEY`: localStorage key for the game directory list (`"GamesDirectory"`).
- `CURRENT_GAME_ID_KEY`: localStorage key for the active game id (`"CurrentGameId"`).
- `GAME_STATE_KEY_PREFIX`: prefix for per-game state keys (`"game_state_"`).
- `SCOREBOARD_KEY_PREFIX`: prefix for per-game scoreboard keys (`"scoreboard_data_"`).

## Function Purpose Reference

- `pad2(value)`: Left-pads numeric date parts to 2 characters.
- `formatGameId(date)`: Builds a timestamp-based game id string used as the directory entry id.
- `getGameStorageKey(gameId)`: Returns the localStorage key for one game's state.
- `getScoreboardStorageKey(gameId)`: Returns the localStorage key for one game's scoreboard data.
- `getCurrentGameId()`: Reads the currently selected game id from localStorage.
- `setCurrentGameId(gameId)`: Writes or clears the current game id in localStorage.
- `getCurrentGameStorageKey(createIfMissing)`: Resolves the active game-state key; can create a new game id when missing.
- `getCurrentScoreboardKey()`: Resolves the active scoreboard key from current game id.
- `loadGamesDirectory()`: Loads and parses the directory array from localStorage; returns `[]` on invalid/missing data.
- `saveGamesDirectory(directory)`: Serializes and stores directory entries in localStorage.
- `getDirectoryEntryById(directory, gameId)`: Finds a single directory entry by game id.
- `updateGameDirectoryStatus(gameIdOverride)`: Updates status/info UI fields from the selected directory entry.
- `renderGamesDirectory()`: Rebuilds the game select list UI from directory entries and syncs current selection.
- `upsertGamesDirectoryEntry(infoOverride)`: Inserts or updates the current game's directory entry (id, storage key, info, status, timestamps).
- `ensureCurrentGameIdFromLegacy()`: Migrates legacy `game_state` storage into the newer id-based key format.
- `initGamesDirectory()`: Startup initializer that loads directory, prunes stale entries, syncs current id, and sets fallback state.

## Typical Call Flow

1. `initGamesDirectory()` runs during startup.
2. It loads/prunes/synchronizes directory data, then calls `renderGamesDirectory()`.
3. During saves, `storeGameState(...)` writes game state and then calls `upsertGamesDirectoryEntry()`.
4. `upsertGamesDirectoryEntry()` persists metadata and refreshes the directory UI.

## Notes

- The directory entry object shape is effectively:
  - `id`
  - `storageKey`
  - `info`
  - `status`
  - `createdAt`
  - `updatedAt`
- `status` is currently set to `"completed"` when `game.roundNumber >= game.lastRound`; otherwise `"open"`.
