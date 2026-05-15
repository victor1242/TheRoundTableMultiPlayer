/**
 * multiplayerClient.js
 * Client-side Socket.io wrapper for The Round Table multiplayer.
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
  let lastStateReceivedAt = 0;
  let lastLobbyResyncAt = 0;
  let joinInFlight = false;
  let selectedHandIndices = []; // cards selected for a meld
  let lobbyResyncTimer = null;
  let meldModeActive = false;   // true = selecting cards for melds; false = next card click discards
  let _prevWasMeldPhase = false; // detect when meld phase starts to auto-activate meld mode
  let _announcedOutPlayerIds = new Set();
  let _lastRoundForOutAnnouncements = null;
  let audioCtx = null;
  let soundEnabled = true;
  let cardAssetsLoadStarted = false;
  let cardAssetsReady = false;
  let suppressSocketEvents = false;
  const DEBUG_MP = false;

  const CARD_IMAGE_BASE = '../cards/';
  const CARD_IMAGE_SUITS = ['clubs', 'diamonds', 'hearts', 'spades', 'stars'];
  const CARD_IMAGE_RANK_FILES = ['3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'];
  const CARD_ASSET_CACHE_KEY = 'mp_card_assets_cache_marker';
  const CARD_ASSET_VERSION = 'v1';
  const RESUME_TOKEN_KEY = 'mp_resume_token';
  const OPPONENT_MELDS_VISIBLE_KEY = 'mp_show_opponent_melds';
  let showOpponentMelds = false;

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

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function updateAssetStatus(message, isError) {
    const el = $('mp-asset-status');
    if (!el) return;
    if (!message) {
      el.style.display = 'none';
      el.textContent = '';
      el.className = 'mp-asset-status';
      return;
    }
    el.style.display = 'block';
    el.textContent = message;
    el.className = isError ? 'mp-asset-status error' : 'mp-asset-status';
  }

  function normalizeSuitForImage(suit) {
    const normalized = String(suit || '').toLowerCase().trim();
    if (CARD_IMAGE_SUITS.includes(normalized)) return normalized;
    return null;
  }

  function normalizeRankForImage(rank) {
    const normalized = String(rank || '').toLowerCase().trim();
    if (/^10$/.test(normalized)) return '10';
    if (/^9$/.test(normalized)) return '9';
    if (/^8$/.test(normalized)) return '8';
    if (/^7$/.test(normalized)) return '7';
    if (/^6$/.test(normalized)) return '6';
    if (/^5$/.test(normalized)) return '5';
    if (/^4$/.test(normalized)) return '4';
    if (/^3$/.test(normalized)) return '3';
    if (/^(j|jack)$/.test(normalized)) return 'jack';
    if (/^(q|queen)$/.test(normalized)) return 'queen';
    if (/^(k|king)$/.test(normalized)) return 'king';
    if (/^jester$/.test(normalized)) return 'jester';
    return null;
  }

  function cardImageUrl(card) {
    if (!card || typeof card !== 'object') return '';
    const rank = normalizeRankForImage(card.rank);
    const suit = normalizeSuitForImage(card.suit);
    if (!rank) return '';
    if (rank === 'jester') return CARD_IMAGE_BASE + 'jester_of_stars.png';
    if (!suit) return '';
    return CARD_IMAGE_BASE + rank + '_of_' + suit + '.png';
  }

  function buildCardAssetManifest() {
    const urls = [];
    CARD_IMAGE_RANK_FILES.forEach((rank) => {
      CARD_IMAGE_SUITS.forEach((suit) => {
        urls.push(CARD_IMAGE_BASE + rank + '_of_' + suit + '.png');
      });
    });
    urls.push(CARD_IMAGE_BASE + 'jester_of_stars.png');
    urls.push(CARD_IMAGE_BASE + 'back.png');
    return urls;
  }

  function applyDeckBackImage() {
    const el = $('mp-deck-back');
    if (!el) return;
    el.style.backgroundImage = 'url(' + CARD_IMAGE_BASE + 'back.png)';
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.style.backgroundRepeat = 'no-repeat';
  }

  function readCardCacheMarker() {
    try {
      const raw = localStorage.getItem(CARD_ASSET_CACHE_KEY);
      if (!raw) return null;
      const marker = JSON.parse(raw);
      if (!marker || marker.version !== CARD_ASSET_VERSION) return null;
      return marker;
    } catch {
      return null;
    }
  }

  function writeCardCacheMarker(durationMs, total, failed) {
    try {
      localStorage.setItem(CARD_ASSET_CACHE_KEY, JSON.stringify({
        version: CARD_ASSET_VERSION,
        ts: Date.now(),
        durationMs,
        total,
        failed,
      }));
    } catch {
      // Ignore localStorage errors.
    }
  }

  function markerSummary(marker) {
    if (!marker || !marker.ts) return '';
    const time = new Date(marker.ts).toLocaleString();
    const ms = Number(marker.durationMs) || 0;
    return 'Last cached: ' + time + ' (' + ms + ' ms)';
  }

  function preloadCardAssets() {
    if (cardAssetsLoadStarted) return;
    cardAssetsLoadStarted = true;
    applyDeckBackImage();

    const manifest = buildCardAssetManifest();
    const total = manifest.length;
    const startMs = performance.now();
    const previousMarker = readCardCacheMarker();
    let loaded = 0;
    let failed = 0;

    const previousSummary = markerSummary(previousMarker);
    updateAssetStatus('Loading card images... 0/' + total + (previousSummary ? ' | ' + previousSummary : ''), false);

    Promise.all(manifest.map((url) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        loaded += 1;
        updateAssetStatus('Loading card images... ' + loaded + '/' + total, false);
        resolve();
      };
      img.onerror = () => {
        loaded += 1;
        failed += 1;
        updateAssetStatus('Loading card images... ' + loaded + '/' + total, false);
        resolve();
      };
      img.src = url;
    }))).then(() => {
      cardAssetsReady = failed < total;
      const durationMs = Math.round(performance.now() - startMs);
      writeCardCacheMarker(durationMs, total, failed);
      if (failed === 0) {
        updateAssetStatus('Card images ready in ' + durationMs + ' ms.', false);
      } else if (cardAssetsReady) {
        updateAssetStatus('Card images loaded in ' + durationMs + ' ms with ' + failed + ' missing file(s).', true);
      } else {
        updateAssetStatus('Card images unavailable after ' + durationMs + ' ms. Using text fallback.', true);
      }

      setTimeout(() => {
        updateAssetStatus('', false);
      }, 2200);

      if (latestState && latestState.game) {
        render(latestState);
      }
    });
  }

  function aiBadgeHTML() {
    // Android-like robot icon used to indicate AI takeover for offline players.
    return '<span class="mp-ai-badge" title="AI takeover active" aria-label="AI takeover active">'
      + '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">'
      + '<rect x="6" y="8" width="12" height="10" rx="2" ry="2"></rect>'
      + '<line x1="9" y1="8" x2="7.5" y2="5.5"></line>'
      + '<line x1="15" y1="8" x2="16.5" y2="5.5"></line>'
      + '<circle cx="9.5" cy="12" r="1"></circle>'
      + '<circle cx="14.5" cy="12" r="1"></circle>'
      + '</svg>'
      + '</span>';
  }

  function displayPlayerName(name, connected) {
    // Format player name for display: adds "(Android AI)" suffix when offline.
    if (connected) return String(name || 'Player');
    return String(name || 'Player') + ' (Android AI)';
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  let _chatCollapsed = false;

  function appendChatMessageWithRouting(message) {
    const log = $('mp-chat-log');
    if (!log) return;
    const div = document.createElement('div');
    const fromSelf = message && message.fromPlayerId === myPlayerId;
    const isBroadcast = !message || message.isBroadcast !== false;
    const recipients = Array.isArray(message && message.recipientNames) ? message.recipientNames : [];
    const privateTo = isBroadcast ? '' : (' to ' + (recipients.length ? recipients.join(', ') : 'selected players'));
    div.className = isBroadcast ? 'mp-chat-msg' : 'mp-chat-msg chat-private';
    const time = message && message.ts
      ? new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    const label = fromSelf
      ? ('You' + privateTo)
      : String((message && message.playerName) || 'Player');
    div.innerHTML = `<span class="chat-name">${escapeHTML(label)}</span>: <span class="chat-text">${escapeHTML((message && message.text) || '')}</span>` +
      (time ? ` <span style="color:#666;font-size:.75rem">${time}</span>` : '');
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    // If chat is collapsed, show unread indicator on the toggle button
    if (_chatCollapsed) {
      const btn = $('mp-chat-toggle');
      if (btn && !btn.dataset.unread) {
        btn.dataset.unread = '1';
        btn.textContent = '▼ Show 🔴';
      }
    }
  }

  function appendChatSystem(text) {
    const log = $('mp-chat-log');
    if (!log) return;
    const div = document.createElement('div');
    div.className = 'mp-chat-msg chat-system';
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function sendChat() {
    const input = $('mp-chat-input');
    const broadcastEl = $('mp-chat-broadcast');
    const recipientsEl = $('mp-chat-recipients');
    if (!input) return;
    const text = input.value.trim();
    if (!text || !socket || !myRoomCode || !myPlayerId) return;
    const isBroadcast = !broadcastEl || broadcastEl.checked;
    const recipientIds = (!isBroadcast && recipientsEl)
      ? Array.from(recipientsEl.selectedOptions).map((option) => option.value).filter(Boolean)
      : [];

    if (!isBroadcast && recipientIds.length === 0) {
      showStatus('Select at least one recipient, or check Broadcast to all.', true, true);
      return;
    }

    socket.emit('chat:message', {
      roomCode: myRoomCode,
      playerId: myPlayerId,
      text,
      recipientIds,
    });
    input.value = '';
  }

  function renderChatRecipients(state) {
    const recipientsEl = $('mp-chat-recipients');
    const broadcastEl = $('mp-chat-broadcast');
    if (!recipientsEl) return;

    const selected = new Set(Array.from(recipientsEl.selectedOptions).map((option) => option.value));
    const players = Array.isArray(state && state.players) ? state.players : [];

    // Show ALL players (including offline) so the list is never empty due to transient disconnects.
    // Exclude only the current player themselves. Fall back to name-based exclusion if id is unset.
    const normalizedMyName = String(myPlayerName || '').trim().toLowerCase();
    let choices = players.filter((p) => {
      if (!p) return false;
      if (myPlayerId && p.id === myPlayerId) return false;
      if (!myPlayerId && normalizedMyName && String(p.name || '').trim().toLowerCase() === normalizedMyName) return false;
      return true;
    });

    if (DEBUG_MP) {
      console.log('[chat] renderChatRecipients: myPlayerId=' + myPlayerId +
        ' myPlayerName=' + myPlayerName +
        ' statePlayers=' + JSON.stringify((players).map((p) => ({ id: p && p.id, name: p && p.name }))) +
        ' choices=' + JSON.stringify(choices.map((p) => ({ id: p.id, name: p.name }))));
    }

    if (choices.length === 0) {
      recipientsEl.innerHTML = '<option value="" disabled>(No other players in room)</option>';
    } else {
      recipientsEl.innerHTML = choices
        .map((p) => `<option value="${escapeHTML(p.id)}"${p.connected ? '' : ' class="mp-chat-offline"'}>${escapeHTML(p.name)}${p.connected ? '' : ' (offline)'}</option>`)
        .join('');
    }

    Array.from(recipientsEl.options).forEach((option) => {
      option.selected = selected.has(option.value);
    });

    if (broadcastEl) {
      recipientsEl.disabled = broadcastEl.checked;
    }
  }

  function showChatPanel() {
    const panel = $('mp-chat');
    if (panel) panel.style.display = '';
  }

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
        const offlineNow = currentName && Array.isArray(latestState && latestState.players) &&
          latestState.players.some((p) => p.id === (g && g.currentPlayerId) && !p.connected);
        const waiting = currentName
          ? (offlineNow ? ('🤖 AI playing for ' + currentName + '…') : ('Waiting for ' + currentName + '…'))
          : '';
        const suffix = myRoomCode ? (' | Room: ' + myRoomCode) : '';
        el.textContent = waiting + suffix;
        el.className = 'mp-status';
        _statusTimer = null;
      }, 3000);
    }
  }

  function getLiveStatus(state) {
    if (!state) return { msg: 'Connected to server', isError: false };

    const phase = (state.gameState && state.gameState.phase) || state.phase || 'lobby';
    if (phase === 'lobby') {
      if (myRoomCode) {
        return { msg: 'In lobby. Waiting for host to start.', isError: false };
      }
      return { msg: 'Connected to server', isError: false };
    }

    const g = state.game;
    if (!g) return { msg: 'Game starting…', isError: false };

    if (g.isMyTurn) {
      if (g.myTurnPhase === 'draw') {
        return { msg: 'Your turn: draw a card.', isError: false };
      }
      return { msg: 'Your turn: meld and discard to end turn.', isError: false };
    }

    const current = g.currentPlayerName || 'player';
    const currentOffline = Array.isArray(state.players)
      && state.players.some((p) => p.id === g.currentPlayerId && !p.connected);
    return {
      msg: currentOffline ? ('AI playing for ' + current + '…') : ('Waiting for ' + current + '…'),
      isError: false,
    };
  }

  function syncStatusFromState(state) {
    const el = $('mp-status');
    if (!el) return;
    const live = getLiveStatus(state);
    const roomSuffix = myRoomCode ? (' | Room: ' + myRoomCode) : '';
    el.textContent = live.msg + roomSuffix;
    el.className = live.isError ? 'mp-status error' : 'mp-status';
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
      return displayPlayerName((p && p.name) ? p.name : 'A player', p && p.connected);
    });

    if (outNames.length === 1) {
      noteEl.textContent = outNames[0] + ' went out. This is the final turn for remaining players.';
    } else {
      noteEl.textContent = outNames.join(', ') + ' went out. This is the final turn for remaining players.';
    }
    noteEl.style.display = 'block';
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
    const imageUrl = cardImageUrl(card);
    const icon = SUIT_ICONS[card.suit] || card.suit;
    const colour = SUIT_COLOURS[card.suit] || '#000';
    const selectedClass = isSelected ? ' selected' : '';
    const title = escapeHTML(card.rank + ' of ' + card.suit);
    const image = imageUrl && cardAssetsReady
      ? `<img class="mp-card-media" src="${imageUrl}" alt="${title}" loading="eager" decoding="async" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
      : '';
    const fallbackDisplay = (imageUrl && cardAssetsReady) ? 'none' : 'flex';
    return `<button class="mp-card${selectedClass}${discardable(isDiscardable)}"
              data-index="${index}"
              style="color:${colour}"
              title="${title}">
              ${image}
              <span class="mp-card-fallback" style="display:${fallbackDisplay}">
                <span class="card-rank">${card.rank}</span>
                <span class="card-suit">${icon}</span>
              </span>
            </button>`;
  }

  function discardable(flag) { return flag ? ' discardable' : ''; }

  function cardFaceHTML(card) {
    if (!card) return '<span class="mp-card empty">—</span>';
    const imageUrl = cardImageUrl(card);
    const icon = SUIT_ICONS[card.suit] || card.suit;
    const colour = SUIT_COLOURS[card.suit] || '#000';
    const title = escapeHTML(card.rank + ' of ' + card.suit);
    const image = imageUrl && cardAssetsReady
      ? `<img class="mp-card-media" src="${imageUrl}" alt="${title}" loading="lazy" decoding="async" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
      : '';
    const fallbackDisplay = (imageUrl && cardAssetsReady) ? 'none' : 'flex';
    return `<span class="mp-card face" style="color:${colour}">
      ${image}
      <span class="mp-card-fallback" style="display:${fallbackDisplay}">${card.rank} ${icon}</span>
    </span>`;
  }

  // ── Connect ───────────────────────────────────────────────────────────────
  function connect() {
    if (socket && socket.connected) return;
    suppressSocketEvents = false;
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
        joinRoom(saved.roomCode, saved.playerName, saved.playerId, { silent: true });
      }
    });

    socket.on('disconnect', () => {
      if (suppressSocketEvents) return;
      showStatus('Disconnected from server', true);
    });
    socket.on('connect_error', () => showStatus('Cannot reach server', true));
    socket.on('session:replaced', () => {
      if (suppressSocketEvents) return;
      const previousName = myPlayerName;
      clearSession();
      resetToLobby('This player was opened on another page. This page has been signed out.', previousName);
    });

    socket.on('room:state', (state) => {
      if (suppressSocketEvents) return;
      latestState = state;
      lastStateReceivedAt = Date.now();
      saveSession();
      render(state);
    });

    socket.on('chat:message', (message) => {
      if (suppressSocketEvents) return;
      appendChatMessageWithRouting(message);
    });

    socket.on('chat:error', ({ error }) => {
      if (suppressSocketEvents) return;
      showStatus(error || 'Unable to send message', true, true);
    });
  }

  // ── Session persistence (survive page reload) ─────────────────────────────
  function saveSession() {
    if (!myPlayerId) return;
    const sessionData = {
      playerId: myPlayerId,
      playerName: myPlayerName,
      roomCode: myRoomCode,
    };
    // Save to sessionStorage only (tab/reload scope).
    // localStorage is reserved for the explicit Resume Seat flow (saveResumeToken).
    // Sharing a localStorage backup across tabs causes identity collisions when
    // two different players open the page in the same browser profile.
    sessionStorage.setItem('mp_session', JSON.stringify(sessionData));
  }

  function loadSession() {
    try {
      // sessionStorage only — scoped to this tab, cleared on browser close.
      // This prevents two players in the same browser profile from stealing
      // each other's identity on auto-connect.
      const session = JSON.parse(sessionStorage.getItem('mp_session') || 'null');
      if (session && session.playerId) return session;
      return null;
    } catch { return null; }
  }

  function saveResumeToken() {
    if (!myPlayerId || !myRoomCode) return;
    try {
      localStorage.setItem(RESUME_TOKEN_KEY, JSON.stringify({
        playerId: myPlayerId,
        roomCode: myRoomCode,
        playerName: myPlayerName || '',
        ts: Date.now(),
      }));
    } catch {
      // Ignore localStorage errors.
    }
  }

  function loadResumeToken() {
    try {
      const raw = localStorage.getItem(RESUME_TOKEN_KEY);
      if (!raw) return null;
      const token = JSON.parse(raw);
      if (!token || !token.playerId || !token.roomCode) return null;
      return token;
    } catch {
      return null;
    }
  }

  function clearResumeToken() {
    localStorage.removeItem(RESUME_TOKEN_KEY);
  }

  function updateResumeUI() {
    const token = loadResumeToken();
    const resumeBtn = $('mp-resume-btn');
    if (resumeBtn) {
      resumeBtn.style.display = token ? '' : 'none';
    }

    const roomInput = $('mp-room-input');
    if (token && roomInput && !String(roomInput.value || '').trim()) {
      roomInput.value = String(token.roomCode || '').toUpperCase();
    }

    const nameInput = $('mp-name-input');
    if (token && nameInput && !String(nameInput.value || '').trim() && token.playerName) {
      nameInput.value = token.playerName;
    }
  }

  function loadOpponentMeldVisibility() {
    try {
      const raw = localStorage.getItem(OPPONENT_MELDS_VISIBLE_KEY);
      showOpponentMelds = raw === 'true';
    } catch {
      showOpponentMelds = false;
    }

    const toggleEl = $('mp-toggle-opponent-melds');
    if (toggleEl) {
      toggleEl.checked = showOpponentMelds;
    }
  }

  function setOpponentMeldVisibility(visible) {
    showOpponentMelds = Boolean(visible);
    try {
      localStorage.setItem(OPPONENT_MELDS_VISIBLE_KEY, showOpponentMelds ? 'true' : 'false');
    } catch {
      // Ignore localStorage errors.
    }

    const toggleEl = $('mp-toggle-opponent-melds');
    if (toggleEl) {
      toggleEl.checked = showOpponentMelds;
    }

    if (latestState && latestState.game) {
      renderOpponents(latestState.game);
    }
  }

  function clearSession() {
    sessionStorage.removeItem('mp_session');
    myPlayerId = null;
    myPlayerName = '';
    myRoomCode = '';
  }

  function signOut() {
    const previousName = myPlayerName;
    suppressSocketEvents = true;
    saveResumeToken();
    clearSession();
    if (socket && socket.connected) {
      socket.disconnect();
    }
    socket = null;
    resetToLobby('Signed out. AI will take over for this seat until you resume.', previousName);
    updateResumeUI();
  }

  function resumeFromSignOut() {
    const token = loadResumeToken();
    if (!token) {
      showStatus('No paused player seat found. Join with name + room code.', true);
      updateResumeUI();
      return;
    }

    const roomCode = String(token.roomCode || '').trim();
    const playerId = String(token.playerId || '').trim();
    const typedName = String(($('mp-name-input') && $('mp-name-input').value) || '').trim();
    const playerName = typedName || String(token.playerName || '').trim() || 'Player';

    if (!roomCode || !playerId) {
      clearResumeToken();
      updateResumeUI();
      showStatus('Saved resume data was invalid. Join again with room code.', true);
      return;
    }

    if ($('mp-room-input')) $('mp-room-input').value = roomCode.toUpperCase();
    if ($('mp-name-input')) $('mp-name-input').value = playerName;

    connect();
    setTimeout(() => joinRoom(roomCode, playerName, playerId, { resume: true }), 200);
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
      clearResumeToken();
      updateResumeUI();
      showChatPanel();
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
    if (joinInFlight && silent) return;
    const candidateName = String(playerName || '').trim();
    const hasExplicitName = Boolean(candidateName);
    if (hasExplicitName) {
      myPlayerName = candidateName;
    }

    const payload = {
      roomCode: roomCode.toUpperCase().trim(),
      playerId: existingPlayerId || undefined,
    };

    // For manual joins/creates, always provide a name.
    // For playerId reconnects, omit playerName to preserve server-side name.
    if (hasExplicitName) {
      payload.playerName = myPlayerName;
    } else if (!existingPlayerId) {
      payload.playerName = (myPlayerName || 'Player').trim() || 'Player';
    }

    joinInFlight = true;
    socket.emit('room:join', payload, (res) => {
      joinInFlight = false;
      if (!res.ok) { showStatus(res.error, true); return; }
      myPlayerId = res.playerId;
      myRoomCode = res.roomCode;
      lastStateReceivedAt = Date.now();
      updateRoomCodeUI(myRoomCode);
      clearResumeToken();
      updateResumeUI();

      if (res.state && Array.isArray(res.state.players)) {
        const me = res.state.players.find((p) => p.id === myPlayerId);
        if (me && me.name) {
          myPlayerName = me.name;
          const nameInput = $('mp-name-input');
          if (nameInput) nameInput.value = myPlayerName;
        }
      }

      showChatPanel();

      if (opts.resume) {
        showStatus('Resumed room: ' + myRoomCode + '. You are back in control.');
      } else if (!silent) {
        showStatus('Joined room: ' + myRoomCode + '. Waiting for host to start.');
      } else {
        showStatus('Reconnected to room: ' + myRoomCode + '.');
      }
      if (res.state) {
        if (DEBUG_MP && (existingPlayerId || myPlayerId)) {
          const resolvedPhase = (res.state.gameState && res.state.gameState.phase) || res.state.phase || 'lobby';
          console.log('[joinRoom] Reconnected as playerId:', myPlayerId);
          console.log('[joinRoom] Game phase:', resolvedPhase);
          if (res.state.game) {
            console.log('[joinRoom] myHand size:', (res.state.game.myHand || []).length);
            console.log('[joinRoom] isMyTurn:', res.state.game.isMyTurn);
          } else if (resolvedPhase !== 'lobby') {
            console.warn('[joinRoom] Missing game payload outside lobby phase');
          }
        }
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

  function pauseGame(description) {
    socket.emit('game:pause', { roomCode: myRoomCode, playerId: myPlayerId, description: description || '' }, (res) => {
      if (res && !res.ok) showStatus(res.error, true);
      if (res && res.ok && res.state) {
        latestState = res.state;
        render(res.state);
      }
    });
  }

  function showPauseDialog() {
    const dialog = $('mp-pause-dialog');
    const input = $('mp-pause-description-input');
    if (!dialog) return;
    if (input) input.value = '';
    dialog.classList.add('show');
    if (input) setTimeout(() => input.focus(), 50);
  }

  function hidePauseDialog() {
    const dialog = $('mp-pause-dialog');
    if (dialog) dialog.classList.remove('show');
  }

  function resumeGame() {
    socket.emit('game:resume', { roomCode: myRoomCode, playerId: myPlayerId }, (res) => {
      if (res && !res.ok) showStatus(res.error, true);
      if (res && res.ok && res.state) {
        latestState = res.state;
        render(res.state);
      }
    });
  }

  function restartGame() {
    socket.emit('game:restart', { roomCode: myRoomCode, playerId: myPlayerId }, (res) => {
      if (res && !res.ok) showStatus(res.error, true);
      if (res && res.ok && res.state) {
        latestState = res.state;
        render(res.state);
      }
    });
  }

  function sendAction(action) {
    socket.emit('game:action', { roomCode: myRoomCode, playerId: myPlayerId, action }, (res) => {
      if (res && !res.ok) showStatus(res.error, true, true);
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

  function skipOfflineTurn() {
    socket.emit('game:skipTurn', { roomCode: myRoomCode, playerId: myPlayerId }, (res) => {
      if (res && !res.ok) showStatus(res.error, true, true);
      if (res && res.ok && res.state) {
        latestState = res.state;
        render(res.state);
      }
    });
  }

  function nextRound() {
    socket.emit('game:nextRound', { roomCode: myRoomCode, playerId: myPlayerId }, (res) => {
      if (res && !res.ok) showStatus(res.error, true, true);
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
    renderChatRecipients(state);
    // Server sends phase inside state.gameState; handle both layouts for safety
    const phase = (state.gameState && state.gameState.phase) || state.phase || 'lobby';

    if (phase === 'lobby') {
      renderLobby(state);
    } else {
      hide('mp-lobby');
      show('mp-game');
      renderGame(state);
    }

    // Always refresh top status from authoritative state to avoid stale messages.
    syncStatusFromState(state);
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
        `<li>${!p.connected ? aiBadgeHTML() : ''}${displayPlayerName(p.name, p.connected)}${p.isHost ? ' 👑' : ''}</li>`
      ).join('');
    }

    // Show Start button only for host (≥2 players)
    const startBtn = $('mp-start-btn');
    if (startBtn) {
      const me = Array.isArray(state.players)
        ? state.players.find((p) => p.id === myPlayerId)
        : null;
      const amHost = Boolean(me && me.isHost);
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
    const isPaused = g.phase === 'paused';

    // Header info
    setText('mp-round', isPaused ? 'Game Paused' : 'Round ' + g.roundNumber + ' of 9');
    setText('mp-wild', isPaused ? '—' : 'Wild: ' + g.wildRank + 's & Jokers');
    setText('mp-wild-reminder', isPaused ? 'Game is paused. Only the host can resume or start a new game.' : 'Reminder: wild this round is ' + g.wildRank + ' and jokers.');
    const _currPlayerOffline = !g.isMyTurn && Array.isArray(latestState && latestState.players) &&
      latestState.players.some((p) => p.id === g.currentPlayerId && !p.connected);
    setText('mp-current-player', isPaused ? '⏸ Paused' : g.isMyTurn ? '🟢 Your turn' :
      _currPlayerOffline ? ('🤖 ' + displayPlayerName(g.currentPlayerName, false) + ' playing…') :
      ('Waiting for ' + g.currentPlayerName + '…'));
    setText('mp-deck-count', 'Deck: ' + g.deckSize);

    updateFinalTurnNotice(state);
    if (!isPaused) {
      announceWentOutIfNeeded(state);
    }

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

    const pauseBtn = $('mp-btn-pause');
    const resumeBtn = $('mp-btn-resume');
    const newGameBtn = $('mp-btn-new-game');
    const me = Array.isArray(state.players)
      ? state.players.find((p) => p.id === myPlayerId)
      : null;
    const amHost = Boolean(me && me.isHost);

    if (pauseBtn) pauseBtn.style.display = amHost && g.phase === 'playing' ? '' : 'none';
    if (resumeBtn) resumeBtn.style.display = amHost && g.phase === 'paused' ? '' : 'none';
    if (newGameBtn) newGameBtn.style.display = amHost && (g.phase === 'paused' || g.phase === 'gameOver') ? '' : 'none';

    const actionsEl = $('mp-actions');
    if (actionsEl) {
      actionsEl.style.display = isPaused ? 'none' : 'flex';
    }

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
        if (g2.phase === 'paused') {
          showStatus('Game is paused. Wait for host to resume.', true, true);
          return;
        }
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
      const aiMark = !opp.connected ? aiBadgeHTML() : '';
      const displayName = displayPlayerName(opp.name, opp.connected);
      const oppSets = Array.isArray(opp.meldSets) ? opp.meldSets : [];
      const melds = showOpponentMelds
        ? oppSets.map((set, i) =>
          `<div class="opp-meld">M${i + 1}: ${set.map((c) => cardFaceHTML(c)).join(' ')}</div>`
        ).join('')
        : (oppSets.length > 0
          ? `<div class="opp-meld hidden">Melds hidden (${oppSets.length} set${oppSets.length === 1 ? '' : 's'})</div>`
          : '');
      return `<div class="mp-opponent">
        <strong>${aiMark}${displayName}${turnMark}${outMark}</strong>
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
    const isPaused = g && g.phase === 'paused';

    if (isPaused) {
      meldModeActive = false;
      selectedHandIndices = [];
      setVisible('mp-btn-meld', false);
      setVisible('mp-btn-undo-melds', false);
      setVisible('mp-btn-skip-offline', false);
      setPileClickable('mp-deck-pile', false);
      setPileClickable('mp-discard-card', false);
      return;
    }

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

    // Skip button — AI auto-plays offline turns; show only as an emergency fallback
    const currentPlayerInfo = latestState && Array.isArray(latestState.players)
      ? latestState.players.find((p) => p.id === (latestState.game && latestState.game.currentPlayerId))
      : null;
    const currentIsOffline = currentPlayerInfo && !currentPlayerInfo.connected;
    const skipBtn = $('mp-btn-skip-offline');
    if (skipBtn) {
      skipBtn.style.display = currentIsOffline ? '' : 'none';
      skipBtn.textContent = currentIsOffline
        ? ('Emergency: Skip ' + currentPlayerInfo.name + '\'s turn (AI should play automatically)')
        : '';
    }

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

    const me = Array.isArray(state.players)
      ? state.players.find((p) => p.id === myPlayerId)
      : null;
    const amHost = Boolean(me && me.isHost);
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

    const browseSuspendedBtn = $('mp-browse-suspended-btn');
    if (browseSuspendedBtn) {
      browseSuspendedBtn.addEventListener('click', showSuspendedGamesModal);
    }

    const startBtn = $('mp-start-btn');
    if (startBtn) startBtn.addEventListener('click', startGame);

    const pauseBtn = $('mp-btn-pause');
    if (pauseBtn) pauseBtn.addEventListener('click', showPauseDialog);

    // Pause dialog confirm/cancel
    const pauseConfirmBtn = $('mp-pause-confirm-btn');
    if (pauseConfirmBtn) {
      pauseConfirmBtn.addEventListener('click', () => {
        const description = ($('mp-pause-description-input') || {}).value || '';
        hidePauseDialog();
        pauseGame(description.trim());
      });
    }
    const pauseCancelBtn = $('mp-pause-cancel-btn');
    if (pauseCancelBtn) pauseCancelBtn.addEventListener('click', hidePauseDialog);

    // Close pause dialog on Enter key in description input
    const pauseDescInput = $('mp-pause-description-input');
    if (pauseDescInput) {
      pauseDescInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const description = pauseDescInput.value || '';
          hidePauseDialog();
          pauseGame(description.trim());
        } else if (e.key === 'Escape') {
          hidePauseDialog();
        }
      });
    }

    const resumeBtn = $('mp-btn-resume');
    if (resumeBtn) resumeBtn.addEventListener('click', resumeGame);

    const newGameBtn = $('mp-btn-new-game');
    if (newGameBtn) newGameBtn.addEventListener('click', restartGame);

    const signoutBtn = $('mp-signout-btn');
    if (signoutBtn) signoutBtn.addEventListener('click', signOut);

    const signoutBtnGame = $('mp-signout-btn-game');
    if (signoutBtnGame) signoutBtnGame.addEventListener('click', signOut);

    const resumeSeatBtn = $('mp-resume-btn');
    if (resumeSeatBtn) resumeSeatBtn.addEventListener('click', resumeFromSignOut);

    // ── Pile-click: draw from deck ───────────────────────────────────────────
    // Clicking the deck pile draws a card — but only during your draw phase.
    // Visual cue (pile-clickable class) is set in renderActionButtons.
    const deckPileEl = $('mp-deck-pile');
    if (deckPileEl) {
      deckPileEl.addEventListener('click', () => {
        const g = latestState && latestState.game;
        if (!g) return;
        if (g.phase === 'paused') {
          showStatus('Game is paused. Wait for host to resume.', true, true);
          return;
        }
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
        if (g.phase === 'paused') {
          showStatus('Game is paused. Wait for host to resume.', true, true);
          return;
        }
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
        if (g2.phase === 'paused') {
          showStatus('Game is paused. Wait for host to resume.', true, true);
          return;
        }
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

    const skipOfflineBtn = $('mp-btn-skip-offline');
    if (skipOfflineBtn) skipOfflineBtn.addEventListener('click', skipOfflineTurn);

    const oppMeldToggle = $('mp-toggle-opponent-melds');
    if (oppMeldToggle) {
      oppMeldToggle.addEventListener('change', () => {
        setOpponentMeldVisibility(oppMeldToggle.checked);
      });
    }

    // Suspended games modal buttons
    const suspendedCloseBtn = $('mp-suspended-close-btn');
    if (suspendedCloseBtn) {
      suspendedCloseBtn.addEventListener('click', hideSuspendedGamesModal);
    }

    // Close modals when clicking on their backdrop
    const suspendedModal = $('mp-suspended-games-modal');
    if (suspendedModal) {
      suspendedModal.addEventListener('click', (e) => {
        if (e.target === suspendedModal) hideSuspendedGamesModal();
      });
    }

    const pauseDialog = $('mp-pause-dialog');
    if (pauseDialog) {
      pauseDialog.addEventListener('click', (e) => {
        if (e.target === pauseDialog) hidePauseDialog();
      });
    }

    // ── Chat ────────────────────────────────────────────────────────────────
    const chatSendBtn = $('mp-chat-send');
    if (chatSendBtn) chatSendBtn.addEventListener('click', sendChat);

    const chatInput = $('mp-chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendChat();
      });
    }

    const chatToggle = $('mp-chat-toggle');
    if (chatToggle) {
      chatToggle.addEventListener('click', () => {
        const body = $('mp-chat-body');
        if (!body) return;
        _chatCollapsed = !_chatCollapsed;
        body.style.display = _chatCollapsed ? 'none' : 'block';
        chatToggle.textContent = _chatCollapsed ? '▼ Show' : '▲ Hide';
        delete chatToggle.dataset.unread;
      });
    }

    const chatBroadcast = $('mp-chat-broadcast');
    const chatRecipients = $('mp-chat-recipients');
    if (chatBroadcast && chatRecipients) {
      chatBroadcast.addEventListener('change', () => {
        chatRecipients.disabled = chatBroadcast.checked;
      });
      chatRecipients.disabled = chatBroadcast.checked;
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    ensureLegacyMgtCompatibility();
    wireButtons();
    loadOpponentMeldVisibility();
    preloadCardAssets();

    // Auto-connect if session data exists
    const saved = loadSession();
    if (saved && saved.playerId) {
      myPlayerName = saved.playerName || '';
      if ($('mp-name-input')) $('mp-name-input').value = myPlayerName;
      connect();
    }
    updateResumeUI();

    // If a room update is missed (mobile reconnect/background), silently resync
    // lobby state so players reliably transition when host starts.
    lobbyResyncTimer = setInterval(() => {
      if (!socket || !socket.connected) return;
      if (!myRoomCode || !myPlayerId) return;
      if (joinInFlight) return;
      const phase = latestState && latestState.gameState && latestState.gameState.phase;
      const topPhase = latestState && latestState.phase;
      const currentPhase = phase || topPhase || 'lobby';
      const now = Date.now();
      const staleState = (now - lastStateReceivedAt) > 10000;
      const cooldownElapsed = (now - lastLobbyResyncAt) > 15000;
      if (currentPhase === 'lobby' && staleState && cooldownElapsed) {
        lastLobbyResyncAt = now;
        joinRoom(myRoomCode, myPlayerName, myPlayerId, { silent: true });
      }
    }, 2500);
  }

  /**
   * Fetch list of suspended games from server
   */
  async function fetchSuspendedGames() {
    try {
      const response = await fetch(`${SERVER_URL}/api/suspended-games`);
      const data = await response.json();
      return data.ok ? data.games : [];
    } catch (err) {
      console.error('[MP] Error fetching suspended games:', err.message);
      return [];
    }
  }

  /**
   * Display suspended games modal
   */
  async function showSuspendedGamesModal() {
    const modal = document.getElementById('mp-suspended-games-modal');
    const list = document.getElementById('mp-suspended-games-list');
    const empty = document.getElementById('mp-suspended-empty');

    const games = await fetchSuspendedGames();

    // Clear existing list
    list.innerHTML = '';

    if (games.length === 0) {
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      games.forEach(game => {
        const item = document.createElement('li');
        item.className = 'mp-suspended-game-item';

        const date = new Date(game.pausedAt);
        const timeStr = date.toLocaleString();
        const descriptionHtml = game.description
          ? `<div class="mp-game-info-line mp-game-description">“${game.description}”</div>`
          : '';

        item.innerHTML = `
          <div class="mp-game-info">
            <div class="mp-game-info-line mp-game-room">Room: ${game.roomCode}</div>
            ${descriptionHtml}
            <div class="mp-game-info-line mp-game-round">Round: ${game.round}/11</div>
            <div class="mp-game-info-line mp-game-players">Players: ${game.playerNames.join(', ')}</div>
            <div class="mp-game-info-line mp-game-paused">Paused: ${timeStr}</div>
          </div>
          <div class="mp-game-actions">
            <button class="mp-btn success mp-resume-suspended-btn" data-room="${game.roomCode}">Resume</button>
            <button class="mp-btn danger mp-delete-suspended-btn" data-room="${game.roomCode}">Delete</button>
          </div>
        `;

        // Add event listeners
        item.querySelector('.mp-resume-suspended-btn').addEventListener('click', () => {
          resumeSuspendedGame(game.roomCode);
        });

        item.querySelector('.mp-delete-suspended-btn').addEventListener('click', () => {
          deleteSuspendedGame(game.roomCode);
        });

        list.appendChild(item);
      });
    }

    modal.classList.add('show');
  }

  /**
   * Hide suspended games modal
   */
  function hideSuspendedGamesModal() {
    const modal = document.getElementById('mp-suspended-games-modal');
    modal.classList.remove('show');
  }

  /**
   * Resume a suspended game by room code
   */
  function resumeSuspendedGame(roomCode) {
    if (!roomCode || !socket) {
      showStatus('Error: Invalid room code or socket not connected', true, true);
      return;
    }

    // Try to join the room with the given room code
    // The server will recognize it's a paused game and restore the state
    hideSuspendedGamesModal();
    joinRoom(roomCode, myPlayerName, myPlayerId);
  }

  /**
   * Delete a suspended game from storage
   */
  async function deleteSuspendedGame(roomCode) {
    if (!confirm(`Delete suspended game in room ${roomCode}? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${SERVER_URL}/api/suspended-games/${roomCode}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (data.ok) {
        showStatus(`Deleted suspended game: ${roomCode}`, false, true);
        // Refresh the list
        showSuspendedGamesModal();
      } else {
        showStatus(`Error deleting game: ${data.error}`, true, true);
      }
    } catch (err) {
      console.error('[MP] Error deleting suspended game:', err.message);
      showStatus('Error deleting game', true, true);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose minimal API for debugging
  window.MP = { createRoom, joinRoom, startGame, pauseGame, resumeGame, restartGame, sendAction, drawFromDeck, drawFromDiscard, declareMeld, undoMelds, discardCard, nextRound, showSuspendedGamesModal, hideSuspendedGamesModal, fetchSuspendedGames };
})();
