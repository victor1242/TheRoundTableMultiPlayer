const { randomUUID } = require("crypto");

function toSafeName(name) {
  const trimmed = String(name || "").trim();
  return trimmed ? trimmed.slice(0, 20) : "Player";
}

class GameRoom {
  constructor(code) {
    this.code = code;
    this.createdAt = Date.now();
    this.players = [];
    this.gameState = {
      phase: "lobby",
      turnIndex: 0,
      version: 0,
      lastAction: null,
    };
  }

  addOrReconnectPlayer({ socketId, playerName, playerId }) {
    const safeName = toSafeName(playerName);

    if (playerId) {
      const existing = this.players.find((p) => p.id === playerId);
      if (existing) {
        existing.socketId = socketId;
        existing.connected = true;
        if (safeName) existing.name = safeName;
        return existing;
      }
    }

    if (this.players.length >= 6) {
      throw new Error("Room is full");
    }

    const player = {
      id: randomUUID(),
      name: safeName,
      socketId,
      connected: true,
      joinedAt: Date.now(),
    };

    this.players.push(player);
    this.bumpVersion("player:joined", { playerId: player.id });
    return player;
  }

  markDisconnected(socketId) {
    const player = this.players.find((p) => p.socketId === socketId);
    if (!player) return null;
    player.connected = false;
    this.bumpVersion("player:left", { playerId: player.id });
    return player;
  }

  startGame(hostPlayerId) {
    if (this.players.length < 2) {
      throw new Error("Need at least 2 players to start");
    }
    if (this.players[0]?.id !== hostPlayerId) {
      throw new Error("Only host can start the game");
    }

    this.gameState.phase = "playing";
    this.gameState.turnIndex = 0;
    this.bumpVersion("game:started", {
      playerId: this.players[0].id,
    });
  }

  applyAction(playerId, action) {
    if (this.gameState.phase !== "playing") {
      throw new Error("Game is not in playing phase");
    }

    const current = this.players[this.gameState.turnIndex];
    if (!current || current.id !== playerId) {
      throw new Error("Not your turn");
    }

    const actionType = action?.type;
    if (!actionType) {
      throw new Error("Missing action type");
    }

    if (actionType === "endTurn") {
      this.gameState.turnIndex = (this.gameState.turnIndex + 1) % this.players.length;
      this.bumpVersion(actionType, { playerId });
      return;
    }

    this.bumpVersion(actionType, { playerId, payload: action?.payload || null });
  }

  bumpVersion(type, payload) {
    this.gameState.version += 1;
    this.gameState.lastAction = {
      type,
      payload,
      ts: Date.now(),
    };
  }

  toClientState() {
    return {
      code: this.code,
      createdAt: this.createdAt,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        isHost: this.players[0]?.id === p.id,
      })),
      gameState: {
        phase: this.gameState.phase,
        turnIndex: this.gameState.turnIndex,
        currentPlayerId: this.players[this.gameState.turnIndex]?.id || null,
        version: this.gameState.version,
        lastAction: this.gameState.lastAction,
      },
    };
  }
}

module.exports = {
  GameRoom,
};
