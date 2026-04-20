'use strict';

const { randomUUID } = require('crypto');
const { FiveCrownsGame } = require('../game/fiveCrownsGame');

function toSafeName(name) {
  const trimmed = String(name || '').trim();
  return trimmed ? trimmed.slice(0, 20) : 'Player';
}

class GameRoom {
  constructor(code) {
    this.code = code;
    this.createdAt = Date.now();
    this.players = [];   // { id, name, socketId, connected }
    this.game = null;    // FiveCrownsGame instance
    this.phase = 'lobby';
  }

  // Player management
  addOrReconnectPlayer({ socketId, playerName, playerId }) {
    const hasProvidedName = String(playerName || '').trim().length > 0;
    const safeName = hasProvidedName ? toSafeName(playerName) : null;
    
    // First priority: reconnect by explicit playerId if provided
    if (playerId) {
      const existing = this.players.find((p) => p.id === playerId);
      if (existing) {
        existing.socketId = socketId;
        existing.connected = true;
        if (safeName) existing.name = safeName;
        return existing;
      }
    }

    // Second priority: if a disconnected player has this exact name, reconnect them
    const disconnectedWithName = safeName
      ? this.players.find((p) => (
        !p.connected
        && String(p.name || '').trim().toLowerCase() === safeName.toLowerCase()
      ))
      : null;
    if (disconnectedWithName) {
      disconnectedWithName.socketId = socketId;
      disconnectedWithName.connected = true;
      return disconnectedWithName;
    }

    if (this.players.length >= 6) throw new Error('Room is full');
    const player = {
      id: randomUUID(),
      name: safeName || 'Player',
      socketId,
      connected: true,
      joinedAt: Date.now(),
    };
    this.players.push(player);
    return player;
  }

  markDisconnected(socketId) {
    const player = this.players.find((p) => p.socketId === socketId);
    if (!player) return null;
    player.connected = false;
    return player;
  }

  hasConnectedPlayers() {
    return this.players.some((p) => p.connected);
  }

  isHost(playerId) {
    return this.players.length > 0 && this.players[0].id === playerId;
  }

  playerById(playerId) {
    return this.players.find((p) => p.id === playerId) || null;
  }

  // Game lifecycle
  startGame(hostPlayerId) {
    if (!this.isHost(hostPlayerId)) throw new Error('Only the host can start the game');
    if (this.players.length < 2) throw new Error('Need at least 2 players to start');
    if (this.phase === 'playing') throw new Error('Game already started');
    const playerIds = this.players.map((p) => p.id);
    this.game = new FiveCrownsGame(playerIds);
    this.game.startRound();
    this.phase = 'playing';
  }

  // Action dispatch
  applyAction(playerId, action) {
    if (!this.game) throw new Error('Game has not started');
    const type = action && action.type;
    switch (type) {
      case 'drawDeck':
        return this.game.drawDeck(playerId);
      case 'drawDiscard':
        return this.game.drawDiscard(playerId);
      case 'declareMeld': {
        const indices = action.payload && action.payload.handIndices;
        if (!Array.isArray(indices)) throw new Error('Missing handIndices in payload');
        return this.game.declareMeld(playerId, indices);
      }
      case 'undoMelds':
        return this.game.undoMelds(playerId);
      case 'discardCard': {
        const cardIndex = action.payload && action.payload.cardIndex;
        if (typeof cardIndex !== 'number') throw new Error('Missing cardIndex in payload');
        return this.game.discardCard(playerId, cardIndex);
      }
      case 'nextRound':
        if (!this.isHost(playerId)) throw new Error('Only the host can advance to the next round');
        this.game.nextRound();
        return {};
      default:
        throw new Error('Unknown action type: ' + type);
    }
  }

  skipOfflineTurn(requestingPlayerId) {
    if (!this.game) throw new Error('Game has not started');

    const requester = this.playerById(requestingPlayerId);
    if (!requester || !requester.connected) {
      throw new Error('Only connected players in the room can skip offline turns');
    }

    const currentId = this.game.currentPlayerId;
    const currentPlayer = this.playerById(currentId);
    if (!currentPlayer) throw new Error('Current player not found');
    if (currentPlayer.connected) throw new Error('Current player is not offline');

    this.game.skipCurrentTurn(currentId);
    return {};
  }

  // State serialisation
  toLobbyState() {
    return {
      code: this.code,
      phase: this.phase,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, connected: p.connected, isHost: this.isHost(p.id),
      })),
    };
  }

  toClientState(forPlayerId) {
    const lobby = this.toLobbyState();
    const playerNames = Object.fromEntries(this.players.map((p) => [p.id, p.name]));
    if (!this.game) return Object.assign({}, lobby, { game: null });

    const gameState = this.game.toClientState(forPlayerId);
    gameState.opponents = gameState.opponents.map((opp) =>
      Object.assign({}, opp, { name: playerNames[opp.id] || opp.id })
    );
    gameState.goingOutPlayerName = playerNames[gameState.goingOutPlayerName] || gameState.goingOutPlayerName;
    gameState.currentPlayerName = playerNames[gameState.currentPlayerId] || gameState.currentPlayerId;
    return Object.assign({}, lobby, { game: gameState });
  }
}

module.exports = { GameRoom };
