/**
 * multiplayerClient.js
 * Client-side Socket.io wrapper for Five Crowns multiplayer.
 *
 * Usage: included by multiplayer.html only.
 * Exposes window.MP (the client API).
 */
(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────
  // Multiplayer server runs on port 3001. If this page is served from a
  // static server (e.g. :5500), connect to the same host on :3001.
  const SERVER_PORT = '3001';
  const SERVER_URL = window.location.port === SERVER_PORT
    ? window.location.origin
    : (window.location.protocol + '//' + window.location.hostname + ':' + SERVER_PORT);

  // ── State ────────────────────────────────────────────────────────────────
  let socket = null;
  let myPlayerId = null;
  let myPlayerName = '';
  let myRoomCode = '';
  let latestState = null;       // last room:state received
  let selectedHandIndices = []; // cards selected for a meld

  // ── DOM helpers ──────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  function show(id) { const el = $(id); if (el) el.style.display = ''; }
  function hide(id) { const el = $(id); if (el) el.style.display = 'none'; }
  function setText(id, txt) { const el = $(id); if (el) el.textContent = txt; }
  function setHTML(id, html) { const el = $(id); if (el) el.innerHTML = html; }

  function showStatus(msg, isError) {
    const el = $('mp-status');
    if (!el) return;
    const roomSuffix = myRoomCode ? (' | Room: ' + myRoomCode) : '';
    el.textContent = String(msg || '') + roomSuffix;
    el.className = isError ? 'mp-status error' : 'mp-status';
  }

  // ── Card rendering ───────────────────────────────────────────────────────
  const SUIT_ICONS = {
    spades: '♠', clubs: '♣', hearts: '♥', diamonds: '♦', stars: '★',
  };
  const SUIT_COLOURS = {
    spades: '#000', clubs: '#000', hearts: '#c00', diamonds: '#c00', stars: '#c80',
  };

  function cardHTML(card, index, isSelected, isDiscardable) {
    if (!card) return '';
    const icon = SUIT_ICONS[card.suit] || card.suit;
    const colour = SUIT_COLOURS[card.suit] || '#000';
    const selectedClass = isSelected ? ' selected' : '';
    const discardClass = isDiscardable ? ' discardable' : '';
    return `<button class="mp-card${selectedClass}${discardable(isDiscardable)}"
              data-index="${index}"
              style="color:${colour}"
              title="${card.rank} of ${card.suit}">
              <span class="card-rank">${card.rank}</span>
              <span class="card-suit">${icon}</span>
            </button>`;
  }

  function discardable(flag) { return flag ? ' discardable' : ''; }

  function cardFaceHTML(card) {
    if (!card) return '<span class="mp-card empty">—</span>';
    const icon = SUIT_ICONS[card.suit] || card.suit;
    const colour = SUIT_COLOURS[card.suit] || '#000';
    return `<span class="mp-card face" style="color:${colour}">${card.rank} ${icon}</span>`;
  }

  // ── Connect ───────────────────────────────────────────────────────────────
  function connect() {
    if (socket && socket.connected) return;
    if (typeof io !== 'function') {
      showStatus('Socket client failed to load. Refresh page and try again.', true);
      return;
    }
    socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      showStatus('Connected to server');
      // Attempt auto-reconnect if we have stored credentials
      const saved = loadSession();
      if (saved && saved.roomCode && saved.playerId) {
        joinRoom(saved.roomCode, saved.playerName, saved.playerId);
      }
    });

    socket.on('disconnect', () => showStatus('Disconnected from server', true));
    socket.on('connect_error', () => showStatus('Cannot reach server', true));

    socket.on('room:state', (state) => {
      latestState = state;
      saveSession();
      render(state);
    });
  }

  // ── Session persistence (survive page reload) ─────────────────────────────
  function saveSession() {
    if (!myPlayerId) return;
    sessionStorage.setItem('mp_session', JSON.stringify({
      playerId: myPlayerId,
      playerName: myPlayerName,
      roomCode: myRoomCode,
    }));
  }

  function loadSession() {
    try {
      return JSON.parse(sessionStorage.getItem('mp_session') || 'null');
    } catch { return null; }
  }

  function clearSession() {
    sessionStorage.removeItem('mp_session');
    myPlayerId = null;
    myPlayerName = '';
    myRoomCode = '';
  }

  function updateRoomCodeUI(code) {
    const normalized = String(code || '').toUpperCase().trim();
    const roomCodeEl = $('mp-room-code-display');
    const roomInputEl = $('mp-room-input');

    if (roomInputEl && normalized) {
      roomInputEl.value = normalized;
    }

    if (roomCodeEl && normalized) {
      roomCodeEl.textContent = 'Room Code: ' + normalized;
      roomCodeEl.style.display = 'inline-block';
      return;
    }

    if (roomCodeEl) {
      roomCodeEl.style.display = 'none';
    }
  }

  // ── Server calls ──────────────────────────────────────────────────────────
  function createRoom(playerName) {
    myPlayerName = playerName.trim() || 'Player';
    socket.emit('room:create', { playerName: myPlayerName }, (res) => {
      if (!res.ok) { showStatus(res.error, true); return; }
      myPlayerId = res.playerId;
      myRoomCode = res.roomCode;
      updateRoomCodeUI(myRoomCode);
      showStatus('Room created: ' + myRoomCode + '. Share this code to join.');
      saveSession();
    });
  }

  function joinRoom(roomCode, playerName, existingPlayerId) {
    myPlayerName = (playerName || myPlayerName || 'Player').trim();
    socket.emit('room:join', {
      roomCode: roomCode.toUpperCase().trim(),
      playerName: myPlayerName,
      playerId: existingPlayerId || undefined,
    }, (res) => {
      if (!res.ok) { showStatus(res.error, true); return; }
      myPlayerId = res.playerId;
      myRoomCode = res.roomCode;
      updateRoomCodeUI(myRoomCode);
      saveSession();
    });
  }

  function startGame() {
    socket.emit('game:start', { roomCode: myRoomCode, playerId: myPlayerId }, (res) => {
      if (res && !res.ok) showStatus(res.error, true);
    });
  }

  function sendAction(action) {
    socket.emit('game:action', { roomCode: myRoomCode, playerId: myPlayerId, action }, (res) => {
      if (res && !res.ok) showStatus(res.error, true);
    });
  }

  // ── Game actions ──────────────────────────────────────────────────────────
  function drawFromDeck() { sendAction({ type: 'drawDeck' }); }
  function drawFromDiscard() { sendAction({ type: 'drawDiscard' }); }

  function declareMeld() {
    if (selectedHandIndices.length < 3) {
      showStatus('Select at least 3 cards to meld', true);
      return;
    }
    sendAction({ type: 'declareMeld', payload: { handIndices: [...selectedHandIndices] } });
    selectedHandIndices = [];
  }

  function undoMelds() {
    selectedHandIndices = [];
    sendAction({ type: 'undoMelds' });
  }

  function discardCard(cardIndex) {
    selectedHandIndices = [];
    sendAction({ type: 'discardCard', payload: { cardIndex } });
  }

  function nextRound() {
    socket.emit('game:nextRound', { roomCode: myRoomCode, playerId: myPlayerId }, (res) => {
      if (res && !res.ok) showStatus(res.error, true);
    });
  }

  function toggleCardSelection(index) {
    const pos = selectedHandIndices.indexOf(index);
    if (pos === -1) {
      selectedHandIndices.push(index);
    } else {
      selectedHandIndices.splice(pos, 1);
    }
    renderMyHand(latestState && latestState.game);
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  function render(state) {
    if (!state) return;
    // Server sends phase inside state.gameState; handle both layouts for safety
    const phase = (state.gameState && state.gameState.phase) || state.phase || 'lobby';

    if (phase === 'lobby') {
      renderLobby(state);
    } else {
      hide('mp-lobby');
      show('mp-game');
      renderGame(state);
    }
  }

  function renderLobby(state) {
    show('mp-lobby');
    hide('mp-game');

    // Show room code prominently
    const roomCode = myRoomCode || state.code || '';
    updateRoomCodeUI(roomCode);

    // Player list
    const playerListEl = $('mp-player-list');
    if (playerListEl && state.players) {
      playerListEl.innerHTML = state.players.map((p) =>
        `<li>${p.name}${p.isHost ? ' 👑' : ''}${!p.connected ? ' (offline)' : ''}</li>`
      ).join('');
    }

    // Show Start button only for host (≥2 players)
    const startBtn = $('mp-start-btn');
    if (startBtn) {
      const amHost = state.players && state.players[0] && state.players[0].id === myPlayerId;
      startBtn.style.display = (amHost && state.players.length >= 2) ? '' : 'none';
    }
  }

  function renderGame(state) {
    if (!state.game) {
      // Still waiting for initial game payload — nothing to render
      setText('mp-round', 'Game starting…');
      setText('mp-wild', '—');
      setText('mp-deck-count', '—');
      setText('mp-current-player', 'Waiting…');
      return;
    }
    const g = state.game;

    // Header info
    setText('mp-round', 'Round ' + g.roundNumber + ' of 9');
    setText('mp-wild', 'Wild: ' + g.wildRank + 's & Jokers');
    setText('mp-current-player', g.isMyTurn ? '🟢 Your turn' : 'Waiting for ' + g.currentPlayerName + '…');
    setText('mp-deck-count', 'Deck: ' + g.deckSize);

    // Discard pile top card
    const discardEl = $('mp-discard-card');
    if (discardEl) discardEl.innerHTML = cardFaceHTML(g.discardTop);

    // My hand
    renderMyHand(g);

    // My melds
    renderMyMelds(g);

    // Opponents
    renderOpponents(g);

    // Action buttons
    renderActionButtons(g);

    // Round-over overlay
    if (g.phase === 'roundOver' || g.phase === 'gameOver') {
      renderRoundOver(g, state);
    } else {
      hide('mp-round-over');
    }
  }

  function renderMyHand(g) {
    const handEl = $('mp-my-hand');
    if (!handEl || !g) return;

    const isMyTurn = g.isMyTurn;
    const canDiscard = isMyTurn && g.myTurnPhase === 'meld-discard';

    handEl.innerHTML = (g.myHand || []).map((card, i) => {
      const sel = selectedHandIndices.includes(i);
      return cardHTML(card, i, sel, canDiscard && !sel);
    }).join('');

    // Attach click handlers
    handEl.querySelectorAll('.mp-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (canDiscard && selectedHandIndices.length === 0) {
          // No cards selected → clicking discards the card directly
          discardCard(idx);
        } else {
          // Otherwise toggle selection for melding
          toggleCardSelection(idx);
        }
      });
    });
  }

  function renderMyMelds(g) {
    const meldsEl = $('mp-my-melds');
    if (!meldsEl) return;
    const sets = (g && g.myMelds) || [];
    if (sets.length === 0) { meldsEl.innerHTML = '<em>No melds yet</em>'; return; }
    meldsEl.innerHTML = sets.map((set, i) =>
      `<div class="mp-meld-set">Meld ${i + 1}: ${set.map((c) => cardFaceHTML(c)).join(' ')}</div>`
    ).join('');
  }

  function renderOpponents(g) {
    const oppEl = $('mp-opponents');
    if (!oppEl) return;
    const opps = (g && g.opponents) || [];
    oppEl.innerHTML = opps.map((opp) => {
      const turnMark = opp.isCurrentTurn ? ' 🔵' : '';
      const outMark = opp.isOut ? ' ✅ WENT OUT' : '';
      const melds = (opp.meldSets || []).map((set, i) =>
        `<div class="opp-meld">M${i + 1}: ${set.map((c) => cardFaceHTML(c)).join(' ')}</div>`
      ).join('');
      return `<div class="mp-opponent">
        <strong>${opp.name}${turnMark}${outMark}</strong>
        <span> | ${opp.handSize} cards | Round: ${opp.roundScore ?? 0} | Total: ${opp.gameScore ?? 0}</span>
        ${melds}
      </div>`;
    }).join('');
  }

  // Highlight pile divs (cursor + glow) so the player knows they're clickable
  function setPileClickable(id, active) {
    const el = $(id);
    if (!el) return;
    if (active) el.classList.add('pile-clickable');
    else        el.classList.remove('pile-clickable');
  }

  function renderActionButtons(g) {
    const isMyTurn = g && g.isMyTurn;
    const phase = g && g.myTurnPhase;

    // Pile areas glow when it's your draw turn
    setPileClickable('mp-deck-pile',   isMyTurn && phase === 'draw');
    setPileClickable('mp-discard-card', isMyTurn && phase === 'draw' && g.discardSize > 0);

    // Meld / undo buttons
    setVisible('mp-btn-meld',       isMyTurn && phase === 'meld-discard');
    setVisible('mp-btn-undo-melds', isMyTurn && phase === 'meld-discard' && g.myMelds && g.myMelds.length > 0);

    const meldHint = $('mp-meld-hint');
    if (meldHint) {
      meldHint.textContent = selectedHandIndices.length > 0
        ? `${selectedHandIndices.length} card(s) selected — click Declare Meld, or click a card to discard`
        : 'Click a card to discard it, or select 3+ cards then click Declare Meld';
      meldHint.style.display = (isMyTurn && phase === 'meld-discard') ? '' : 'none';
    }
  }

  function setVisible(id, visible) {
    const el = $(id);
    if (el) el.style.display = visible ? '' : 'none';
  }

  function renderRoundOver(g, state) {
    show('mp-round-over');
    const scores = g.scoreboardData || [];
    const latest = scores[scores.length - 1];
    if (!latest) return;

    const amHost = state.players && state.players[0] && state.players[0].id === myPlayerId;
    let html = `<h3>${g.phase === 'gameOver' ? '🏆 Game Over!' : 'Round ' + latest.round + ' Over'}</h3><table class="score-table"><tr><th>Player</th><th>Round</th><th>Total</th></tr>`;
    latest.players.forEach((p) => {
      const name = state.players.find((sp) => sp.id === p.id)?.name || p.id;
      html += `<tr><td>${name}${p.wentOut ? ' ✅' : ''}</td><td>${p.roundScore}</td><td>${p.gameScore}</td></tr>`;
    });
    html += '</table>';

    if (g.phase === 'gameOver') {
      const winner = [...latest.players].sort((a, b) => a.gameScore - b.gameScore)[0];
      const winnerName = state.players.find((sp) => sp.id === winner.id)?.name || winner.id;
      html += `<p>🥇 Winner: <strong>${winnerName}</strong> with ${winner.gameScore} points!</p>`;
    } else if (amHost) {
      html += `<button id="mp-btn-next-round-overlay" class="mp-btn primary">Start Next Round</button>`;
    } else {
      html += `<p>Waiting for host to start next round…</p>`;
    }

    setHTML('mp-round-over', html);

    const btn = $('mp-btn-next-round-overlay');
    if (btn) btn.addEventListener('click', nextRound);
  }

  // ── UI event wiring ───────────────────────────────────────────────────────
  function wireButtons() {
    // Lobby
    const createBtn = $('mp-create-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        const name = $('mp-name-input') && $('mp-name-input').value;
        if (!name || !name.trim()) { showStatus('Enter your name first', true); return; }
        connect();
        // Give socket a moment to connect before emitting
        setTimeout(() => createRoom(name), 200);
      });
    }

    const joinBtn = $('mp-join-btn');
    if (joinBtn) {
      joinBtn.addEventListener('click', () => {
        const name = $('mp-name-input') && $('mp-name-input').value;
        const code = $('mp-room-input') && $('mp-room-input').value;
        if (!name || !name.trim()) { showStatus('Enter your name first', true); return; }
        if (!code || !code.trim()) { showStatus('Enter a room code', true); return; }
        connect();
        setTimeout(() => joinRoom(code, name), 200);
      });
    }

    const startBtn = $('mp-start-btn');
    if (startBtn) startBtn.addEventListener('click', startGame);

    // ── Pile-click: draw from deck ───────────────────────────────────────────
    // Clicking the deck pile draws a card — but only during your draw phase.
    // Visual cue (pile-clickable class) is set in renderActionButtons.
    const deckPileEl = $('mp-deck-pile');
    if (deckPileEl) {
      deckPileEl.addEventListener('click', () => {
        const g = latestState && latestState.game;
        if (g && g.isMyTurn && g.myTurnPhase === 'draw') drawFromDeck();
      });
    }

    // ── Pile-click: take discard ─────────────────────────────────────────────
    const discardPileEl = $('mp-discard-card');
    if (discardPileEl) {
      discardPileEl.addEventListener('click', () => {
        const g = latestState && latestState.game;
        if (g && g.isMyTurn && g.myTurnPhase === 'draw' && g.discardSize > 0) drawFromDiscard();
      });
    }

    const meldBtn = $('mp-btn-meld');
    if (meldBtn) meldBtn.addEventListener('click', declareMeld);

    const undoBtn = $('mp-btn-undo-melds');
    if (undoBtn) undoBtn.addEventListener('click', undoMelds);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    wireButtons();

    // Auto-connect if session data exists
    const saved = loadSession();
    if (saved && saved.playerId) {
      myPlayerName = saved.playerName || '';
      if ($('mp-name-input')) $('mp-name-input').value = myPlayerName;
      connect();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose minimal API for debugging
  window.MP = { createRoom, joinRoom, startGame, sendAction, drawFromDeck, drawFromDiscard, declareMeld, undoMelds, discardCard, nextRound };
})();
