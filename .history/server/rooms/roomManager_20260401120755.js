const { GameRoom } = require("./gameRoom");
const OfflineAI = require("../ai/offlineAI");

// AI turn delay (ms) — gives a reconnecting player time to rejoin before AI takes over
const AI_TURN_DELAY_MS = 3000;

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

  // Emit personalized state to each connected player so private hands stay hidden.
  function emitRoomState(room) {
    room.players.forEach((p) => {
      if (!p.connected) return;
      const sock = io.sockets.sockets.get(p.socketId);
      if (sock) sock.emit("room:state", room.toClientState(p.id));
    });
  }

  function getRoomOrThrow(roomCode) {
    const room = rooms.get(String(roomCode || "").toUpperCase());
    if (!room) throw new Error("Room not found");
    return room;
  }

  return {
    createRoom({ socket, playerName }) {
      const code = generateRoomCode(rooms);
      const room = new GameRoom(code);
      rooms.set(code, room);

      const player = room.addOrReconnectPlayer({
        socketId: socket.id,
        playerName,
      });

      socket.join(code);
      emitRoomState(room);
      return { roomCode: code, playerId: player.id, state: room.toClientState(player.id) };
    },

    joinRoom({ socket, roomCode, playerName, playerId }) {
      const room = getRoomOrThrow(roomCode);
      const normalizedName = String(playerName || "").trim().toLowerCase();
      const fallbackPlayer = (!playerId && normalizedName)
        ? room.players.find((p) => String(p.name || "").trim().toLowerCase() === normalizedName) || null
        : null;
      const resolvedPlayerId = playerId || (fallbackPlayer && fallbackPlayer.id) || undefined;
      const previousPlayer = resolvedPlayerId ? room.playerById(resolvedPlayerId) : null;
      const previousSocketId = previousPlayer && previousPlayer.socketId !== socket.id
        ? previousPlayer.socketId
        : null;
      const player = room.addOrReconnectPlayer({
        socketId: socket.id,
        playerName,
        playerId: resolvedPlayerId,
      });

      socket.join(room.code);
      if (previousSocketId) {
        const previousSocket = io.sockets.sockets.get(previousSocketId);
        if (previousSocket) {
          previousSocket.emit("session:replaced", {
            roomCode: room.code,
            playerId: player.id,
          });
          previousSocket.leave(room.code);
        }
      }
      emitRoomState(room);
      return { roomCode: room.code, playerId: player.id, state: room.toClientState(player.id) };
    },

    startGame({ roomCode, playerId, socketId }) {
      const room = getRoomOrThrow(roomCode);
      room.startGame(playerId, socketId);
      emitRoomState(room);
      return { state: room.toClientState(playerId) };
    },

    applyAction({ roomCode, playerId, socketId, action }) {
      const room = getRoomOrThrow(roomCode);
      room.applyAction(playerId, socketId, action);
      emitRoomState(room);
      return { state: room.toClientState(playerId) };
    },

    startNextRound({ roomCode, playerId, socketId }) {
      const room = getRoomOrThrow(roomCode);
      room.startNextRound(playerId, socketId);
      emitRoomState(room);
      return { state: room.toClientState(playerId) };
    },

    skipTurn({ roomCode, playerId }) {
      const room = getRoomOrThrow(roomCode);
      room.skipOfflineTurn(playerId);
      emitRoomState(room);
      return { state: room.toClientState(playerId) };
    },

    handleDisconnect(socketId) {
      rooms.forEach((room, roomCode) => {
        const player = room.markDisconnected(socketId);
        if (!player) return;

        const hasConnectedPlayers = room.players.some((p) => p.connected);
        if (!hasConnectedPlayers) {
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
