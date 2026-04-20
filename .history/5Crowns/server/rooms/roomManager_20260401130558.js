const { GameRoom } = require("./gameRoom");
const { playOfflineTurn } = require("../ai/offlineAI");

const AUTO_PLAY_DELAY_MS = 1500; // ms before AI takes over an offline player's turn

function generateRoomCode(existingRooms) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 50; i += 1) {
    let code = "";
    for (let j = 0; j < 6; j += 1) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!existingRooms.has(code)) return code;
  }
  throw new Error("Failed to generate unique room code");
}

function createRoomManager(io) {
  const rooms = new Map();
  const pendingAutoPlay = new Map(); // roomCode → timeoutId

  /**
   * Emit the personalised game state to every socket in the room.
   * Each player receives only their own hand.
   */
  function emitRoomState(room) {
    room.players.forEach((p) => {
      if (!p.connected || !p.socketId) return;
      const state = room.toClientState(p.id);
      io.to(p.socketId).emit('room:state', state);
    });
  }

  /**
   * If the current player in `room` is offline, schedule the AI to play
   * their turn after AUTO_PLAY_DELAY_MS.  Cancels any already-pending timer.
   */
  function scheduleAutoPlayIfNeeded(room) {
    // Cancel any existing timer for this room
    if (pendingAutoPlay.has(room.code)) {
      clearTimeout(pendingAutoPlay.get(room.code));
      pendingAutoPlay.delete(room.code);
    }

    if (!room.game || room.game.phase !== 'playing') return;

    const currentId = room.game.currentPlayerId;
    const currentPlayer = room.players.find((p) => p.id === currentId);
    if (!currentPlayer || currentPlayer.connected) return;

    console.log(`[AutoAI] scheduling turn for offline player "${currentPlayer.name}" in room ${room.code}`);

    const timeoutId = setTimeout(() => {
      pendingAutoPlay.delete(room.code);

      // Re-check: player may have reconnected before the timer fired
      if (!room.game || room.game.phase !== 'playing') return;
      const stillOffline = room.players.find(
        (p) => p.id === room.game.currentPlayerId && !p.connected
      );
      if (!stillOffline) return;

      try {
        const log = playOfflineTurn(room.game);
        log.forEach((line) => console.log(line));
        emitRoomState(room);
        // Chain: if next player is also offline, schedule again
        scheduleAutoPlayIfNeeded(room);
      } catch (err) {
        console.error(`[AutoAI] Error in room ${room.code}: ${err.message}`);
        // Leave skip button as manual fallback — do not crash server
      }
    }, AUTO_PLAY_DELAY_MS);

    pendingAutoPlay.set(room.code, timeoutId);
  }

  function getRoomOrThrow(roomCode) {
    const room = rooms.get(String(roomCode || '').toUpperCase());
    if (!room) throw new Error('Room not found');
    return room;
  }

  return {
    createRoom({ socket, playerName }) {
      const code = generateRoomCode(rooms);
      const room = new GameRoom(code);
      rooms.set(code, room);
      const player = room.addOrReconnectPlayer({ socketId: socket.id, playerName });
      socket.join(code);
      emitRoomState(room);
      return { roomCode: code, playerId: player.id, state: room.toClientState(player.id) };
    },

    joinRoom({ socket, roomCode, playerName, playerId }) {
      const room = getRoomOrThrow(roomCode);
      const player = room.addOrReconnectPlayer({ socketId: socket.id, playerName, playerId });
      socket.join(room.code);
      
      // Debug logging for reconnections
      if (room.game && player) {
        const reconnecting = playerId !== undefined || !playerId;
        const handSize = room.game.hands[player.id] ? room.game.hands[player.id].length : 0;
        console.log(`[joinRoom] Player "${player.name}" (${player.id}) ${playerId ? 'explicit' : 'name-matched'} reconnect, hand size: ${handSize}`);
      }
      
      emitRoomState(room);
      return { roomCode: room.code, playerId: player.id, state: room.toClientState(player.id) };
    },

    startGame({ roomCode, playerId }) {
      const room = getRoomOrThrow(roomCode);
      room.startGame(playerId);
      emitRoomState(room);
      return { state: room.toClientState(playerId) };
    },

    applyAction({ roomCode, playerId, action }) {
      const room = getRoomOrThrow(roomCode);
      room.applyAction(playerId, action);
      emitRoomState(room);
      return { state: room.toClientState(playerId) };
    },

    startNextRound({ roomCode, playerId }) {
      const room = getRoomOrThrow(roomCode);
      room.applyAction(playerId, { type: 'nextRound' });
      emitRoomState(room);
      return { state: room.toClientState(playerId) };
    },

    skipOfflineTurn({ roomCode, playerId }) {
      const room = getRoomOrThrow(roomCode);
      room.skipOfflineTurn(playerId);
      emitRoomState(room);
      return { state: room.toClientState(playerId) };
    },

    handleDisconnect(socketId) {
      rooms.forEach((room, roomCode) => {
        const player = room.markDisconnected(socketId);
        if (!player) return;
        if (!room.hasConnectedPlayers()) {
          rooms.delete(roomCode);
          return;
        }
        emitRoomState(room);
      });
    },
  };
}

module.exports = {
  createRoomManager,
};
