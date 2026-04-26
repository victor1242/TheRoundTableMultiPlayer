const { GameRoom } = require("./gameRoom");

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
