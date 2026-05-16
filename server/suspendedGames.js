const fs = require('fs');
const path = require('path');

const SUSPENDED_DIR = path.join(__dirname, '../suspendedGames');

// Ensure directory exists
if (!fs.existsSync(SUSPENDED_DIR)) {
  fs.mkdirSync(SUSPENDED_DIR, { recursive: true });
}

/**
 * Save a paused game to persistent storage
 * @param {string} roomCode - Room code as unique identifier
 * @param {object} gameState - Full game state from GameRoom
 * @param {string} pausedBy - Player name who paused the game
 * @param {array} players - Array of player objects with full data (id, name, hand, melds, etc.)
 * @param {string|null} description - Optional description from the host
 * @returns {boolean} - True if saved successfully
 */
function savePausedGame(roomCode, gameState, pausedBy, players, description) {
  try {
    const suspendedGame = {
      roomCode,
      pausedAt: Date.now(),
      pausedBy,
      description: description || null,
      round: gameState.round,
      // Store full player data including hands and melds
      players: players.map(p => ({
        id: p.id,
        name: p.name,
        hand: p.hand ? [...p.hand] : [],
        melds: p.meldSets ? p.meldSets.map(set => [...set]) : [],
        gameScore: p.gameScore || 0,
        roundScore: p.roundScore || 0,
        IsOut: p.IsOut || false,
      })),
      gameState
    };

    const filePath = path.join(SUSPENDED_DIR, `${roomCode}.json`);
    fs.writeFileSync(filePath, JSON.stringify(suspendedGame, null, 2));
    console.log(`[SuspendedGames] Saved paused game: ${roomCode}`);
    return true;
  } catch (err) {
    console.error(`[SuspendedGames] Error saving paused game ${roomCode}:`, err.message);
    return false;
  }
}

/**
 * Load a paused game from persistent storage
 * @param {string} roomCode - Room code to retrieve
 * @returns {object|null} - Suspended game object or null if not found
 */
function loadPausedGame(roomCode) {
  try {
    const filePath = path.join(SUSPENDED_DIR, `${roomCode}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const data = fs.readFileSync(filePath, 'utf-8');
    const suspendedGame = JSON.parse(data);
    console.log(`[SuspendedGames] Loaded paused game: ${roomCode}`);
    return suspendedGame;
  } catch (err) {
    console.error(`[SuspendedGames] Error loading paused game ${roomCode}:`, err.message);
    return null;
  }
}

/**
 * Delete a paused game from persistent storage
 * @param {string} roomCode - Room code to delete
 * @returns {boolean} - True if deleted successfully
 */
function deletePausedGame(roomCode) {
  try {
    const filePath = path.join(SUSPENDED_DIR, `${roomCode}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[SuspendedGames] Deleted paused game: ${roomCode}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`[SuspendedGames] Error deleting paused game ${roomCode}:`, err.message);
    return false;
  }
}

/**
 * Get list of all paused games
 * @returns {array} - Array of suspended game objects with metadata
 */
function listPausedGames() {
  try {
    const files = fs.readdirSync(SUSPENDED_DIR);
    const games = [];

    files.forEach((file) => {
      if (file.endsWith('.json')) {
        try {
          const data = fs.readFileSync(path.join(SUSPENDED_DIR, file), 'utf-8');
          const game = JSON.parse(data);
          games.push({
            roomCode: game.roomCode,
            pausedAt: game.pausedAt,
            pausedBy: game.pausedBy,
            description: game.description || null,
            round: game.round,
            playerNames: game.players.map(p => p.name)
          });
        } catch (err) {
          console.error(`[SuspendedGames] Error parsing ${file}:`, err.message);
        }
      }
    });

    return games;
  } catch (err) {
    console.error(`[SuspendedGames] Error listing paused games:`, err.message);
    return [];
  }
}

/**
 * Check if a paused game exists
 * @param {string} roomCode - Room code to check
 * @returns {boolean} - True if paused game exists
 */
function hasPausedGame(roomCode) {
  const filePath = path.join(SUSPENDED_DIR, `${roomCode}.json`);
  return fs.existsSync(filePath);
}

module.exports = {
  savePausedGame,
  loadPausedGame,
  deletePausedGame,
  listPausedGames,
  hasPausedGame
};
