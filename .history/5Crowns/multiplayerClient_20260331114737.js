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
  let lobbyResyncTimer = null;
  let meldModeActive = false;   // true = selecting cards for melds; false = next card click discards
  let _prevWasMeldPhase = false; // detect when meld phase starts to auto-activate meld mode
  let _announcedOutPlayerIds = new Set();
  let _lastRoundForOutAnnouncements = null;
  let audioCtx = null;
  let soundEnabled = true;

  // Compatibility shim: older builds may still call window.mgt.clearMarks().
  // Keep it as a no-op helper so stale references do not break current sessions.
  function ensureLegacyMgtCompatibility() {
    if (typeof window === 'undefined') return;
    if (!window.mgt || typeof window.mgt !== 'object') {
      window.mgt = {};
    }
    if (typeof window.mgt.clearMarks !== 'function') {
      window.mgt.clearMarks = function clearMarksFallback() {
        // Clear commonly used selection classes if present.
        const nodes = document.querySelectorAll('.selected, .marked, .mark');
        nodes.forEach((node) => {
          node.classList.remove('selected', 'marked', 'mark');
        });
      };
    }
  }

  // ── DOM helpers ──────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  function show(id) { const el = $(id); if (el) el.style.display = 'block'; }
  function hide(id) { const el = $(id); if (el) el.style.display = 'none'; }
  function setText(id, txt) { const el = $(id); if (el) el.textContent = txt; }
  function setHTML(id, html) { const el = $(id); if (el) el.innerHTML = html; }

  let _statusTimer = null;
  function showStatus(msg, isError, autoClear) {
    const el = $('mp-status');
    if (!el) return;
    const roomSuffix = myRoomCode ? (' | Room: ' + myRoomCode) : '';
    el.textContent = String(msg || '') + roomSuffix;
    el.className = isError ? 'mp-status error' : 'mp-status';
    if (_statusTimer) { clearTimeout(_statusTimer); _statusTimer = null; }
    if (autoClear) {
      _statusTimer = setTimeout(() => {
        // Restore normal status text after brief warning
        const g = latestState && latestState.game;
        const currentName = g && g.currentPlayerName;
        const waiting = currentName ? ('Waiting for ' + currentName + '…') : '';
        const suffix = myRoomCode ? (' | Room: ' + myRoomCode) : '';
        el.textContent = waiting + suffix;
        el.className = 'mp-status';
        _statusTimer = null;
      }, 3000);
    }
  }

  function initAudio() {
    if (!soundEnabled) return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playTone(freq, ms, when) {
    const ctx = initAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.08, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + (ms / 1000));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(when);
    osc.stop(when + (ms / 1000) + 0.02);
  }

  function playAlert(type) {
    const ctx = initAudio();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    if (type === 'wentOut') {
      playTone(784, 120, t);
      playTone(988, 220, t + 0.14);
    }
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
    socket.on('session:replaced', () => {
      const previousName = myPlayerName;
      clearSession();
      resetToLobby('This player was opened on another page. This page has been signed out.', previousName);
    });

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

  function resetToLobby(message, keepName) {
    const preservedName = keepName || '';
    latestState = null;
    selectedHandIndices = [];
    meldModeActive = false;
    _prevWasMeldPhase = false;
    _announcedOutPlayerIds = new Set();
    _lastRoundForOutAnnouncements = null;

    hide('mp-game');
    show('mp-lobby');
    hide('mp-round-over');
    setHTML('mp-player-list', '<li><em>No one yet</em></li>');
    updateRoomCodeUI('');

    if ($('mp-name-input')) $('mp-name-input').value = preservedName;
    if ($('mp-room-input')) $('mp-room-input').value = '';

    if (message) {
      showStatus(message, true);
    }
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
      if (res.state) {
        latestState = res.state;
        render(res.state);
      }
      saveSession();
    });
  }

  function joinRoom(roomCode, playerName, existingPlayerId, options) {
    const opts = options || {};
    const silent = Boolean(opts.silent);
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
      if (!silent) {
        showStatus('Joined room: ' + myRoomCode + '. Waiting for host to start.');
      }
      if (res.state) {
        latestState = res.state;
        render(res.state);
      }
      saveSession();
    });
  }

  function startGame() {
    socket.emit('game:start', { roomCode: myRoomCode, playerId: myPlayerId }, (res) => {
      if (res && !res.ok) showStatus(res.error, true);
      if (res && res.ok && res.state) {
        latestState = res.state;
        render(res.state);
      }
    });
  }

  function sendAction(action) {
    socket.emit('game:action', { roomCode: myRoomCode, playerId: myPlayerId, action }, (res) => {
      if (res && !res.ok) showStatus(res.error, true);
      if (res && res.ok && res.state) {
        latestState = res.state;
        render(res.state);
      }
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
      if (res && res.ok && res.state) {
        latestState = res.state;
        render(res.state);
      }
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
    setText('mp-wild-reminder', 'Reminder: wild this round is ' + g.wildRank + ' and jokers.');
    setText('mp-current-player', g.isMyTurn ? '🟢 Your turn' : 'Waiting for ' + g.currentPlayerName + '…');
    setText('mp-deck-count', 'Deck: ' + g.deckSize);

    updateFinalTurnNotice(state);
    announceWentOutIfNeeded(state);

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

    // Attach click handlers.
    // Meld mode ON  → clicks toggle card selection for melding.
    // Meld mode OFF → click discards the card immediately (ends turn).
    handEl.querySelectorAll('.mp-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const g2 = latestState && latestState.game;
        if (!g2) return;
        if (!g2.isMyTurn) {
          showStatus('Not your turn — waiting for ' + g2.currentPlayerName + '.', true, true);
          return;
        }
        if (g2.myTurnPhase !== 'meld-discard') {
          showStatus('Draw a card first.', true, true);
          return;
        }
        const idx = parseInt(btn.dataset.index, 10);
        if (meldModeActive) {
          toggleCardSelection(idx);
        } else {
          // Not in meld mode — discard immediately
          selectedHandIndices = [];
          discardCard(idx);
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

  function updateFinalTurnNotice(state) {
    const noteEl = $('mp-final-turn-note');
    if (!noteEl) return;
    if (!state || !state.game || state.game.phase !== 'playing') {
      noteEl.style.display = 'none';
      noteEl.textContent = '';
      return;
    }

    const g = state.game;
    const outPlayerIds = new Set(Array.isArray(g.outPlayerIds) ? g.outPlayerIds : []);

    if (outPlayerIds.size === 0) {
      noteEl.style.display = 'none';
      noteEl.textContent = '';
      return;
    }

    const outNames = Array.from(outPlayerIds).map((id) => {
      if (id === myPlayerId) return 'You';
      const p = (state.players || []).find((x) => x.id === id);
      return (p && p.name) ? p.name : 'A player';
    });

    if (outNames.length === 1) {
      noteEl.textContent = outNames[0] + ' went out. This is the final turn for remaining players.';
    } else {
      noteEl.textContent = outNames.join(', ') + ' went out. This is the final turn for remaining players.';
    }
    noteEl.style.display = 'block';
  }

  function announceWentOutIfNeeded(state) {
    if (!state || !state.game || !Array.isArray(state.players)) return;
    const g = state.game;

    if (_lastRoundForOutAnnouncements !== g.roundNumber) {
      _announcedOutPlayerIds.clear();
      _lastRoundForOutAnnouncements = g.roundNumber;
    }

    const outIds = Array.isArray(g.outPlayerIds) ? g.outPlayerIds : [];

    const justWentOut = outIds.filter((id) => id && !_announcedOutPlayerIds.has(id));
    if (justWentOut.length === 0) return;

    justWentOut.forEach((id) => _announcedOutPlayerIds.add(id));

    const names = justWentOut.map((id) => {
      if (id === myPlayerId) return 'You';
      const p = state.players.find((x) => x.id === id);
      return (p && p.name) ? p.name : 'A player';
    });

    const msg = names.length === 1
      ? `${names[0]} went out! Final turns in progress.`
      : `${names.join(', ')} went out! Final turns in progress.`;
    showStatus(msg, false, true);
    playAlert('wentOut');
  }

  function serializeCard(card) {
    if (!card || typeof card !== 'object') return card;
    return {
      rank: card.rank,
      suit: card.suit,
      value: card.value,
    };
  }

  function syncScoreboardStorage(state) {
    if (!state || !state.game || !Array.isArray(state.game.scoreboardData)) return;
    const rounds = state.game.scoreboardData.map((roundObj) => {
      const roundNo = Number(roundObj.round) || 1;
      const players = (roundObj.players || []).map((p) => {
        const mapped = (state.players || []).find((sp) => sp.id === p.id);
        const name = (mapped && mapped.name) ? mapped.name : p.id;
        const hand = Array.isArray(p.hand) ? p.hand : [];
        const meldSets = Array.isArray(p.meldSets) ? p.meldSets : [];
        const meldCardCount = meldSets.reduce((sum, set) => sum + (Array.isArray(set) ? set.length : 0), 0);
        return {
          name,
          IsOut: Boolean(p.wentOut),
          cards: hand.length + meldCardCount,
          wentOutScore: 0,
          wentOutBonus: Boolean(p.wentOut) ? -(roundNo + 2) : 0,
          roundScore: Number(p.roundScore) || 0,
          gameScore: Number(p.gameScore) || 0,
          hand: hand.map((card) => serializeCard(card)),
          handCount: hand.length,
          meldSets: meldSets.map((set) => (Array.isArray(set) ? set.map((card) => serializeCard(card)) : [])),
          meldCardCount,
          melds: meldSets.length,
        };
      });
      return {
        round: roundNo,
        optGoingOutBonus: true,
        players,
      };
    });

    try {
      if (myRoomCode) {
        localStorage.setItem('CurrentGameId', myRoomCode);
        localStorage.setItem('scoreboard_data_' + myRoomCode, JSON.stringify(rounds));
      }
      localStorage.setItem('scoreboard_data', JSON.stringify(rounds));
    } catch (_) {
      // Ignore localStorage quota/permission errors.
    }
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

    const isMeldPhase = isMyTurn && phase === 'meld-discard';

    // Auto-activate meld mode when the meld phase begins (new turn)
    if (isMeldPhase && !_prevWasMeldPhase) {
      meldModeActive = true;
      selectedHandIndices = [];
    }
    if (!isMeldPhase) {
      meldModeActive = false;
      selectedHandIndices = [];
    }
    _prevWasMeldPhase = isMeldPhase;

    setVisible('mp-btn-meld',       isMeldPhase);
    setVisible('mp-btn-undo-melds', isMeldPhase && g.myMelds && g.myMelds.length > 0);

    // Style Meld button: blue = meld mode active, grey = exited (ready to discard)
    const meldBtn = $('mp-btn-meld');
    if (meldBtn) {
      if (!isMeldPhase) {
        meldBtn.textContent = 'Meld';
        meldBtn.className = 'mp-btn secondary';
      } else if (meldModeActive) {
        meldBtn.textContent = selectedHandIndices.length >= 3 ? 'Declare Meld (' + selectedHandIndices.length + ')' : 'Meld';
        meldBtn.className = 'mp-btn primary';   // blue = meld mode on
      } else {
        meldBtn.textContent = 'Meld';
        meldBtn.className = 'mp-btn secondary'; // grey = meld mode off, click to re-enter
      }
    }

    const meldHint = $('mp-meld-hint');
    if (meldHint) {
      if (!isMeldPhase) {
        meldHint.style.display = 'none';
      } else if (meldModeActive) {
        if (selectedHandIndices.length === 0) {
          meldHint.textContent = 'Meld mode on — select 3+ cards and click Meld to declare a meld. Click Meld with nothing selected when done.';
        } else if (selectedHandIndices.length < 3) {
          meldHint.textContent = `${selectedHandIndices.length} card(s) selected — need ${3 - selectedHandIndices.length} more to meld.`;
        } else {
          meldHint.textContent = `${selectedHandIndices.length} cards selected — click Meld to declare.`;
        }
        meldHint.style.display = '';
      } else {
        meldHint.textContent = 'Click a card to discard it and end your turn. Click Meld to go back to meld mode.';
        meldHint.style.display = '';
      }
    }
  }

  function setVisible(id, visible) {
    const el = $(id);
    if (el) el.style.display = visible ? '' : 'none';
  }

  function renderRoundOver(g, state) {
    show('mp-round-over');
    syncScoreboardStorage(state);

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
    html += `<div style="margin-top:10px"><button id="mp-btn-open-scoreboard" class="mp-btn secondary">Open Full Scoreboard</button></div>`;

    setHTML('mp-round-over', html);

    const btn = $('mp-btn-next-round-overlay');
    if (btn) btn.addEventListener('click', nextRound);

    const sbBtn = $('mp-btn-open-scoreboard');
    if (sbBtn) sbBtn.addEventListener('click', () => window.open('ScoreBoard.html', '_blank'));
  }

  // ── UI event wiring ───────────────────────────────────────────────────────
  function wireButtons() {
    // Browsers require a user interaction before audio can play.
    document.addEventListener('pointerdown', () => initAudio(), { once: true });

    // Lobby
    const createBtn = $('mp-create-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        const name = $('mp-name-input') && $('mp-name-input').value;
        const roomCode = (($('mp-room-input') && $('mp-room-input').value) || '').trim();
        if (!name || !name.trim()) { showStatus('Enter your name first', true); return; }
        if (roomCode) {
          showStatus('Room Code is filled. Click Join Room, or clear Room Code to create a new room.', true);
          return;
        }
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
        if (!g) return;
        if (!g.isMyTurn) {
          showStatus('Not your turn — waiting for ' + g.currentPlayerName + '.', true, true);
        } else if (g.myTurnPhase !== 'draw') {
          showStatus('You already drew — select a card to discard or declare a meld.', true, true);
        } else {
          drawFromDeck();
        }
      });
    }

    // ── Pile-click: take discard ─────────────────────────────────────────────
    const discardPileEl = $('mp-discard-card');
    if (discardPileEl) {
      discardPileEl.addEventListener('click', () => {
        const g = latestState && latestState.game;
        if (!g) return;
        if (!g.isMyTurn) {
          showStatus('Not your turn — waiting for ' + g.currentPlayerName + '.', true, true);
        } else if (g.myTurnPhase !== 'draw') {
          showStatus('You already drew — select a card to discard or declare a meld.', true, true);
        } else if (g.discardSize === 0) {
          showStatus('Discard pile is empty.', true, true);
        } else {
          drawFromDiscard();
        }
      });
    }

    const meldBtn = $('mp-btn-meld');
    if (meldBtn) {
      meldBtn.addEventListener('click', () => {
        const g2 = latestState && latestState.game;
        if (!g2 || !g2.isMyTurn || g2.myTurnPhase !== 'meld-discard') return;
        if (meldModeActive && selectedHandIndices.length >= 3) {
          // Declare the meld; stay in meld mode for more melds
          declareMeld();
        } else if (meldModeActive && selectedHandIndices.length === 0) {
          // Done melding — exit meld mode; card clicks will now discard
          meldModeActive = false;
          selectedHandIndices = [];
          renderMyHand(g2);
          renderActionButtons(g2);
        } else if (meldModeActive) {
          showStatus('Select at least 3 cards to declare a meld, or click Meld with nothing selected to finish melding.', true, true);
        } else {
          // Re-enter meld mode
          meldModeActive = true;
          renderMyHand(g2);
          renderActionButtons(g2);
        }
      });
    }

    const undoBtn = $('mp-btn-undo-melds');
    if (undoBtn) undoBtn.addEventListener('click', undoMelds);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    ensureLegacyMgtCompatibility();
    wireButtons();

    // Auto-connect if session data exists
    const saved = loadSession();
    if (saved && saved.playerId) {
      myPlayerName = saved.playerName || '';
      if ($('mp-name-input')) $('mp-name-input').value = myPlayerName;
      connect();
    }

    // If a room update is missed (mobile reconnect/background), silently resync
    // lobby state so players reliably transition when host starts.
    lobbyResyncTimer = setInterval(() => {
      if (!socket || !socket.connected) return;
      if (!myRoomCode || !myPlayerId) return;
      const phase = latestState && latestState.gameState && latestState.gameState.phase;
      const topPhase = latestState && latestState.phase;
      const currentPhase = phase || topPhase || 'lobby';
      if (currentPhase === 'lobby') {
        joinRoom(myRoomCode, myPlayerName, myPlayerId, { silent: true });
      }
    }, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose minimal API for debugging
  window.MP = { createRoom, joinRoom, startGame, sendAction, drawFromDeck, drawFromDiscard, declareMeld, undoMelds, discardCard, nextRound };
})();
