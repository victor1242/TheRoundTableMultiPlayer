const { randomUUID } = require("crypto");
const Engine = require("../engine/gameEngine");

function toSafeName(name) {
  const trimmed = String(name || "").trim();
  return trimmed ? trimmed.slice(0, 20) : "Player";
}

class GameRoom {
  constructor(code) {
    this.code = code;
    this.createdAt = Date.now();
    this.players = [];
    // gameState holds both lobby metadata and live round state
    this.gameState = {
      phase: "lobby",   // 'lobby' | 'playing' | 'roundOver' | 'gameOver'
      turnIndex: 0,
      version: 0,
      lastAction: null,
      roundNumber: 1,
      cardsDealt: 0,
      deck: null,
      discardPile: [],
      finalTurn: false,
      goingOutPlayerId: null,
      finalTurnQueue: [],
      roundHistory: [],
    };
  }

  // ── Player management ────────────────────────────────────────────────────

  playerById(playerId) {
    return this.players.find((p) => p.id === playerId) || null;
  }

  playerBySocketId(socketId) {
    return this.players.find((p) => p.socketId === socketId) || null;
  }

  findNameConflict(playerName, excludedPlayerId) {
    const normalized = String(playerName || "").trim().toLowerCase();
    if (!normalized) return null;
    return this.players.find((p) => (
      p.id !== excludedPlayerId
      && p.connected
      && String(p.name || "").trim().toLowerCase() === normalized
    )) || null;
  }

  requireActiveSession(playerId, socketId) {
    const player = this.playerById(playerId);
    if (!player) {
      throw new Error("Player not found in this room");
    }
    if (!player.connected || !player.socketId) {
      throw new Error("Player is not currently connected");
    }
    if (player.socketId !== socketId) {
      throw new Error("This player is already active on another page. Rejoin the room to continue.");
    }
    return player;
  }

  addOrReconnectPlayer({ socketId, playerName, playerId }) {
    const hasProvidedName = String(playerName || "").trim().length > 0;
    const safeName = hasProvidedName ? toSafeName(playerName) : null;
    
    // First priority: reconnect by explicit playerId if provided
    if (playerId) {
      const existing = this.playerById(playerId);
      if (existing) {
        existing.socketId = socketId;
        existing.connected = true;
        if (safeName) existing.name = safeName;
        this.bumpVersion("player:reconnected", { playerId: existing.id });
        return existing;
      }
    }

    // Second priority: if a disconnected player has this exact name, reconnect them
    const disconnectedWithName = safeName
      ? this.players.find((p) => (
        !p.connected
        && String(p.name || "").trim().toLowerCase() === safeName.toLowerCase()
      ))
      : null;
    if (disconnectedWithName) {
      disconnectedWithName.socketId = socketId;
      disconnectedWithName.connected = true;
      this.bumpVersion("player:reconnected", { playerId: disconnectedWithName.id });
      return disconnectedWithName;
    }

    // Check for name conflict with connected players only
    const nameConflict = safeName ? this.findNameConflict(safeName, playerId) : null;
    if (nameConflict) {
      throw new Error("That name is already in use in this room");
    }

    if (this.players.length >= 6) {
      throw new Error("Room is full");
    }

    const player = {
      id: randomUUID(),
      name: safeName || "Player",
      socketId,
      connected: true,
      joinedAt: Date.now(),
      // game-phase fields (set by setupRound)
      hand: [],
      meldSets: [],
      meldCards: [],
      meldCount: 0,
      hasDrawn: false,
      IsOut: false,
      roundScore: 0,
      gameScore: 0,
    };

    this.players.push(player);
    this.bumpVersion("player:joined", { playerId: player.id });
    return player;
  }

  markDisconnected(socketId) {
    const player = this.playerBySocketId(socketId);
    if (!player) return null;
    player.connected = false;
    this.bumpVersion("player:left", { playerId: player.id });
    return player;
  }

  // ── Game lifecycle ───────────────────────────────────────────────────────

  startGame(hostPlayerId, socketId) {
    this.requireActiveSession(hostPlayerId, socketId);
    if (this.players.length < 2) {
      throw new Error("Need at least 2 players to start");
    }
    if (this.players[0]?.id !== hostPlayerId) {
      throw new Error("Only host can start the game");
    }

    this._setupRound(1);
    this.gameState.phase = "playing";
    this.gameState.turnIndex = 0;
    this.bumpVersion("game:started", { playerId: this.players[0].id });
  }

  _setupRound(roundNumber) {
    const gs = this.gameState;
    gs.roundNumber = roundNumber;
    gs.finalTurn = false;
    gs.goingOutPlayerId = null;
    gs.finalTurnQueue = [];

    // Engine.setupRound resets hand/meldSets/meldCards/meldCount/IsOut on every player
    // and returns a fresh shuffled deck + initial discard card
    const { deck, discardPile, cardsDealt } = Engine.setupRound(this.players, roundNumber);
    gs.deck = deck;
    gs.discardPile = discardPile;
    gs.cardsDealt = cardsDealt;

    // Reset per-turn flag for all players
    this.players.forEach((p) => {
      p.hasDrawn = false;
      p.roundScore = 0;
    });
  }

  // ── Action handling ──────────────────────────────────────────────────────
  //
  // Each action follows the same pattern:
  //   1. Validate pre-conditions  (throws on failure — caller catches and sends error)
  //   2. Mutate state
  //   3. bumpVersion so clients know something changed
  //
  // Actions:
  //   drawDeck     — draw top card from draw pile into current player's hand
  //   drawDiscard  — take top card from discard pile into current player's hand
  //   declareMeld  — move selected hand cards into a meld set (server-validates)
  //   undoMelds    — return all meld sets back to hand (before discarding)
  //   discardCard  — place a hand card on discard, then advance turn

  applyAction(playerId, socketId, action) {
    if (this.gameState.phase !== "playing") {
      throw new Error("Game is not in playing phase");
    }

    this.requireActiveSession(playerId, socketId);

    const gs = this.gameState;
    const current = this.players[gs.turnIndex];
    if (!current || current.id !== playerId) {
      throw new Error("Not your turn");
    }

    const { type, payload } = action || {};
    if (!type) throw new Error("Missing action type");

    const wildRank = Engine.wildRankForRound(gs.roundNumber);

    switch (type) {

      // ── DRAW FROM DECK ──────────────────────────────────────────────────
      // Pre-condition: player has not yet drawn this turn
      // Effect:        draws top card from deck (reshuffles discard if deck empty),
      //                pushes card to player hand, marks hasDrawn = true
      case "drawDeck": {
        if (current.hasDrawn) throw new Error("You already drew a card this turn");
        if (gs.deck.size === 0) {
          // Reshuffle discard pile back into deck, keep the top discard visible
          Engine.reshuffleDiscardIntoDeck(gs.deck, gs.discardPile);
        }
        const card = gs.deck.draw();
        if (!card) throw new Error("No cards left in deck");
        current.hand.push(card);
        current.hasDrawn = true;
        break;
      }

      // ── DRAW FROM DISCARD ───────────────────────────────────────────────
      // Pre-condition: player has not yet drawn, discard pile not empty
      // Effect:        removes top card from discard, pushes to player hand,
      //                marks hasDrawn = true
      case "drawDiscard": {
        if (current.hasDrawn) throw new Error("You already drew a card this turn");
        if (gs.discardPile.length === 0) throw new Error("Discard pile is empty");
        const card = Engine.drawFromDiscard(gs.discardPile);
        current.hand.push(card);
        current.hasDrawn = true;
        break;
      }

      // ── DECLARE MELD ────────────────────────────────────────────────────
      // Pre-condition: player has drawn, selects 3+ hand cards by index
      // Effect:        if meld is valid (set or run), moves those cards from
      //                hand to a new meldSet entry
      // Note:          player must keep at least 1 card to discard at end of turn
      case "declareMeld": {
        if (!current.hasDrawn) throw new Error("Draw a card before melding");
        const { handIndices } = payload || {};
        if (!Array.isArray(handIndices) || handIndices.length < 3) {
          throw new Error("Select at least 3 cards to meld");
        }
        // Validate all indices are in range
        for (const i of handIndices) {
          if (i < 0 || i >= current.hand.length) {
            throw new Error(`Card index ${i} is out of range`);
          }
        }
        // Must keep at least 1 card in hand to discard later
        if (handIndices.length >= current.hand.length) {
          throw new Error("You must keep at least one card to discard");
        }
        const cards = handIndices.map((i) => current.hand[i]);
        const result = Engine.validateMeld(cards, wildRank);
        if (!result.valid) {
          throw new Error(
            "Invalid meld: "
              + (result.reason || "not a valid set or run")
              + ". Wild this round: " + wildRank + " and jokers"
          );
        }
        // Move cards from hand to meldSets
        const indexSet = new Set(handIndices);
        current.meldSets.push(cards);
        current.hand = current.hand.filter((_, i) => !indexSet.has(i));
        break;
      }

      // ── UNDO MELDS ──────────────────────────────────────────────────────
      // Pre-condition: player has drawn
      // Effect:        returns all cards from meldSets back into hand
      //                (allowed until the player discards to end their turn)
      case "undoMelds": {
        if (!current.hasDrawn) throw new Error("Draw a card first");
        current.meldSets.forEach((set) => current.hand.push(...set));
        current.meldSets = [];
        break;
      }

      // ── DISCARD CARD ────────────────────────────────────────────────────
      // Pre-condition: player has drawn, cardIndex is a valid hand index
      // Effect:        removes card from hand, places on discard pile,
      //                clears hasDrawn, advances turn.
      //                If hand is now empty → player goes out (finalTurn = true).
      //                If it was finalTurn and we return to the player who went out
      //                → round ends.
      case "discardCard": {
        if (!current.hasDrawn) throw new Error("Draw a card before discarding");
        const { cardIndex } = payload || {};
        if (cardIndex === undefined || cardIndex < 0 || cardIndex >= current.hand.length) {
          throw new Error("Invalid card index");
        }
        const card = current.hand.splice(cardIndex, 1)[0];
        Engine.placeOnDiscard(gs.discardPile, card);

        // Going out: player melded all cards and discarded the last one
        if (current.hand.length === 0) {
          current.IsOut = true;
          gs.finalTurn = true;

          // First player to go out starts final-turn mode.
          // Everyone else who is still active gets exactly one final turn.
          if (!gs.goingOutPlayerId) {
            gs.goingOutPlayerId = current.id;
            gs.finalTurnQueue = [];
            let idx = (gs.turnIndex + 1) % this.players.length;
            while (idx !== gs.turnIndex) {
              const p = this.players[idx];
              if (p && !p.IsOut && p.id !== current.id) {
                gs.finalTurnQueue.push(p.id);
              }
              idx = (idx + 1) % this.players.length;
            }
          }
        }

        // Reset draw flag before either ending the round or advancing.
        current.hasDrawn = false;

        // During final turn mode, remove this player from the queue after they discard.
        if (gs.goingOutPlayerId) {
          const queueIdx = gs.finalTurnQueue.indexOf(current.id);
          if (queueIdx !== -1) {
            gs.finalTurnQueue.splice(queueIdx, 1);
          }
        }

        // Round ends as soon as no players are owed a final turn.
        if (gs.goingOutPlayerId && gs.finalTurnQueue.length === 0) {
          this._endRound();
          break;
        }

        // Otherwise continue with the next active player.
        const nextIndex = Engine.nextPlayerIndex(gs.turnIndex, this.players);
        gs.turnIndex = nextIndex;
        break;
      }

      default:
        throw new Error("Unknown action: " + type);
    }

    this.bumpVersion(type, { playerId, payload: payload || null });
  }

  // ── Skip offline player's turn ───────────────────────────────────────────
  // Any connected player can call this when it is an offline player's turn.
  skipOfflineTurn(requestingPlayerId) {
    if (this.gameState.phase !== "playing") {
      throw new Error("Game is not in playing phase");
    }
    const requesting = this.playerById(requestingPlayerId);
    if (!requesting || !requesting.connected) {
      throw new Error("You must be connected to skip a turn");
    }
    const gs = this.gameState;
    const current = this.players[gs.turnIndex];
    if (!current) throw new Error("No current player");
    if (current.connected) {
      throw new Error(current.name + " is connected — cannot skip their turn");
    }

    // If they haven't drawn yet, draw from deck automatically
    if (!current.hasDrawn) {
      if (gs.deck.size === 0) {
        Engine.reshuffleDiscardIntoDeck(gs.deck, gs.discardPile);
      }
      const card = gs.deck.draw();
      if (card) current.hand.push(card);
      current.hasDrawn = true;
    }

    // Discard the first card in hand
    if (current.hand.length === 0) {
      throw new Error("Offline player has no cards to discard");
    }
    const discarded = current.hand.splice(0, 1)[0];
    Engine.placeOnDiscard(gs.discardPile, discarded);

    // Check going-out (hand empty after discard)
    if (current.hand.length === 0) {
      current.IsOut = true;
      gs.finalTurn = true;
      if (!gs.goingOutPlayerId) {
        gs.goingOutPlayerId = current.id;
        gs.finalTurnQueue = [];
        let idx = (gs.turnIndex + 1) % this.players.length;
        while (idx !== gs.turnIndex) {
          const p = this.players[idx];
          if (p && !p.IsOut && p.id !== current.id) gs.finalTurnQueue.push(p.id);
          idx = (idx + 1) % this.players.length;
        }
      }
    }

    current.hasDrawn = false;

    if (gs.goingOutPlayerId) {
      const qIdx = gs.finalTurnQueue.indexOf(current.id);
      if (qIdx !== -1) gs.finalTurnQueue.splice(qIdx, 1);
    }

    if (gs.goingOutPlayerId && gs.finalTurnQueue.length === 0) {
      this._endRound();
    } else {
      gs.turnIndex = Engine.nextPlayerIndex(gs.turnIndex, this.players);
    }

    this.bumpVersion("skipOfflineTurn", { skippedPlayerId: current.id, byPlayerId: requestingPlayerId });
  }

  _endRound() {
    const gs = this.gameState;
    const wildRank = Engine.wildRankForRound(gs.roundNumber);

    this.players.forEach((p) => {
      p.roundScore = Engine.calculateRoundScore(p, wildRank, true);
      p.gameScore = (p.gameScore || 0) + p.roundScore;
    });

    gs.roundHistory.push({
      round: gs.roundNumber,
      players: this.players.map((p) => ({
        id: p.id,
        roundScore: p.roundScore || 0,
        gameScore: p.gameScore || 0,
        wentOut: Boolean(p.IsOut),
        hand: [...(p.hand || [])],
        meldSets: (p.meldSets || []).map((set) => [...set]),
      })),
    });

    gs.phase = gs.roundNumber >= Engine.LAST_ROUND ? "gameOver" : "roundOver";
  }

  startNextRound(hostPlayerId, socketId) {
    this.requireActiveSession(hostPlayerId, socketId);
    if (this.gameState.phase !== "roundOver") {
      throw new Error("Round is not over yet");
    }
    if (this.players[0]?.id !== hostPlayerId) {
      throw new Error("Only host can start the next round");
    }
    const nextRound = this.gameState.roundNumber + 1;
    this._setupRound(nextRound);
    // Advance dealer: first player rotates to back
    this.players.push(this.players.shift());
    this.gameState.turnIndex = 0;
    this.gameState.phase = "playing";
    this.bumpVersion("round:started", { round: nextRound });
  }

  // ── Versioning ───────────────────────────────────────────────────────────

  bumpVersion(type, payload) {
    this.gameState.version += 1;
    this.gameState.lastAction = { type, payload, ts: Date.now() };
  }

  // ── State serialization ──────────────────────────────────────────────────
  //
  // toClientState(callerPlayerId) builds a personalized payload:
  //   - All clients get the same public info (opponent hand sizes, discard top, etc.)
  //   - Only the calling player sees their own private hand (myHand, myMelds)
  //
  // Parameter callerPlayerId is optional; omit to get public-only data.

  toClientState(callerPlayerId) {
    const gs = this.gameState;
    const isPlaying = gs.phase === "playing" || gs.phase === "roundOver" || gs.phase === "gameOver";

    // Base (lobby) payload — always safe to send to all players
    const base = {
      code: this.code,
      createdAt: this.createdAt,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        isHost: this.players[0]?.id === p.id,
      })),
      gameState: {
        phase: gs.phase,
        turnIndex: gs.turnIndex,
        currentPlayerId: this.players[gs.turnIndex]?.id || null,
        version: gs.version,
        lastAction: gs.lastAction,
      },
    };

    if (!isPlaying) return base;

    // ── Build the game sub-object ────────────────────────────────────────
    const wildRank     = Engine.wildRankForRound(gs.roundNumber);
    const currentP    = this.players[gs.turnIndex];
    const caller       = callerPlayerId ? this.players.find((p) => p.id === callerPlayerId) : null;
    const isMyTurn     = Boolean(caller && currentP && caller.id === currentP.id);
    const myTurnPhase  = isMyTurn
      ? (currentP.hasDrawn ? "meld-discard" : "draw")
      : null;
    const outPlayerIds = this.players
      .filter((p) => Boolean(p.IsOut))
      .map((p) => p.id);

    base.game = {
      phase:             gs.phase,
      roundNumber:       gs.roundNumber,
      cardsDealt:        gs.cardsDealt,
      wildRank,
      deckSize:          gs.deck ? gs.deck.size : 0,
      discardTop:        gs.discardPile.length > 0
                           ? gs.discardPile[gs.discardPile.length - 1]
                           : null,
      discardSize:       gs.discardPile.length,
      isMyTurn,
      myTurnPhase,
      currentPlayerName: currentP ? currentP.name : "",
      myIsOut:           Boolean(caller && caller.IsOut),
      outPlayerIds,

      // ── Private: only this player's cards ───────────────────────────────
      // myHand and myMelds are private — only meaningful if callerPlayerId is set
      myHand:  caller ? (caller.hand     || []) : [],
      myMelds: caller ? (caller.meldSets || []) : [],

      // ── Public: opponents (no private card data) ─────────────────────────
      opponents: this.players
        .filter((p) => p.id !== callerPlayerId)
        .map((p) => ({
          id:            p.id,
          name:          p.name,
          handSize:      (p.hand || []).length,
          meldSets:      p.meldSets || [],
          isCurrentTurn: currentP && p.id === currentP.id,
          isOut:         Boolean(p.IsOut),
          roundScore:    p.roundScore || 0,
          gameScore:     p.gameScore  || 0,
          connected:     p.connected,
        })),

      // Score history built from round-end data
      scoreboardData: gs.roundHistory || [],
    };

    return base;
  }
}

module.exports = { GameRoom };

