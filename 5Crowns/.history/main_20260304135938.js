
const GAMES_DIRECTORY_KEY = "GamesDirectory";
const GAMES_DIRECTORY_FILE = "GamesDirectory.json";
const CURRENT_GAME_ID_KEY = "CurrentGameId";
const GAME_STATE_KEY_PREFIX = "game_state_";
const SCOREBOARD_KEY_PREFIX = "scoreboard_data_";
const AI_CONFIG_STORAGE_KEY = "ai_config";
const AI_AUTO_PLAY_STORAGE_KEY = "ai_auto_play_enabled";

/* global Player, AIPlayer */
//let DEBUG = false;
//let TRACE = false;

//let restoredState = false;
//let useIcons = true;
let handCardListenersBound = false;
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


/* global Player, AIPlayer, GameConfig, gameConfig, GAME_RULES, AI_SETTINGS, STORAGE_KEYS */

 function identifyCurrentPlayer(colour) {
  game.players.forEach((p) => {
    const nameEl = document.getElementById("player" + p.id.substring(1) + "name");
    
    if (nameEl) {
      nameEl.style.backgroundColor = colour;
      nameEl.textContent = p.name;
      if(p.IsOut) nameEl.style.backgroundColor = 'red' ;
    }
  });
}

function changeMeldColor(colour) {
  const El = document.getElementById("meld");
  if (El) {
  El.style.backgroundColor = colour;
  }
}

function showRoundAndWilds() {
  let WildText = document.getElementById("wild-card");
  if (WildText)
    WildText.textContent =
      " Wild Cards: " + getValueRank(game.roundNumber + 2) + "'s and Joker''s ";
}

const game = new GameState();

// log in players
logInPlayers();

// eneble button and player card listeners
addEventListeners(); 
addHandCardListeners(); 

// deal new round with new deck and shuffle, reset player hands and melds, set dealer and current player, show round number and wild cards
dealNewRoundCards();

// get current player updated to play his turn
setPlayerDrawMode()


function updatePlayerPrompt(msg) {
  const promptEl = document.getElementById(game.currentPlayer.id + "prompt")
  if (promptEl) promptEl.textContent = msg;
  }
  
  function identifyCurrentPlayer(colour) {
  game.players.forEach((p) => {
    const nameEl = document.getElementById("player" + p.id.substring(1) + "name");
    if (nameEl && nameEl.style.backgroundColor !== "red") {
      nameEl.style.backgroundColor = "";
      nameEl.textContent = p.name;
    }
  });
  game.currentPlayer = game.players[game.currentPlayerIndex];

  let arg = "player" + game.currentPlayer.id.substring(1) + "name";
  let nameEl = document.getElementById(arg);          
  
  if (game.currentPlayer.IsOut) nameEl.style.backgroundColor = 'red' ;
  else nameEl.style.backgroundColor = colour

  nameEl.textContent = game.currentPlayer.name;
}

function changeMeldColor(colour) {
  const El = document.getElementById("meld");
  if (El) {
  El.style.backgroundColor = colour;
  }
}


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
  game.currentPlayer = identifyCurrentPlayer("blue");
  game.currentPlayer = game.players[game.currentPlayerIndex];

  for (let p of game.players) {

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
  }
}


function setPlayerDrawMode() {
    updateCurrentPlayerReference();

    // turn on melding
    changeMeldColor("blue")
    game.currentPlayer.melding = true;
    game.currentPlayer.meldGroup += 1;
    updatePlayerPrompt("Draw a card from the deck or discard pile.");
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

function getCurrentGameStorageKey(createIfMissing = false) {
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
  const status = game.roundNumber >= 11 ? "completed" : "open";
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


/*
// Configure AI players (call before starting game)
function configureAIPlayers(aiConfig = {}) {
  // aiConfig example: { p1: false, p2: true, p3: true }
  // or { p1: { enabled: false }, p2: { enabled: true, difficulty: "smart" } }
}
  game.players.forEach((player, idx) => {
    const key = player.id;
    //const config = aiConfig[key];
    
   // if (!config && config !== false) return;

   // const enabled = config === true || (config && config.enabled === true);
   // const difficulty = (config && config.difficulty) || "smart";
/*
    if (enabled) {
      if (!(player instanceof AIPlayer)) {
        // Convert existing player to AI player
        const aiPlayer = new AIPlayer(player.id, player.name, difficulty);
        Object.assign(aiPlayer, player); // Copy state
        aiPlayer.isAI = true;
        aiPlayer.difficulty = difficulty;
        game.players[idx] = aiPlayer;
        console.log(`${player.name} is now an AI player (${difficulty})`);
      } else {
        player.difficulty = difficulty;
      }
    } else if (player.isAI) {
      // Convert AI player back to human player
      const humanPlayer = new Player(player.id, player.name, false);
      Object.assign(humanPlayer, player);
      humanPlayer.isAI = false;
      delete humanPlayer.difficulty;
      game.players[idx] = humanPlayer;
      console.log(`${player.name} is now a human player`);
    }
  });
*/

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

  //configureAIPlayers(config);
  //saveAIConfig(config);
  
  // Re-sync game.currentPlayer reference after converting players
  if (game.currentPlayerIndex !== -1) {
    game.currentPlayer = game.players[game.currentPlayerIndex];
  }

  if (aiAutoPlayEnabled && !aiAutoPlayPaused && game.currentPlayer && game.currentPlayer.isAI) {
    scheduleAITurn(400);
  }
}

function recordDraw(source, card, player) {
  if (!game.recentDraws) game.recentDraws = [];
  game.recentDraws.push({
    source,
    rank: card?.rank,
    suit: card?.suit,
    playerId: player?.id,
  });
  if (game.recentDraws.length > 6) game.recentDraws.shift();
}

//getValueRank

function shouldBreakDiscardCycle(topCard) {
  if (!topCard) return false;
  const recentDiscards = (game.recentDiscards || []).slice(-4);
  const recentDraws = (game.recentDraws || []).slice(-4);
  if (recentDiscards.length < 4 || recentDraws.length < 4) return false;
  const allKings = recentDiscards.every((d) => d.rank === "king");
  const allFromDiscard = recentDraws.every((d) => d.source === "discard");
  const firstDiscard = recentDiscards[0];
  const sameCardRepeated = recentDiscards.every(
    (d) => d.rank === firstDiscard.rank && d.suit === firstDiscard.suit,
  );
  const topMatchesRepeat =
    topCard.rank === firstDiscard.rank && topCard.suit === firstDiscard.suit;
  const repeatCycle = sameCardRepeated && topMatchesRepeat && allFromDiscard;
  return (allKings && allFromDiscard) || repeatCycle;
}

function isFullAIAutoPlay() {
  return (
    aiAutoPlayEnabled &&
    Array.isArray(game.players) &&
    game.players.length > 0 &&
    game.players.every((p) => p.isAI)
  );
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
  let imgsrc = "";
  let cardImg = document.createElement("img");

  cardImg.alt = card.rank + "-" + card.suit;
  cardImg.width = game.cardWidth;
  cardImg.height = game.cardHeight;
  cardImg.style.border = card.styleBorder;
  
  imgsrc = "./cards/" + card.rank + "_of_" + card.suit + ".png";
  cardImg.src = imgsrc;
  if (mode === "meld") cardImg.style.border = "10px solid yellow";
  document.getElementById(cardId).innerText = "";
  document.getElementById(cardId).append(cardImg);
  showMessage(cardImg.src + ": " + cardId);

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


  //if (game.currentPlayer.isAI && aiAutoPlayEnabled && !aiAutoPlayPaused && game.roundNumber <= 11) {
    // Schedule AI turn (only if game not complete)
    //   scheduleAITurn(800);
  //}


function addHandCardListeners() {
  document.addEventListener("click", function handleClick(event) {
    const cardEl = event.target.closest(".p1card, .p2card, .p3card");
    if (!cardEl) return;
// hand click
    const cardClass = Array.from(cardEl.classList).find((cls) =>
      /^p\d+card$/.test(cls),
    );
    if (!cardClass) return;

    console.log("box clicked", cardEl.id, game.currentPlayer);
    console.log("Image Source:", cardEl.className);
    // reject if not current player's hand
    if (!game.currentPlayer || !cardEl.classList.contains(game.currentPlayer.id + "card")) return;
    processPlayerHandCardClick(cardEl)
    renderPlayerHand(game.currentPlayer);
  });
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
        game.discardPile.unshift(xCard);
       
        game.currentPlayer.lastDrawnCard = null;
        game.currentPlayer.lastDrawnSource = null;
        displayCard(xCard, "discard", "discard" );

        if (game.currentPlayer.hand.length === 0) {
          game.currentPlayer.IsOut = true;
          identifyCurrentPlayer("red")
      
          if (!game.currentPlayer.isAI) 
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
    if (!player.isAI) {
      alert("You cannot discard a wild card until the final turn phase begins.");
    }
    return false;
  }

  const meldedCount = getMeldedCardCount(player);
  const totalCards = meldedCount + player.hand.length;
  if (player.hand.length === 1 && totalCards < game.cardsDealt) {
    if (!player.isAI) {
      alert("You must meld all cards before discarding your last card.");
    }
    console.log(`[Discard Check] ${player.name} cannot go out: melded=${meldedCount}, hand=${player.hand.length}, total=${totalCards}, required=${game.cardsDealt}`);
    return false;
  }

  const xCard = player.hand.splice(handIndex, 1)[0];
  showMessage(xCard.rank + " of " + xCard.suit + " discarded.");
  renderPlayerHand(player);
  game.discardPile.unshift(xCard);
 
  player.lastDrawnCard = null;
  player.lastDrawnSource = null;
  displayCard(xCard, "discard", "discard");

  if (player.hand.length === 0) {
    player.IsOut = true;
    identifyCurrentPlayer("red")
    }
    if (!player.isAI) {
      alert(player.name + " you have gone out!");
    }
     advanceTurn();
  }
 

// AI Auto-Play System
function performAITurn() {
  if (!aiAutoPlayEnabled || !game.currentPlayer.isAI || aiAutoPlayPaused) return;

  const wildRank = game.roundNumber + 2;
  const aiPlayer = game.currentPlayer;

  updateCurrentPlayerReference();
}
  /*
let aiPlayer = false
  console.log(`[AI] ${aiPlayer.name}'s turn`);

  // Step 1: Draw phase
  if (aiPlayer.canDraw) {
    const topDiscard = game.discardPile[0];
    const breakCycle = shouldBreakDiscardCycle(topDiscard);
    if (!breakCycle && game.discardPile.length > 0 && aiPlayer.shouldTakeDiscard(topDiscard, wildRank)) {
      console.log(`[AI] ${aiPlayer.name} takes from discard pile`);
      discard();
    } else {
      if (breakCycle) {
        console.log(`[AI] ${aiPlayer.name} breaks discard cycle by drawing from deck`);
      }
      console.log(`[AI] ${aiPlayer.name} draws from deck`);
      draw();
    }
    
    // Schedule meld phase after draw
    scheduleAITurn(500);
  }

  // Step 2: Meld phase
  if (aiPlayer.canDiscard && !aiPlayer.melding) {
    const turnKey = game.turnCounter || 0;
    const existingPlan = aiPlayer.aiMeldPlan;
    const hasPlan = existingPlan && existingPlan.turnKey === turnKey;
    
    const debugLog = aiPlayer.name === "Victor" || aiPlayer.name === "Alice" || aiPlayer.name === "Bob";
    if (debugLog) {
      console.log(`[MELD-PHASE] ${aiPlayer.name}: canDiscard=${aiPlayer.canDiscard}, melding=${aiPlayer.melding}, turnKey=${turnKey}, hasPlan=${hasPlan}`);
    }

    // Check if unmelding and remelding would be better
    if (!hasPlan && aiPlayer.aiMeldAttemptedTurn !== turnKey && aiPlayer.shouldUnmeldAndRemeld(wildRank)) {
      console.log(`[AI] ${aiPlayer.name} will unmeld to improve melds`);
      // Programmatically unmeld
      for (let i = 0; i < aiPlayer.meldSets.length; i++) {
        for (let k = 0; k < aiPlayer.meldSets[i].length; k++) {
          aiPlayer.meldSets[i][k].bckgrndColour = "";
          aiPlayer.meldSets[i][k].styleBorder = "";
          aiPlayer.hand.push(aiPlayer.meldSets[i][k]);
        }
      }
      aiPlayer.meldSets = [];
      aiPlayer.meldCards = [];
      aiPlayer.meldCount = 0;
      aiPlayer.meldGroup = 0;
      renderPlayerHand(aiPlayer);
      console.log(`[AI] ${aiPlayer.name} unmelded, now has ${aiPlayer.hand.length} cards in hand`);
    }

    if (aiPlayer.shouldAttemptMeld(wildRank)) {
      console.log(`[AI] ${aiPlayer.name} attempting to meld`);
      let bestMeld = null;
      if (hasPlan) {
        bestMeld = existingPlan.meld;
      } else {
        const melds = aiPlayer.findPossibleMelds(wildRank);
        console.log(`[AI] ${aiPlayer.name} found ${melds.length} possible melds in hand of ${aiPlayer.hand.length} cards`);
        if (melds.length > 0) {
          melds.forEach((m, idx) => {
            console.log(`  [${idx}] ${m.type}: ${m.cards.map(c => `${c.rank}-${c.suit}`).join(', ')} -> ${m.remainingCards} cards remain`);
          });
        }

        const validMelds = melds.filter(
          (meld) => {
            if (meld.cards.length > game.cardsDealt) {
              return false;
            }
            const result = validateMeld(meld.cards, { silent: aiPlayer.name !== "Victor" && aiPlayer.name !== "Alice" && aiPlayer.name !== "Bob" });
            if (!result.valid && (aiPlayer.name === "Victor" || aiPlayer.name === "Alice" || aiPlayer.name === "Bob")) {
              console.warn(`[VALIDATION FAILED] ${aiPlayer.name}: ${meld.type} with cards ${meld.cards.map(c => `${c.rank}-${c.suit}`).join(', ')}`);
            }
            return result.valid;
          },
        );

        if (validMelds.length > 0) {
          console.log(`  [AI] ${validMelds.length} melds are valid`);
          const getRemainingCards = (meld) => {
            const used = new Set(meld.indices);
            return aiPlayer.hand.filter((_, idx) => !used.has(idx));
          };
          const scoreOneCardRemain = (meld) => {
            const remaining = getRemainingCards(meld);
            const card = remaining[0];
            const isWild = card.rank === "joker" || card.value === wildRank;
            const penalty = aiPlayer.evaluateCardValue(card, wildRank) || 0;
            return (isWild ? -1000 : 0) + penalty;
          };

          const oneLeftMelds = validMelds.filter((m) => m.remainingCards === 1);
          if (oneLeftMelds.length > 0) {
            bestMeld = oneLeftMelds.reduce((prev, current) =>
              scoreOneCardRemain(current) > scoreOneCardRemain(prev) ? current : prev,
            );
          } else {
            const zeroLeftMelds = validMelds.filter((m) => m.remainingCards === 0);
            if (zeroLeftMelds.length > 0) {
              bestMeld = zeroLeftMelds[0];
            } else {
              bestMeld = validMelds.reduce((prev, current) =>
                (prev.remainingCards < current.remainingCards) ? prev : current,
              );
            }
          }

          console.log(`  [AI] Selected meld with ${bestMeld.remainingCards} cards remaining`);
        }
        aiPlayer.aiMeldAttemptedTurn = turnKey;
      }
      
      if (bestMeld) {
        if (!hasPlan) {
          aiPlayer.aiMeldPlan = { turnKey, meld: bestMeld };
        }

        const candidateCards = bestMeld.cards || [];
        const allInHand = candidateCards.every((card) => aiPlayer.hand.includes(card));
        console.log(`[AI] ${aiPlayer.name} best meld: ${candidateCards.map(c => `${c.rank}-${c.suit}`).join(', ')}, allInHand: ${allInHand}, indices: ${bestMeld.indices.join(',')}`);
        const candidateValidation = validateMeld(candidateCards, { silent: true });
        if (allInHand && candidateValidation.valid) {
          resetAIMeldSelection(aiPlayer);
          const meldedCount = getMeldedCardCount(aiPlayer);

          // Mark cards for melding
          bestMeld.indices.forEach((idx) => {
            const domCardIndex = idx + 1 + meldedCount;
            const cardEl = document.getElementById(
              aiPlayer.id + "card" + domCardIndex,
            );
            console.log(`[AI] ${aiPlayer.name} marking card at hand[${idx}] = ${aiPlayer.hand[idx]?.rank}-${aiPlayer.hand[idx]?.suit} (DOM: ${aiPlayer.id}card${domCardIndex}), border: "${cardEl?.style.border}"`);
            if (cardEl && cardEl.style.border === "") {
              cardEl.style.border = getMeldGroupColour(aiPlayer.meldGroup + 1);
              aiPlayer.meldCount += 1;
            } else {
              console.warn(`[AI] ${aiPlayer.name} cannot mark card - element ${cardEl ? 'has border' : 'not found'}`);
            }
          });

          const markedCount = countAIMarkedCards(aiPlayer);
          if (markedCount < 3) {
            console.warn("[AI] Skipping meld due to insufficient marked cards", {
              player: aiPlayer.name,
              expected: bestMeld.cards?.length || 0,
              marked: markedCount,
            });
            resetAIMeldSelection(aiPlayer);
          } else {
            const selectedCards = getSelectedMeldCards(aiPlayer);
            const selectedValidation = validateMeld(selectedCards, { silent: true });
            if (!selectedValidation.valid) {
              resetAIMeldSelection(aiPlayer);
             
            }

            aiPlayer.melding = true;
            aiPlayer.meldGroup += 1;

            // Call meld function
            clearAIAutoPlayTimer();
            aiAutoPlayAnimationId = setTimeout(() => {
              if (!aiAutoPlayEnabled || aiAutoPlayPaused) return;
              Meld();
              scheduleAITurn(500);
            }, 300);
          
          }
        } else {
          if (aiPlayer.aiMeldPlan && aiPlayer.aiMeldPlan.turnKey === turnKey) {
            aiPlayer.aiMeldPlan = null;
          }
          console.log("[AI] Skipping invalid meld candidate", {
            allInHand,
            candidate: candidateCards.map((c) => `${String(c.rank)}-${c.suit}`),
            validation: candidateValidation,
          });
          const meldedCountForLog = getMeldedCardCount(aiPlayer);
          console.log(`[AI] ${aiPlayer.name} meldedCount: ${meldedCountForLog}, meldGroup: ${aiPlayer.meldGroup}, hand size: ${aiPlayer.hand.length}`);
          resetAIMeldSelection(aiPlayer);
        }
      }
    }

    // Step 3: Discard phase
    console.log(`[AI] ${aiPlayer.name} discarding`);
    const isFinalTurn = playerWhoWentOut !== -1 && !aiPlayer.IsOut;
    let discardIdx = aiPlayer.chooseCardToDiscard(wildRank, isFinalTurn);
    let discarded = discardFromHand(aiPlayer, discardIdx, { isFinalTurn });
    if (!discarded) {
      const fallbackIdx = aiPlayer.hand.findIndex(
        (card) => card.rank !== "joker" && card.value !== wildRank,
      );
      if (fallbackIdx >= 0) {
        discardFromHand(aiPlayer, fallbackIdx, { isFinalTurn });
      } else if (aiPlayer.hand.length > 0) {
        discardFromHand(aiPlayer, 0, { isFinalTurn: true });
      }
    }
  
*/

function enableAIAutoPlay() {
  aiAutoPlayEnabled = true;
  localStorage.setItem(AI_AUTO_PLAY_STORAGE_KEY, "true");
  console.log("AI Auto-Play ENABLED");
  
  if (game.currentPlayer.isAI && !aiAutoPlayPaused) {
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
  if (!game.currentPlayer || !game.currentPlayer.isAI) return;
  if (game.roundNumber > 11) {
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
  aiPendingStep = aiManualStepMode && aiAutoPlayEnabled && game.currentPlayer?.isAI;
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
  if (aiAutoPlayEnabled && !aiAutoPlayPaused && game.currentPlayer && game.currentPlayer.isAI) {
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


function refillDeckFromDiscard() {
  if (!Array.isArray(game.discardPile) || game.discardPile.length <= 1) {
    return;
  }
  const topDiscard = game.discardPile.shift();
  game.deck.cards = game.deck.cards.concat(game.discardPile);
  game.discardPile = [topDiscard];
  game.deck.shuffle();
  displayCard(topDiscard, "discard", "discard");
  showMessage("Deck reshuffled from discard pile.");
}

// draw top card from the discard pile
function discard() {
  game.currentPlayer = game.players[game.currentPlayerIndex];
  updateCurrentPlayerReference();
  game.currentPlayer = game.players[game.currentPlayerIndex];
   if (game.currentPlayer.hand.length+
    game.currentPlayer.meldSets.length=== 
    game.cardsDealt + 1){
        showMessage("you have already drawn a card this turn", game.currentPlayer.name);
        return;
        }

     const dcard = game.discardPile.shift();
     game.currentPlayer.hand.push(dcard);
     recordDraw("discard", dcard, game.currentPlayer);
    game.currentPlayer.lastDrawnCard = dcard;
    game.currentPlayer.lastDrawnSource = "discard";

     renderPlayerHand(game.currentPlayer);
     
     if (game.discardPile.length === 0)  document.getElementById("discard").innerHTML = "";
     else 
      {
      const dcard = game.discardPile.shift();
      displayCard(dcard, "discard", "discard");
      game.discardPile.unshift(dcard);
      }
   
    renderPlayerHand(game.currentPlayer);
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
        if (!game.currentPlayer || !game.currentPlayer.isAI) return;
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

    bindAIPauseButton();
    bindVisibilityPauseHandler();


 // if (document.readyState === "loading") {
//   window.addEventListener("DOMContentLoaded", bindHandlers);
 //} else {
//    bindHandlers();
//  }

 

function saveGameState() {
  // Only save serializable properties
  const stateToSave = {
    cardWidth: game.cardWidth,
    cardHeight: game.cardHeight,
    roundNumber: game.roundNumber,
    scoreboardData: game.scoreboardData,
    dealerIndex: game.dealerIndex,
    currentPlayer: game.currentPlayer,
    cardsDealt: game.cardsDealt,
    deck: game.deck.cards,
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      gameScore: isNaN(p.gameScore) ? 0 : (p.gameScore ?? 0),
      roundScore: isNaN(p.roundScore) ? 0 : (p.roundScore ?? 0),
  hand: Array.isArray(p.hand) ? p.hand.map((card) => ({ ...card })) : [],
      meldSets: Array.isArray(p.meldSets)
        ? p.meldSets.map((meld) =>
            Array.isArray(meld) ? meld.map((card) => ({ ...card })) : [],
          )
        : [],
      meldCount: p.meldCount,
      melding: p.melding,
      IsOut: p.IsOut,
      wildDiscard: p.wildDiscard,
      wildDraw: p.wildDraw,
      wildCardUse: p.wildCardUse,
      goingOutBonus: p.goingOutBonus
    })),
    discardPile: game.discardPile, 
    // Add other game properties as needed
  };
  console.log(JSON.stringify(stateToSave));
  const storageKey = getCurrentGameStorageKey(true);
  localStorage.setItem(storageKey, JSON.stringify(stateToSave));
  upsertGamesDirectoryEntry();
}
function ScoreBoard() {
  saveScoreBoard();
  saveGameState();
  window.location.href = "ScoreBoard.html";
}

  game.roundNumber=1
  game.cardsDealt = game.roundNumber + 2;
  game.dealerIndex = 0
  game.currentPlayerIndex = 1
  game.currentPlayer = game.players[game.currentPlayerIndex];

  

  showRoundAndWilds();
  setPlayerDrawMode();


  if (game.deck.cards.length < 116) {
    game.deck = new Deck();

  }

  game.players.forEach((p) => {
    p.hand = [];
    p.melding = false;
    p.meldCount = 0;
    p.meldGroups = 0;
    p.meldCards = [];
    p.meldSets = [];
    p.IsOut = false;

 //   for (let i = 0; i < game.cardsDealt; i++) {
 //     let card = game.deck.draw();
 //     p.hand.push(card);
 //     displayCard(card, p.id + "card" + (i + 1));
 //   }
  });

  identifyCurrentPlayer("blue");
  const roundMessage =
    "Next Round: " +
    game.roundNumber +
    " - " +
    game.currentPlayer.name +
    "'s turn to draw .";
  // if (isFullAIAutoPlay())  showMessage(roundMessage);
  // else alert(roundMessage);

  if (aiAutoPlayEnabled && !aiAutoPlayPaused && game.currentPlayer && game.currentPlayer.isAI && game.roundNumber <= 11) scheduleAITurn(800);
  


function getMeldGroupColour(meldGroup) {
  return ("8px solid blue")
  const colours = {
    0: "",
    1: "8px solid blue",
    2: "8px solid blue",
    3: "8px solid blue",
  };
  return colours[meldGroup] || "";
}

function displayCardBack(cardId) {
  let cardImg = document.createElement("img");
  cardImg.alt = "Card Back";
  cardImg.width = game.cardWidth;
  cardImg.height = game.cardHeight;
  cardImg.src = "./cards/back.png";
  showMessage( cardImg.src  + cardId);
  document.getElementById(cardId).innerHTML = "";
  document.getElementById(cardId).append(cardImg);
}

function restoreGameState(storageKey) {
  console.log("Restoring game state from localStorage...");
  const resolvedKey = storageKey || getCurrentGameStorageKey();
  const saved = localStorage.getItem(resolvedKey);
  if (saved) {
    const state = JSON.parse(saved);

    game.roundNumber = state.roundNumber;
    game.dealerIndex = state.dealerIndex;
    game.currentPlayer = state.currentPlayer;
    game.cardsDealt = state.cardsDealt;
    game.players = []; // Clear existing players before restoring

    // Restore players
    if (Array.isArray(state.players)) {

      const player1name = document.getElementById("player1name");
      if (player1name) player1name.textContent = "Victor";

      const player2name = document.getElementById("player2name");
      if (player2name) player2name.textContent = "Alice";

      const player3name = document.getElementById("player3name");
      if (player3name) player3name.textContent = "Bob";

      for (let i = 0; i < state.players.length; i++) {
        game.addPlayer(state.players[i].id, state.players[i].name);

        if (game.players[i]) {
          const savedGameScore = state.players[i].gameScore;
          const savedRoundScore = state.players[i].roundScore;
          
          game.players[i].gameScore = isNaN(savedGameScore) ? 0 : (savedGameScore ?? 0);
          game.players[i].roundScore = isNaN(savedRoundScore) ? 0 : (savedRoundScore ?? 0);
          game.players[i].meldCount = state.players[i].meldCount;
          game.players[i].melding = state.players[i].melding;
          game.players[i].IsOut = state.players[i].IsOut;
          game.players[i].wildDiscard = state.players[i].wildDiscard;
          game.players[i].wildDraw = state.players[i].wildDraw;
          game.players[i].wildCardUse = state.players[i].wildCardUse;
          game.players[i].goingOutBonus = state.players[i].goingOutBonus;

          // Rehydrate hand to Card instances
          if (Array.isArray(state.players[i].hand)) {
            game.players[i].hand = state.players[i].hand.map(
              (cardObj) =>
                new Card(
                  cardObj.suit,
                  cardObj.suitIcon,
                  cardObj.suitColour,
                  cardObj.rank,
                  cardObj.value,
                  cardObj.wild,
                  cardObj.wildValue,
                  cardObj.scrnref,
                  cardObj.styleBorder,
                  cardObj.bckgrndColour,
                ),
            );
          }

          // Rehydrate meldSets to Card instances
          if (Array.isArray(state.players[i].meldSets)) {
            game.players[i].meldSets = state.players[i].meldSets.map((meld) =>
              Array.isArray(meld)
                ? meld.map(
                    (cardObj) =>
                      new Card(
                        cardObj.suit,
                        cardObj.suitIcon,
                        cardObj.suitColour,
                        cardObj.rank,
                        cardObj.value,
                        cardObj.wild,
                        cardObj.wildValue,
                        cardObj.scrnref,
                        cardObj.styleBorder,
                        cardObj.bckgrndColour,
                      ),
                  )
                : [],
            );
          }

          // Rehydrate meldCards to Card instances
          if (Array.isArray(state.players[i].meldCards)) {
            game.players[i].meldCards = state.players[i].meldCards.map(
              (cardObj) =>
                new Card(
                  cardObj.suit,
                  cardObj.suitIcon,
                  cardObj.suitColour,
                  cardObj.rank,
                  cardObj.value,
                  cardObj.wild,
                  cardObj.wildValue,
                  cardObj.scrnref,
                  cardObj.styleBorder,
                  cardObj.bckgrndColour,
                ),
            );
          }
  
          console.log(
            `${game.players[i].id}-${game.players[i].name} hand:`,
           game.players[i].hand.map((c) => `${c.rank}-${c.suit}`),
          );
          console.log(
            `${game.players[i].id}-${game.players[i].name} melds:`,
            game.players[i].meldCards.map((c) => `${c.rank}-${c.suit}`),
          );
          if (game.players[0].hand.length > 0) {
          renderPlayerHand(game.players[i]);
        }
      }
    }
    game.scoreboardData = state.scoreboardData;
    // Rehydrate discard pile to Card instances
    if (Array.isArray(state.discardPile)) {
      game.discardPile = state.discardPile.map(
        (cardObj) =>
          new Card(
            cardObj.suit,
            cardObj.suitIcon,
            cardObj.suitColour,
            cardObj.rank,
            cardObj.value,
            cardObj.wild,
            cardObj.wildValue,
            cardObj.scrnref,
            cardObj.styleBorder,
            cardObj.bckgrndColour,
          ),
      );
    } else {
      game.discardPile = [];
    }
  }
  game.currentPlayer = game.players[game.currentPlayerIndex];
  
  restoredState = true;
  game.newRound = false;
  console.log("Game state restored from localStorage.");  
}

function renderAllGameState() {
  // Render all player hands using the hand property
  if (game) {
    logInPlayers()
    for (let p of game.players) {
      renderPlayerHand(p);
    }
  }
  // Render discard pile
  if (game && game.discardPile && game.discardPile.length > 0) {
    let topCard = game.discardPile[0];
    if (typeof displayCard === "function") {
      displayCard(topCard, "discard");
    }
  }
  // Render deck back
  if (typeof displayCardBack === "function") {
    displayCardBack("deck");
  }
}

//===================== G A M E   S T A R T =============================

//game.currentPlayer = game.players[game.currentPlayerIndex] 

ensureCurrentGameIdFromLegacy();
const initialStorageKey = getCurrentGameStorageKey();
if (localStorage.getItem(initialStorageKey) || localStorage.getItem("game_state")) {
  restoreGameState(
    localStorage.getItem(initialStorageKey) ? initialStorageKey : "game_state",
  );
}

 if (typeof renderAllGameState === "function") {
   renderAllGameState();
  }

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded and parsed");
  if (!debugToggleBound) {
    debugToggleBound = true;
    // Keyboard debug toggle for quick inspection during development.
    document.addEventListener("keydown", (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === "D") {
        toggleDebug();
      }
    });
  }
  const debugToggle = document.getElementById("debug-toggle");
  if (debugToggle) {
    setDebugMode(debugToggle.checked);
    debugToggle.addEventListener("change", (event) => {
      setDebugMode(event.target.checked);
    });
  }

  // Restore AI Auto-Play state from localStorage
  loadAIAutoPlayState();

  const initialAiConfig = loadAIConfig();
  setAIConfigToUI(initialAiConfig);
  applyAIConfig(initialAiConfig);
  console.log("[AI Setup] Applied initial AI config at startup");
  bindAIPauseButton();
  
  // After AI config is applied, check if current player is AI and start their turn if auto-play is enabled
  // BUT only if game is not complete
  console.log("[AI Setup] Checking auto-play conditions: restoredState=", restoredState, "aiAutoPlayEnabled=", aiAutoPlayEnabled, "currentPlayer=", game.currentPlayer?.name, "isAI=", game.currentPlayer?.isAI, "roundNumber=", game.roundNumber);
  if (game.roundNumber > 11) {
    console.log("[AI Setup] Game is complete (round > 11), NOT starting auto-play");
  } else if (aiAutoPlayEnabled && !aiAutoPlayPaused && game.currentPlayer && game.currentPlayer.isAI) {
    console.log("[AI Setup] Starting automatic turn for", game.currentPlayer.name);
    scheduleAITurn(1000);
  } else {
    console.log("[AI Setup] Auto-play NOT started - restoredState:", restoredState, "enabled:", aiAutoPlayEnabled, "hasPlayer:", !!game.currentPlayer, "isAI:", game.currentPlayer?.isAI);
  }

  const saveGameBtn = document.getElementById("save-game");
  if (saveGameBtn) {
    saveGameBtn.addEventListener("click", () => {
      saveGameState();
      updateGameDirectoryStatus();
    });
  }

  const resumeGameBtn = document.getElementById("resume-game");
  if (resumeGameBtn) {
    resumeGameBtn.addEventListener("click", () => {
      const listEl = document.getElementById("game-select");
      const selectedId = listEl ? listEl.value : "";
      if (!selectedId) return;
      setCurrentGameId(selectedId);
      location.reload();
    });
  }
  
  // Add ScoreBoard button logic
  const scoreboardBtn = document.getElementById("scoreboard");
  if (scoreboardBtn) {
    scoreboardBtn.addEventListener("click", function () {
      saveGameState();
      window.location.href = "ScoreBoard.html";
    });
  }
});
/*
if (!restoredState) {
  game.dealerIndex = -1;
  game.currentPlayerIndex = -1;
  game.cardsDealt = 0;
  game.roundNumber = 0;
}
*/


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

/*
      // clear player name colour
      for (let p = 0; p < game.players.length; p++) {
        const nameEl = document.getElementById("player" + p.id.substring(1) + "name");
        if (nameEl)  nameEl.style.backgroundColor = "";
        */
      
      }
      // deal out hands
      //for (let p = 0; p < game.players.length; p++) {
       // let player = game.players[p];
       // for (let i = 0; i < game.cardsDealt; i++) {
       //   let card = game.deck.draw();
       //  player.hand.push(card);
       // }
       // renderPlayerHand(player);
      //}
    
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
        if (game.currentPlayer.isAI && aiAutoPlayEnabled && !aiAutoPlayPaused)   scheduleAITurn(1000);
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



identifyCurrentPlayer("blue");
updateCurrentPlayerReference();
game.currentPlayer = game.players[game.currentPlayerIndex];
setPlayerDrawMode();
showRoundAndWilds();
//window.logInPlayers = logInPlayers;
//window.addEventListener("DOMContentLoaded", startGameWhenReady);