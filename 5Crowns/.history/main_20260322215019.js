const timeOut = 4000; // Base timeout for AI actions, can be adjusted or scaled with speed settings
const GAMES_DIRECTORY_KEY = "GamesDirectory";
const GAMES_DIRECTORY_FILE = "GamesDirectory.json";
const CURRENT_GAME_ID_KEY = "CurrentGameId";
const GAME_STATE_KEY_PREFIX = "game_state_";
const SCOREBOARD_KEY_PREFIX = "scoreboard_data_";
const AI_CONFIG_STORAGE_KEY = "ai_config";
const AI_AUTO_PLAY_STORAGE_KEY = "ai_auto_play_enabled";

let meldingColour = "6px solid red";
let lastRound = 11;

// game options
let optGoingOutBonus = true; // Bonus points for going out = cards dealt in round
let optDrawHint = true; // Hint to draw from deck or discard
let optDiscardHint = true; // Hint which card to discard
let optMeldHint = true; // Highlight potential melds in hand
let optPrompts = true; // Text prompts for player actions

/* global Player, AIPlayer */
//let DEBUG = false;
//let TRACE = false;

//let restoredState = false;
//let useIcons = true;
let handCardListenersBound = (false);
let debugToggleBound = false;
let aiPauseButtonBound = false;
let aiAutoPlayEnabled = false;
let aiAutoPlayAnimationId = null;
let aiAutoPlayPaused = false;
let aiAutoPlaySpeed = 1;
let aiManualStepMode = false;
let aiPendingStep = false;
let aiPendingAdvance = false;
let aiAutoPlayAutoPaused = false;
let aiVisibilityHandlerBound = false

let gameSelectedOption="Resume Game"

window.addEventListener('pageshow', (event) => {
  reLoadGameState();
});

/* global Player, AIPlayer, GameConfig, gameConfig, GAME_RULES, AI_SETTINGS, STORAGE_KEYS, aiTakeTurn() */
const gamex = new GameState();
const game = new GameState();
const Ga
reLoadGameState();
refreshPlayerHands();

// enable button and player card listeners
addEventListeners();
addHandCardListeners();

let vict=09

if (!GameReloaded)
{
game.discardPile.push(game.deck.cards.pop()); // Start discard pile with one card from deckgame.
displayCard(game.discardPile[game.discardPile.length - 1], "discard-card", "discard");
updateDeckAndDiscardDisplay();

// log in players
logInPlayers();



if (gameSelectedOption === "Restore Game") reLoadGameState(storageKey);

game.currentPlayerIndex = game.dealerIndex; 
advanceTurn()

/*
function startGameWhenReady() {
  if (typeof window.logInPlayers === "function") {
    window.logInPlayers();
    if (typeof addEventListeners === "function") addEventListeners();
  } else {
    // Try again in 50ms
    setTimeout(startGameWhenReady, 50);
  }
}
*/
function updateCurrentPlayerReference() {
  game.currentPlayer= game.players[game.currentPlayerIndex];
  identifyCurrentPlayer("blue");
}

function updateHumanAIFlag() {  
  game.players.forEach((p) => {

    const aiBadgeEl = document.getElementById(p.id + "ai-h");
    if (aiBadgeEl) {
      if (p.aiPlayer) {
        aiBadgeEl.innerHTML = '<img class="ai-icon" src="./android.svg" alt="AI player" />';
        aiBadgeEl.title = "AI player";
      } else {
        aiBadgeEl.innerHTML = "";
        aiBadgeEl.title = "";
      }
    }
    
    const el1 = document.getElementById(p.id +"id");
    if (el1) el1.textContent = "id: " + p.id;

    const el2 = document.getElementById(p.id +"fname");
    if (el2) el2.textContent =  p.name;

    const el6 = document.getElementById(p.id +"roundScore");
    if (el6) el6.textContent = "roundScore: " + p.roundScore;

    const el7 = document.getElementById(p.id +"gameScore");
    if (el7) el7.textContent = "gameScore: " + p.gameScore;

    const el8 = document.getElementById(p.id +"IsOut");
    if (el8) el8.textContent = "IsOut: " + p.IsOut;

    const el9 = document.getElementById(p.id +"melding");
    if (el9) el9.textContent = "melding: " + p.melding;
  })
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatGameId(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}-${min}-${ss}`;
}

function getGameStorageKey(gameId) {
  return `${GAME_STATE_KEY_PREFIX}${gameId}`;
}

function getScoreboardStorageKey(gameId) {
  return `${SCOREBOARD_KEY_PREFIX}${gameId}`;
}

function getCurrentGameId() {
  const currentGameId = localStorage.getItem(CURRENT_GAME_ID_KEY);
  return currentGameId;
}

function setCurrentGameId(gameId) {
  if (gameId) {
    localStorage.setItem(CURRENT_GAME_ID_KEY, gameId);
  } else {
    localStorage.removeItem(CURRENT_GAME_ID_KEY);
  }
}

function getCurrentGameStorageKey(createIfMissing = true) {
  let gameId = getCurrentGameId();
  if (!gameId && createIfMissing) {
    gameId = formatGameId();
    setCurrentGameId(gameId);
  }
  return gameId ? getGameStorageKey(gameId) : "game_state";
}

function getCurrentScoreboardKey() {
  const gameId = getCurrentGameId();
  return gameId ? getScoreboardStorageKey(gameId) : "scoreboard_data";
}

function loadGamesDirectory() {
  try {
    const stored = localStorage.getItem(GAMES_DIRECTORY_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveGamesDirectory(directory) {
  localStorage.setItem(GAMES_DIRECTORY_KEY, JSON.stringify(directory));
}

function getDirectoryEntryById(directory, gameId) {
  return directory.find((entry) => entry.id === gameId);
}

function updateGameDirectoryStatus(gameIdOverride) {
  const statusEl = document.getElementById("game-status");
  const infoEl = document.getElementById("game-info-text");
  if (!statusEl && !infoEl) return;

  const directory = loadGamesDirectory();
  const gameId = gameIdOverride || getCurrentGameId();
  const entry = gameId ? getDirectoryEntryById(directory, gameId) : null;
  const status = entry?.status || "open";

  if (statusEl) statusEl.textContent = `Status: ${status}`;
  if (infoEl) {
    const infoText = entry?.info || "";
    if (infoEl.value !== infoText) infoEl.value = infoText;
  }
}

function renderGamesDirectory() {
  const listEl = document.getElementById("game-select");
  if (!listEl) return;

  const directory = loadGamesDirectory();
  listEl.innerHTML = "";
  directory.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.id;
    const info = entry.info ? ` | ${entry.info}` : "";
    option.textContent = `${entry.id} | ${entry.status || "open"}${info}`;
    listEl.appendChild(option);
  });

  const currentId = getCurrentGameId();
  if (currentId) listEl.value = currentId;
  updateGameDirectoryStatus();
}

function upsertGamesDirectoryEntry(infoOverride) {
  let gameId = getCurrentGameId();
  if (!gameId) {
    gameId = formatGameId();
    setCurrentGameId(gameId);
  }

  const storageKey = getGameStorageKey(gameId);
  const status = game.roundNumber >= lastRound ? "completed" : "open";
  const now = new Date().toISOString();
  const infoEl = document.getElementById("game-info-text");
  const info = infoOverride ?? (infoEl ? infoEl.value.trim() : "");

  const directory = loadGamesDirectory();
  const existing = getDirectoryEntryById(directory, gameId);

  if (existing) {
    existing.storageKey = storageKey;
    existing.status = status;
    existing.info = info;
    existing.updatedAt = now;
  } else {
    directory.unshift({
      id: gameId,
      storageKey,
      info,
      status,
      createdAt: now,
      updatedAt: now,
    });
  }

  saveGamesDirectory(directory);
  renderGamesDirectory();
}

function ensureCurrentGameIdFromLegacy() {
  if (getCurrentGameId()) return;
  const legacyState = localStorage.getItem("game_state");
  if (!legacyState) return;

  const gameId = formatGameId();
  setCurrentGameId(gameId);
  const newKey = getGameStorageKey(gameId);
  localStorage.setItem(newKey, legacyState);
}

async function initGamesDirectory() {
  if (localStorage.getItem(GAMES_DIRECTORY_KEY)) {
    const directory = loadGamesDirectory();
    const pruned = directory.filter(
      (entry) => entry?.storageKey && localStorage.getItem(entry.storageKey),
    );
    const removedCount = directory.length - pruned.length;
    if (removedCount > 0) {
      saveGamesDirectory(pruned);
      const statusEl = document.getElementById("game-status");
      if (statusEl) {
        statusEl.textContent = `Status: ${removedCount} stale entr${removedCount === 1 ? "y" : "ies"} removed`;
        setTimeout(() => updateGameDirectoryStatus(), 3000);
      }
    }
    renderGamesDirectory();
    const currentId = getCurrentGameId();
    if (currentId) {
      if (!getDirectoryEntryById(pruned, currentId)) {
        setCurrentGameId("");
      } else {
        updateGameDirectoryStatus();
      }
    }
    return;
  }

  try {
    const response = await fetch(GAMES_DIRECTORY_FILE, { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        saveGamesDirectory(data);
        renderGamesDirectory();
        return;
      }
    }
  } catch {
    // Ignore and fall back to empty directory.
  }

  saveGamesDirectory([]);
  renderGamesDirectory();
  if (getCurrentGameId()) {
    upsertGamesDirectoryEntry();
  }
}

function getDefaultAIConfig() {
  return {
    p1: { enabled: false, difficulty: "smart" },
    p2: { enabled: true, difficulty: "smart" },
    p3: { enabled: true, difficulty: "smart" },
  };
}

function loadAIConfig() {
  try {
    const stored = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!stored) return getDefaultAIConfig();
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object" ? parsed : getDefaultAIConfig();
  } catch {
    return getDefaultAIConfig();
  }
}

function saveAIConfig(config) {
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

function setAIConfigToUI(config) {
  const p1Mode = document.getElementById("ai-p1-mode");
  const p2Mode = document.getElementById("ai-p2-mode");
  const p3Mode = document.getElementById("ai-p3-mode");
  const p1Diff = document.getElementById("ai-p1-difficulty");
  const p2Diff = document.getElementById("ai-p2-difficulty");
  const p3Diff = document.getElementById("ai-p3-difficulty");

  if (p1Mode) p1Mode.value = config.p1?.enabled ? "ai" : "human";
  if (p2Mode) p2Mode.value = config.p2?.enabled ? "ai" : "human";
  if (p3Mode) p3Mode.value = config.p3?.enabled ? "ai" : "human";

  if (p1Diff) p1Diff.value = config.p1?.difficulty || "smart";
  if (p2Diff) p2Diff.value = config.p2?.difficulty || "smart";
  if (p3Diff) p3Diff.value = config.p3?.difficulty || "smart";
}

function getAIConfigFromUI() {
  const p1Mode = document.getElementById("ai-p1-mode");
  const p2Mode = document.getElementById("ai-p2-mode");
  const p3Mode = document.getElementById("ai-p3-mode");
  const p1Diff = document.getElementById("ai-p1-difficulty");
  const p2Diff = document.getElementById("ai-p2-difficulty");
  const p3Diff = document.getElementById("ai-p3-difficulty");

  return {
  
    p1: {
      enabled: p1Mode ? p1Mode.value === "ai" : false,
      difficulty: p1Diff ? p1Diff.value : "smart",
    },
    p2: {
      enabled: p2Mode ? p2Mode.value === "ai" : true,
      difficulty: p2Diff ? p2Diff.value : "smart",
    },
    p3: {
      enabled: p3Mode ? p3Mode.value === "ai" : true,
      difficulty: p3Diff ? p3Diff.value : "smart",
    },
  };
}

function applyAIConfig(config) {
  if (game.players.length === 0) {
    logInPlayers();
  }

  if (game.currentPlayerIndex !== -1) {
    game.currentPlayer = game.players[game.currentPlayerIndex];
  }

  if (aiAutoPlayEnabled && !aiAutoPlayPaused && game.currentPlayer && game.currentPlayer.aiPlayer) {
    scheduleAITurn(400);
  }
}

function toggleDebug() {
  DEBUG = !DEBUG;
  console.log("DEBUG is now", DEBUG ? "ON" : "OFF");
  const debugToggle = document.getElementById("debug-toggle");
  if (debugToggle) debugToggle.checked = DEBUG;
}

function setDebugMode(enabled) {
  DEBUG = Boolean(enabled);
  const debugToggle = document.getElementById("debug-toggle");
  if (debugToggle) debugToggle.checked = DEBUG;
  console.log("DEBUG is now", DEBUG ? "ON" : "OFF");
}

function displayCard(card, cardId, mode) {
  if (!card) {
    console.warn("[displayCard] Skipping undefined card for", cardId);
    return;
  }
  let cardImg = document.createElement("img");
  cardImg.alt = card.rank + "-" + card.suit;
  cardImg.width = game.cardWidth;
  cardImg.height = game.cardHeight;
  cardImg.style.border = card.styleBorder;
  cardImg.src = "./cards/" + card.rank + "_of_" + card.suit + ".png";
  if (mode === "meld") cardImg.style.border = meldingColour;
  let existingEl = document.getElementById(cardId);
  if (existingEl) {
    existingEl.innerText = "";
    existingEl.append(cardImg);
  } else {
    showMessage(cardId + " element error: " + card.rank + ": " + card.suit + " " +  cardId);
  }
}

function displayCardBack(cardId) {
  let cardImg = document.createElement("img");
  cardImg.alt = "Deck";
  cardImg.width = game.cardWidth;
  cardImg.height = game.cardHeight;
  cardImg.src = "./cards/back.png";
  let existingEl = document.getElementById(cardId);
  if (existingEl) {
    existingEl.innerText = "";
    existingEl.append(cardImg);
  }
}

function updateDeckAndDiscardDisplay() {
  // Deck pile (face down)
  if (typeof displayCardBack === "function") {
    displayCardBack("deck-card");
  }
  const deckCountEl = document.getElementById("deck-count");
  if (deckCountEl) {
    deckCountEl.textContent = game.deck.cards.length;
  }
  // Add click listener to deck pile for drawing
  const deckCardEl = document.getElementById("deck-card");
  if (deckCardEl && !deckCardEl.listenerAdded) {
    deckCardEl.addEventListener("click", function() {
      if (typeof drawFromDeck === "function") drawFromDeck();
    });
    deckCardEl.listenerAdded = true;
  }
  // Discard pile (face up)
  const discardCardEl = document.getElementById("discard-card");
  if (discardCardEl) {
    discardCardEl.innerText = "";
    if (game.discardPile.length > 0) {
      displayCard(game.discardPile[game.discardPile.length - 1], "discard-card", "discard");
    }
  }
  const discardCountEl = document.getElementById("discard-count");
  if (discardCountEl) {
    discardCountEl.textContent = game.discardPile.length;
  }
}

function renderPlayerHand(Player) {
  // Clear previous hand display
  for (let k = 1; k <= 12; k++) {
    const el = document.getElementById(Player.id + "card" + k);
    if (el) el.innerHTML = "";
  }

  // Render meldSets (2D array)
  let cardIdx = 0;
  if (Array.isArray(Player.meldSets)) {
    for (let meld of Player.meldSets) {
      if (Array.isArray(meld) && meld.length > 0) {
        for (let card of meld) {
          const el = document.getElementById(
            Player.id + "card" + (cardIdx + 1),
          );
          if (el && card) displayCard(card, el.id, "meld");
          cardIdx++;
        }
      }
    }
  }

  // Render remaining hand cards after melds
  for (let k = 0; k < Player.hand.length; k++) {
    const el = document.getElementById(Player.id + "card" + (cardIdx + 1));
    if (el && Player.hand[k]) displayCard(Player.hand[k], el.id, "hand" );
    cardIdx++;
  }
}

function getMeldedCardCount(player) {
  let count = 0;
  if (Array.isArray(player.meldSets)) {
    player.meldSets.forEach((meld) => {
      if (Array.isArray(meld)) count += meld.length;
    });
  }
  return count;
}

function addHandCardListeners() {
  document.addEventListener("click", function handleClick(event) {
    const cardEl = event.target.closest(".p1card, .p2card, .p3card");
    if (!cardEl) return;
// hand click
    const cardClass = Array.from(cardEl.classList).find((cls) =>
      /^p\d+card$/.test(cls),
    );
    if (!cardClass) return;

    console.log("box clicked", cardEl.id, game.currentPlayer.id);
    console.log("Image Source:", cardEl.className);

    if (cardEl.id.substring(0,6)  === "player")
      {
      const playerId = cardClass.substring(0, 2); // e.g., "p1"
      for (let idx = 0; idx < game.players.length; idx++) {
        if (game.players[idx].id === playerId) {
          game.players[idx].aiPlayer = !game.players[idx].aiPlayer;
          updateHumanAIFlag()
          return;
          }
        }
      }    
  else 
    {    
    // reject if not current player's hand
   
    if (!game.currentPlayer || !cardEl.classList.contains(game.currentPlayer.id + "card")) return;
    processPlayerHandCardClick(cardEl)
    renderPlayerHand(game.currentPlayer);
   }
  

function selectMeldCard(cardEl) {
      if (cardEl.style.border === "") {
            cardEl.style.border = "8px solid blue";
      
            game.currentPlayer.meldCount += 1;
          } else {
            // deselect
            cardEl.style.border = "";
            game.currentPlayer.meldCount -= 1;
          }

    }
  })
}


function discardCardSelected(cardEl) {
    
      // discarding selectecd card from hand 
      let ElementId = cardEl.id;
      let cardIndex = ElementId.substring(6);
      let cardIndexInt = Number(cardIndex) - 1;
      let handIndex = cardIndexInt - getMeldedCardCount(game.currentPlayer);
      const selectedCard = game.currentPlayer.hand[handIndex];
      
      // check if trying to discard wild card if option is selected, warn player that he is discarding a wild card which the next player will probaly appreciate, and ask for confirmation

      const wildRank = String(game.roundNumber + 2);
      const isWild =
        selectedCard?.rank === "joker" || selectedCard?.rank === wildRank;
      if (isWild) {
        if (!(confirm("Are you sure that you want to discard a wild card? ")))  return;}

        // discard selected card from hand to discard pile
        let xCard = game.currentPlayer.hand.splice(handIndex, 1)[0];
        showMessage(xCard.rank + " of " + xCard.suit + " discarded.");
        renderPlayerHand(game.currentPlayer);
        game.discardPile.pop(xCard);
        updateDisplay()
        displayCard(xCard, "discard-card", "discard" );

        if (game.currentPlayer.hand.length === 0) {
          console.log(`[discardCardSelected] *** PLAYER GOING OUT *** ${game.currentPlayer.name} has no cards left!`);
          PlayerHandBlinkOn("." + game.currentPlayer.id + "card");
          game.currentPlayer.IsOut = true;
          game.finalTurn = true;
          console.log(`[discardCardSelected] Set IsOut=true, finalTurn=true for ${game.currentPlayer.name}`)
      
          if (!game.currentPlayer.aiPlayer) 
            alert(game.currentPlayer.name + " you have gone out!");
          }
         advanceTurn();
      }

function processPlayerHandCardClick(cardEl){
    // process hand card click - either melding or discarding depending on current mode
    if (game.currentPlayer.melding) selectMeldCard(cardEl)
    else discardCardSelected(cardEl);  
    }
  
function resetAIMeldSelection(aiPlayer) {
  const meldedCount = getMeldedCardCount(aiPlayer);
  for (let i = meldedCount + 1; i <= 12; i++) {
    const el = document.getElementById(`${aiPlayer.id}card${i}`);
    if (el && el.style.border !== "") {
      el.style.border = "";
    }
  }
  aiPlayer.meldCount = 0;
  aiPlayer.melding = false;
}

function countAIMarkedCards(aiPlayer) {
  const meldedCount = getMeldedCardCount(aiPlayer);
  let count = 0;
  for (let i = meldedCount + 1; i <= 12; i++) {
    const el = document.getElementById(`${aiPlayer.id}card${i}`);
    if (el && el.style.border !== "") count += 1;
  }
  return count;
}

function discardFromHand(player, handIndex, options = {}) {
  const isFinalTurn = Boolean(options.isFinalTurn);
  const selectedCard = player.hand[handIndex];
  if (!selectedCard) return false;

  const wildRank = String(game.roundNumber + 2);
  const hasNonWild = player.hand.some(
    (card) => card.rank !== "joker" && card.rank !== wildRank,
  );
  const isLastCard = player.hand.length === 1;
  const isWild =
    selectedCard?.rank === "joker" || selectedCard?.rank === wildRank;
  if (isWild && playerWhoWentOut === -1 && hasNonWild && !isFinalTurn && !isLastCard) {
    if (!player.aiPlayer) {
      alert("You cannot discard a wild card until the final turn phase begins.");
    }
    return false;
  }

  const meldedCount = getMeldedCardCount(player);
  const totalCards = meldedCount + player.hand.length;
  if (player.hand.length === 1 && totalCards < game.cardsDealt) {
    if (!player.aiPlayer) {
      alert("You must meld all cards before discarding your last card.");
    }
    console.log(`[Discard Check] ${player.name} cannot go out: melded=${meldedCount}, hand=${player.hand.length}, total=${totalCards}, required=${game.cardsDealt}`);
    return false;
  }

  const xCard = player.hand.splice(handIndex, 1)[0];
  showMessage(xCard.rank + " of " + xCard.suit + " discarded.");
  renderPlayerHand(player);
  game.discardPile.push(xCard);
  updateDisplay()
  player.lastDrawnCard = null;
  player.lastDrawnSource = null;
  displayCard(xCard, "discard-card", "discard");

  if (player.hand.length === 0) {
    console.log(`[discardFromHand] *** PLAYER GOING OUT *** ${player.name} has no cards left!`);
    player.IsOut = true;
    game.finalTurn = true;
    console.log(`[discardFromHand] Set IsOut=true, finalTurn=true for ${player.name}`);
    
    if (!player.aiPlayer) {
      alert(player.name + " you have gone out!");
    }
  }
  advanceTurn();
}

// AI Auto-Play System
function performAITurn() {
  if (!aiAutoPlayEnabled || !game.currentPlayer.aiPlayer || aiAutoPlayPaused) return;
  
  aiTakeTurn();
  updateCurrentPlayerReference();
}

function enableAIAutoPlay() {
  aiAutoPlayEnabled = true;
  localStorage.setItem(AI_AUTO_PLAY_STORAGE_KEY, "true");
  console.log("AI Auto-Play ENABLED");
  
  if (game.currentPlayer.aiPlayer && !aiAutoPlayPaused) {
    scheduleAITurn(1000);
  }
}

function disableAIAutoPlay() {
  aiAutoPlayEnabled = false;
  clearAIAutoPlayTimer();
  localStorage.setItem(AI_AUTO_PLAY_STORAGE_KEY, "false");
  console.log("AI Auto-Play DISABLED");
}

function clearAIAutoPlayTimer() {
  if (aiAutoPlayAnimationId) {
    clearTimeout(aiAutoPlayAnimationId);
    aiAutoPlayAnimationId = null;
  }
}

function scheduleAITurn(delayMs) {
  if (!aiAutoPlayEnabled || aiAutoPlayPaused) return;
  if (!game.currentPlayer || !game.currentPlayer.aiPlayer) return;
  if (game.roundNumber > lastRound) {
    console.log("[AI] Game is complete, not scheduling AI turn");
    return;
  }
  const scaledDelay = Math.max(50, Math.round(delayMs / aiAutoPlaySpeed));
  if (aiManualStepMode) {
    aiPendingStep = true;
    updateAIStepButton();
    return;
  }
  clearAIAutoPlayTimer();
  aiAutoPlayAnimationId = setTimeout(() => performAITurn(), scaledDelay);
}

function updateAIPauseButton() {
  const pauseBtn = document.getElementById("ai-pause");
  if (pauseBtn) pauseBtn.textContent = aiAutoPlayPaused ? "Resume AI" : "Pause AI";
}

function updateAISpeedLabel() {
  const speedValue = document.getElementById("ai-speed-value");
  if (speedValue) speedValue.textContent = `${aiAutoPlaySpeed.toFixed(2)}x`;
}

function updateAIStepButton() {
  const stepBtn = document.getElementById("ai-step");
  if (!stepBtn) return;
  const canStep = aiPendingAdvance || aiPendingStep;
  stepBtn.disabled = !aiManualStepMode || !canStep || aiAutoPlayPaused;
}

function setAIStepMode(enabled) {
  aiManualStepMode = Boolean(enabled);
  aiPendingStep = aiManualStepMode && aiAutoPlayEnabled && game.currentPlayer?.aiPlayer;
  aiPendingAdvance = false;
  clearAIAutoPlayTimer();
  updateAIStepButton();
}

function pauseAIAutoPlay() {
  aiAutoPlayPaused = true;
  clearAIAutoPlayTimer();
  updateAIPauseButton();
  console.log("AI Auto-Play PAUSED");
}

function resumeAIAutoPlay() {
  aiAutoPlayPaused = false;
  updateAIPauseButton();
  updateAIStepButton();
  console.log("AI Auto-Play RESUMED");
  if (aiAutoPlayEnabled && !aiAutoPlayPaused && game.currentPlayer && game.currentPlayer.aiPlayer) {
    scheduleAITurn(500);
  }
}

function bindVisibilityPauseHandler() {
  if (aiVisibilityHandlerBound) return;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (aiAutoPlayEnabled && !aiAutoPlayPaused) {
        aiAutoPlayAutoPaused = true;
        pauseAIAutoPlay();
      }
    } else if (aiAutoPlayAutoPaused) {
      aiAutoPlayAutoPaused = false;
      updateAIPauseButton();
      updateAIStepButton();
    }
  });
  aiVisibilityHandlerBound = true;
}

function getSelectedMeldCards(player) {
  const selectedCards = [];
  const meldedCount = getMeldedCardCount(player);
  const els = document.querySelectorAll("." + player.id + "card");
  els.forEach((el) => {
    const cardEl = document.getElementById(el.id);
    if (cardEl && cardEl.style.border !== "") {
      const cardIndexInt = Number(cardEl.id.substring(6)) - 1;
      const handIndex = cardIndexInt - meldedCount;
      if (handIndex >= 0 && handIndex < player.hand.length) {
        const card = player.hand[handIndex];
        if (card && player.hand.includes(card)) {
          selectedCards.push(card);
        } else {
          console.warn(
            `[Meld] Skipping invalid card (inHand: ${player.hand.includes(card)})`,
            card?.rank,
            card?.suit,
          );
        }
      }
    }
  });
  return selectedCards;
}

function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

function formatScoreboardCard(card) {
  const rankText = card?.rank ?? " ";
  const suitText =
    typeof useIcons !== "undefined" && useIcons
      ? getSuitIcon(card?.suit).slice(0, 1) ?? " "
      : card?.suit ?? " ";
  const colour = card?.suitColour ?? "";
  const styleAttr = colour ? ` style="color:${colour};"` : "";
  return `<span class="score-card"${styleAttr}>${rankText}-${suitText}</span>`;
}

// AI Controls
const aiToggle = document.getElementById("ai-auto-play");
    if (aiToggle) {
      aiToggle.addEventListener("change", (event) => {
        if (event.target.checked) {
          enableAIAutoPlay();
        } else {
          disableAIAutoPlay();
        }
      });
    }

    const aiSpeed = document.getElementById("ai-speed");
    if (aiSpeed) {
      aiAutoPlaySpeed = Number(aiSpeed.value) || 1;
      updateAISpeedLabel();
      aiSpeed.addEventListener("input", (event) => {
        aiAutoPlaySpeed = Number(event.target.value) || 1;
        updateAISpeedLabel();
      });
    }

    const aiPauseBtn = document.getElementById("ai-pause");
    if (aiPauseBtn) {
      aiPauseBtn.addEventListener("click", () => {
        if (aiAutoPlayPaused) {
          resumeAIAutoPlay();
        } else {
          pauseAIAutoPlay();
        }
      });
      updateAIPauseButton();
    }

    const aiStepMode = document.getElementById("ai-step-mode");
    if (aiStepMode) {
      aiStepMode.addEventListener("change", (event) => {
        setAIStepMode(event.target.checked);
      });
    }

    const aiStepBtn = document.getElementById("ai-step");
    if (aiStepBtn) {
      aiStepBtn.addEventListener("click", () => {
        if (!aiManualStepMode || aiAutoPlayPaused || !aiAutoPlayEnabled) return;
        if (aiPendingAdvance) {
          aiPendingAdvance = false;
          updateAIStepButton();
          advanceTurn({ forceAdvance: true });
          return;
        }
        if (!game.currentPlayer || !game.currentPlayer.aiPlayer) return;
        aiPendingStep = false;
        updateAIStepButton();
        performAITurn();
      });
      updateAIStepButton();
    }

    const applyAiBtn = document.getElementById("apply-ai-config");
    if (applyAiBtn) {
      applyAiBtn.addEventListener("click", () => {
        const config = getAIConfigFromUI();
        applyAIConfig(config);
        setAIConfigToUI(config);
        console.log("[AI Setup] Applied AI config from UI");
      });
    }

   // bindAIPauseButton();
    bindVisibilityPauseHandler();

function ScoreBoard() {
  storeGameState(game);
  window.location.href = "ScoreBoard.html";
}

  showRoundAndWilds();
  setPlayerDrawMode();

  identifyCurrentPlayer("blue");
  const roundMessage =
    "Next Round: " +
    game.roundNumber +
    " - " +
    game.currentPlayer.name +
    "'s turn to draw .";

  if (aiAutoPlayEnabled && !aiAutoPlayPaused && game.currentPlayer && game.currentPlayer.aiPlayer && game.roundNumber <= 11) scheduleAITurn(800);

function renderAllGameState() {
  // Render all player hands using the hand property
  if (game) {
    logInPlayers()
    for (let p of game.players) {
      renderPlayerHand(p);
    }
  }

  // Render deck back
  if (typeof updateDeckAndDiscardDisplay === "function") {
    updateDeckAndDiscardDisplay();
  }
}

//===================== G A M E   S T A R T =============================

  if (game.newRound) {
    game.newRound = false;
    if (game.roundNumber === 0) {
      game.cardsDealt = 3;
      game.roundNumber = 1;
     
      game.dealerIndex = 0;
      game.currentPlayerIndex = 1;
      game.currentPlayer = game.players[game.currentPlayerIndex];
      game.currentPlayer.hand = [];
      game.currentPlayer.melding = false;
      game.currentPlayer.meldCount = 0;
      game.currentPlayer.meldCards = [];
      game.currentPlayer.meldSets = [];
      game.currentPlayer.IsOut = false;

      dealNewRoundCards();
      // Defensive: check if game.players[game.currentPlayerIndex] is valid
      if (game.currentPlayerIndex !== -1 && game.players[game.currentPlayerIndex]) {
        game.currentPlayer = game.players[game.currentPlayerIndex];
        showRoundAndWilds();
        identifyCurrentPlayer("blue");
        updateCurrentPlayerReference();
        updatePlayerPrompt("Draw a card from the deck or discard pile.");
        game.currentPlayer = game.players[game.currentPlayerIndex];
     
        // If current player is AI and auto-play is enabled, start their turn
        if (game.currentPlayer.aiPlayer && aiAutoPlayEnabled && !aiAutoPlayPaused)   scheduleAITurn(1000);
      }
       else {
        console.error(
          "currentPlayer index is invalid:",
          game.currentPlayerIndex,
          game.players,
        );
        alert("Error: No active player found.");
      }
    }
  }

game.currentPlayer = game.players[game.currentPlayerIndex];
setPlayerDrawMode();
showRoundAndWilds();
//window.logInPlayers = logInPlayers;
//window.addEventListener("DOMContentLoaded", /startGameWhenReady)}


function storeGameState(gameState) {
  const storageKey = getCurrentGameStorageKey();
  const savedData = structuredClone(gameState);
  localStorage.setItem(storageKey, JSON.stringify(savedData));  
  console.log("Game state stored in localStorage under key:", storageKey);
}
function reLoadGameState() {
  const storageKey = getCurrentGameStorageKey();
  const savedState = localStorage.getItem(storageKey);
  if (savedState) {
    const parsedState = JSON.parse(savedState);
    Object.assign(game , parsedState);
    console.log("Game state restored from localStorage.");
    updateDeckAndDiscardDisplay();


  }
}