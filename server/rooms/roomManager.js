const { GameRoom } = require("./gameRoom");
const OfflineAI = require("../ai/offlineAI");
const SuspendedGames = require("../suspendedGames");

// AI turn delay (ms) — gives a reconnecting player time to rejoin before AI takes over
const AI_TURN_DELAY_MS = 3000;
// Keep empty rooms alive briefly to survive transient disconnects/reloads.
const ROOM_EMPTY_GRACE_MS = Number(process.env.ROOM_EMPTY_GRACE_MS) || 120000;

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
  // Map of roomCode -> pending AI timer id
  const aiTimers = new Map();
  // Map of roomCode -> pending room-destruction timer id
  const roomDestroyTimers = new Map();

  // Emit personalized state to each connected player so private hands stay hidden.
  function emitRoomState(room) {
    // If a socket was accidentally associated with multiple player entries,
    // emit only one personalized payload to that socket (latest entry wins).
    const latestPlayerBySocketId = new Map();
    room.players.forEach((p) => {
      if (!p.connected || !p.socketId) return;
      latestPlayerBySocketId.set(p.socketId, p);
    });

    latestPlayerBySocketId.forEach((player, socketId) => {
      const sock = io.sockets.sockets.get(socketId);
      if (sock) sock.emit("room:state", room.toClientState(player.id));
    });
  }

  function emitStateAndScheduleAI(room) {
    reconcileRoomConnections(room);
    emitRoomState(room);
    scheduleAIIfNeeded(room);
  }

  function logSocketPlayerMap(room, reason) {
    const mapSummary = room.players
      .map((p) => `${p.name}[${p.id.slice(0, 8)}]:${p.socketId || "none"}:${p.connected ? "online" : "offline"}`)
      .join(" | ");
    console.log(`[multiplayer][map][${reason}] room=${room.code} players=${room.players.length} ${mapSummary}`);
  }

  // Defensive reconciliation: if Socket.IO no longer has a player's socket,
  // mark them disconnected even if the disconnect callback is delayed.
  function reconcileRoomConnections(room) {
    room.players.forEach((player) => {
      if (!player.connected) return;
      if (!player.socketId) {
        player.connected = false;
        room.bumpVersion("player:left", { playerId: player.id });
        return;
      }
      const sock = io.sockets.sockets.get(player.socketId);
      if (!sock) {
        player.connected = false;
        player.socketId = null;
        room.bumpVersion("player:left", { playerId: player.id });
      }
    });
  }

  function getRoomOrThrow(roomCode) {
    const room = rooms.get(String(roomCode || "").toUpperCase());
    if (!room) throw new Error("Room not found");
    return room;
  }

  // Try to get a room, or restore from suspended games if it doesn't exist
  function getOrRestoreRoom(roomCode) {
    const normalizedCode = String(roomCode || "").toUpperCase();
    
    // First, check if room exists in memory
    let room = rooms.get(normalizedCode);
    if (room) return room;

    // If not, check if a suspended game exists
    const suspended = SuspendedGames.loadPausedGame(normalizedCode);
    if (!suspended) {
      throw new Error("Room not found");
    }

    // Restore the room from suspended game
    console.log(`[roomManager] Restoring paused game from storage: ${normalizedCode}`);
    room = new GameRoom(normalizedCode);
    
    // Restore the full game state
    room.gameState = suspended.gameState;
    
    // Restore players with all their data (hands, melds, scores)
    suspended.players.forEach(playerData => {
      room.players.push({
        id: playerData.id,
        name: playerData.name,
        socketId: null, // Will be set when they connect
        connected: false,
        hand: playerData.hand || [],
        meldSets: playerData.melds || [],
        gameScore: playerData.gameScore || 0,
        roundScore: playerData.roundScore || 0,
        IsOut: playerData.IsOut || false,
      });
    });

    rooms.set(normalizedCode, room);
    return room;
  }

  // Schedule an AI turn if the current player is offline.
  // Chains automatically for consecutive offline players.
  function scheduleAIIfNeeded(room) {
    const gs = room.gameState;
    if (!gs || gs.phase !== "playing") return;

    const current = room.players[gs.turnIndex];
    if (!current || current.connected) return;

    // Don't double-schedule
    if (aiTimers.has(room.code)) return;

    console.log(`[AI] Scheduling turn for offline player "${current.name}" in ${AI_TURN_DELAY_MS}ms`);

    const timerId = setTimeout(() => {
      aiTimers.delete(room.code);

      // Re-check: player may have reconnected during the delay
      const gs2 = room.gameState;
      if (!gs2 || gs2.phase !== "playing") return;
      const curr = room.players[gs2.turnIndex];
      if (!curr || curr.connected) return;

      try {
        OfflineAI.playOfflineTurn(room);
        emitRoomState(room);
        // Chain: next player may also be offline
        scheduleAIIfNeeded(room);
      } catch (err) {
        console.error(`[AI] playOfflineTurn failed: ${err.message}`);
        // Fail-safe: if AI logic errors, force-skip the offline turn so game cannot deadlock.
        try {
          const fallbackCaller = room.players.find((p) => p.connected);
          if (!fallbackCaller) return;
          room.skipOfflineTurn(fallbackCaller.id);
          emitRoomState(room);
          scheduleAIIfNeeded(room);
        } catch (fallbackErr) {
          console.error(`[AI] fallback skip failed: ${fallbackErr.message}`);
        }
      }
    }, AI_TURN_DELAY_MS);

    aiTimers.set(room.code, timerId);
  }

  // Cancel a pending AI timer for a room (called when a player reconnects)
  function cancelAITimer(roomCode) {
    if (aiTimers.has(roomCode)) {
      clearTimeout(aiTimers.get(roomCode));
      aiTimers.delete(roomCode);
      console.log(`[AI] Cancelled pending AI turn for room ${roomCode} (player reconnected)`);
    }
  }

  function cancelRoomDestroyTimer(roomCode) {
    if (!roomDestroyTimers.has(roomCode)) return;
    clearTimeout(roomDestroyTimers.get(roomCode));
    roomDestroyTimers.delete(roomCode);
    console.log(`[disconnect] Cancelled pending room destroy for ${roomCode} (player reconnected)`);
  }

  function scheduleRoomDestroyIfEmpty(roomCode) {
    if (roomDestroyTimers.has(roomCode)) return;

    const timerId = setTimeout(() => {
      roomDestroyTimers.delete(roomCode);
      const room = rooms.get(roomCode);
      if (!room) return;

      const hasConnectedPlayers = room.players.some((p) => p.connected);
      if (hasConnectedPlayers) {
        console.log(`[disconnect] ${roomCode} recovered before destroy timeout. Keeping room alive.`);
        return;
      }

      console.log(`[disconnect] Grace elapsed and no connected players in ${roomCode}. Destroying room.`);
      cancelAITimer(roomCode);
      rooms.delete(roomCode);
      // Safety: keep suspended game files so hosts can recover later from Paused Games,
      // even if the in-memory live room is cleaned up.
    }, ROOM_EMPTY_GRACE_MS);

    roomDestroyTimers.set(roomCode, timerId);
    console.log(`[disconnect] No connected players remain in ${roomCode}. Scheduling destroy in ${ROOM_EMPTY_GRACE_MS}ms.`);
  }

  return {
    createRoom({ socket, playerName }) {
      const code = generateRoomCode(rooms);
      const room = new GameRoom(code);
      rooms.set(code, room);
      cancelRoomDestroyTimer(code);

      const player = room.addOrReconnectPlayer({
        socketId: socket.id,
        playerName,
      });

      socket.join(code);
      logSocketPlayerMap(room, "create");
      emitStateAndScheduleAI(room);
      return { roomCode: code, playerId: player.id, state: room.toClientState(player.id) };
    },

    joinRoom({ socket, roomCode, playerName, playerId }) {
      const room = getOrRestoreRoom(roomCode);
      cancelRoomDestroyTimer(room.code);
      // Clean up any ghost-connected players (socket closed but disconnect event not yet
      // processed) before name-matching, so a returning player can always reclaim their slot.
      reconcileRoomConnections(room);
      const normalizedName = String(playerName || "").trim().toLowerCase();
      const fallbackPlayer = (!playerId && normalizedName)
        ? room.players.find((p) => (
          !p.connected
          && String(p.name || "").trim().toLowerCase() === normalizedName
        )) || null
        : null;
      const resolvedPlayerId = playerId || (fallbackPlayer && fallbackPlayer.id) || undefined;
      const previousPlayer = resolvedPlayerId ? room.playerById(resolvedPlayerId) : null;
      const previousSocketId = previousPlayer && previousPlayer.socketId !== socket.id
        ? previousPlayer.socketId
        : null;
      // Detect silent resyncs: player already connected on same socket — nothing changed
      const isNoOpResync = previousPlayer && previousPlayer.connected && previousPlayer.socketId === socket.id;
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

      // If the reconnecting player was the one the AI was waiting to cover, cancel it
      const gs = room.gameState;
      if (gs && gs.phase === "playing") {
        const curr = room.players[gs.turnIndex];
        if (curr && curr.id === player.id) {
          cancelAITimer(room.code);
        }
      }

      if (!isNoOpResync) logSocketPlayerMap(room, "join");
      emitStateAndScheduleAI(room);
      return { roomCode: room.code, playerId: player.id, state: room.toClientState(player.id) };
    },

    startGame({ roomCode, playerId, socketId }) {
      const room = getRoomOrThrow(roomCode);
      room.startGame(playerId, socketId);
      emitStateAndScheduleAI(room);
      return { state: room.toClientState(playerId) };
    },

    pauseGame({ roomCode, playerId, socketId, description }) {
      const room = getRoomOrThrow(roomCode);
      room.pauseGame(playerId, socketId, description);
      emitStateAndScheduleAI(room);
      return { state: room.toClientState(playerId) };
    },

    resumeGame({ roomCode, playerId, socketId }) {
      const room = getRoomOrThrow(roomCode);
      room.resumeGame(playerId, socketId);
      emitStateAndScheduleAI(room);
      return { state: room.toClientState(playerId) };
    },

    restartGame({ roomCode, playerId, socketId }) {
      const room = getRoomOrThrow(roomCode);
      room.restartGame(playerId, socketId);
      emitStateAndScheduleAI(room);
      return { state: room.toClientState(playerId) };
    },

    applyAction({ roomCode, playerId, socketId, action }) {
      const room = getRoomOrThrow(roomCode);
      room.applyAction(playerId, socketId, action);
      emitStateAndScheduleAI(room);
      return { state: room.toClientState(playerId) };
    },

    startNextRound({ roomCode, playerId, socketId }) {
      const room = getRoomOrThrow(roomCode);
      room.startNextRound(playerId, socketId);
      emitStateAndScheduleAI(room);
      return { state: room.toClientState(playerId) };
    },

    skipTurn({ roomCode, playerId }) {
      const room = getRoomOrThrow(roomCode);
      room.skipOfflineTurn(playerId);
      emitStateAndScheduleAI(room);
      return { state: room.toClientState(playerId) };
    },

    getPlayerName(roomCode, playerId) {
      const room = rooms.get(roomCode);
      if (!room) return null;
      const player = room.playerById(playerId);
      return player ? player.name : null;
    },

    resolveChatTargets({ roomCode, senderPlayerId, recipientIds }) {
      const normalizedRoomCode = String(roomCode || "").toUpperCase();
      const room = rooms.get(normalizedRoomCode);
      if (!room) throw new Error("Room not found");

      const sender = room.playerById(senderPlayerId);
      if (!sender || !sender.connected || !sender.socketId) {
        throw new Error("Sender is not connected in this room");
      }

      const connectedPlayers = room.players.filter((p) => p.connected && p.socketId);
      const recipientSet = new Set(
        Array.isArray(recipientIds)
          ? recipientIds.map((id) => String(id || "")).filter(Boolean)
          : []
      );

      const isBroadcast = recipientSet.size === 0;
      const targets = isBroadcast
        ? connectedPlayers.filter((p) => p.id !== sender.id)
        : connectedPlayers.filter((p) => p.id !== sender.id && recipientSet.has(String(p.id)));

      return {
        roomCode: room.code,
        sender: {
          id: sender.id,
          name: sender.name,
          socketId: sender.socketId,
        },
        isBroadcast,
        targets: targets.map((p) => ({
          id: p.id,
          name: p.name,
          socketId: p.socketId,
        })),
      };
    },

    handleDisconnect(socketId) {
      rooms.forEach((room, roomCode) => {
        const player = room.markDisconnected(socketId);
        if (!player) return;

        console.log(`[disconnect] Player "${player.name}" (${player.id}) disconnected from room ${roomCode}`);
        console.log(`[disconnect] Room has ${room.players.length} total players: ${room.players.map(p => `${p.name}(${p.connected ? 'online' : 'offline'})`).join(', ')}`);

        const hasConnectedPlayers = room.players.some((p) => p.connected);
        if (!hasConnectedPlayers) {
          scheduleRoomDestroyIfEmpty(roomCode);
          return;
        }

        cancelRoomDestroyTimer(roomCode);
        console.log(`[disconnect] Room ${roomCode} still has connected players. Keeping room alive.`);
        emitStateAndScheduleAI(room);
      });
    },
  };
}

module.exports = {
  createRoomManager,
};
