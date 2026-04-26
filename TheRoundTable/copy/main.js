//const timeOutsetCurrentGameId = 4000; // Base timeout for AI actions, can be adjusted or scaled with speed settings
const GAMES_DIRECTORY_KEY = "GamesDirectory";
//const GAMES_DIRECTORY_FILE = "GamesDirectory.json";
const CURRENT_GAME_ID_KEY = "CurrentGameId";
const GAME_STATE_KEY_PREFIX = "game_state_";
const SCOREBOARD_KEY_PREFIX = "scoreboard_data_";
const AI_CONFIG_STORAGE_KEY = "ai_config";
const AI_AUTO_PLAY_STORAGE_KEY = "ai_auto_play_enabled"
const HUMAN_AUTO_MELD_STORAGE_KEY = "human_auto_meld_enabled";

let gameSelectedOption="Resume Game"

const game = new GameState();
const universalGameContext = new UniversalGameContext();

initGamesDirectory();
window.addEventListener('pageshow', (event) => {
  if (getCurrentGameId()) reLoadGameState();
});

let GameReloaded = true
reLoadGameState();
game.meldingColour = "6px solid blue";
if (GameReloaded) refreshPlayerHands();

// Keep gameId stable across page navigation (including ScoreBoard.html).
const persistedGameId = getCurrentGameId();
if (persistedGameId && !game.gameId) {
  game.gameId = persistedGameId;
} else if (!persistedGameId && game.gameId) {
  setCurrentGameId(game.gameId);
}

function openScoreboardForCurrentGame() {
  const activeGameId = game?.gameId || getCurrentGameId();
  if (!activeGameId) return;

  // Optional: wire a button/link with id="open-scoreboard"
  document.getElementById("open-scoreboard")?.addEventListener("click", openScoreboardForCurrentGame);

  setCurrentGameId(activeGameId); // re-assert before navigation
  window.location.href = `ScoreBoard.html?gameId=${encodeURIComponent(activeGameId)}`;
}

// enable button and player card listeners
addEventListeners()
addHandCardListeners();
bindGameDirectoryControls();
const startupInfoText = document.getElementById("game-info-text")?.value ?? "";
if (startupInfoText) validateBracketText(startupInfoText, "game-info-text");
;

if (!GameReloaded)
{
if (game.discardPile.length === 0 && game.deck.cards.length > 0)  
{
  game.discardPile.push(game.deck.cards.pop()); // Start discard pile with one card from deckgame.
  displayCard(game.discardPile[game.discardPile.length - 1], "discard-card", "discard");
  updateDeckAndDiscardDisplay();
}
  
// log in players
logInPlayers();
const universalGameState = new UniversalGameState(game.players, game.deck.cards, game.discardPile, game.roundNumber);

advanceTurn()
}

function toggleDebug() {
  game.DEBUG = !game.DEBUG;
  console.log("DEBUG is now", game.DEBUG ? "ON" : "OFF");
  const debugToggle = document.getElementById("debug-toggle");
  if (debugToggle) debugToggle.checked = game.DEBUG;
}

function setDebugMode(enabled) {
  game.DEBUG = Boolean(enabled);
  const debugToggle = document.getElementById("debug-toggle");
  if (debugToggle) debugToggle.checked = game.DEBUG;
  console.log("DEBUG is now", game.DEBUG ? "ON" : "OFF");
}

// AI Auto-Play System

// AI Controls
    game.aiToggle = document.getElementById("ai-auto-play");
    if (game.aiToggle) {
      game.aiToggle.addEventListener("change", (event) => {
        if (event.target.checked) {
          enableAIAutoPlay();
        } else {
          disableAIAutoPlay();
        }
      });

      // Keep toggle and runtime flag in sync across reloads.
      const savedAutoPlay = localStorage.getItem(AI_AUTO_PLAY_STORAGE_KEY) === "true";
      game.aiToggle.checked = savedAutoPlay;
      game.aiAutoPlayEnabled = savedAutoPlay;
    }

    const humanAutoMeldToggle = document.getElementById("human-auto-meld");
    if (humanAutoMeldToggle) {
      const savedHumanAutoMeld = localStorage.getItem(HUMAN_AUTO_MELD_STORAGE_KEY);
      if (savedHumanAutoMeld !== null) {
        game.humanAutoMeldEnabled = savedHumanAutoMeld === "true";
      } else {
        game.humanAutoMeldEnabled = Boolean(game.humanAutoMeldEnabled);
      }
      humanAutoMeldToggle.checked = Boolean(game.humanAutoMeldEnabled);

      humanAutoMeldToggle.addEventListener("change", (event) => {
        game.humanAutoMeldEnabled = Boolean(event.target.checked);
        localStorage.setItem(HUMAN_AUTO_MELD_STORAGE_KEY, String(game.humanAutoMeldEnabled));
      });
    }

    const aiSpeed = document.getElementById("ai-speed");
    if (aiSpeed) {
      game.aiAutoPlaySpeed = Number(aiSpeed.value) || 1;
      updateAISpeedLabel();
      aiSpeed.addEventListener("input", (event) => {
        game.aiAutoPlaySpeed = Number(event.target.value) || 1;
        updateAISpeedLabel();
      });
    }

    const aiPauseBtn = document.getElementById("ai-pause");
    if (aiPauseBtn) {
      aiPauseBtn.addEventListener("click", () => {
        if (game.aiAutoPlayPaused) {
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
        if (!game.aiManualStepMode || game.aiAutoPlayPaused || !game.aiAutoPlayEnabled) return;
        if (game.aiPendingAdvance) {
          game.aiPendingAdvance = false;
          updateAIStepButton();
            ({ forceAdvance: true });
          return;
        }
        if (!game.currentPlayer || !game.currentPlayer.aiPlayer) return;
        game.aiPendingStep = false;
        updateAIStepButton();
        performAITurn();
      });
      updateAIStepButton();
    }

    game.applyAiBtn = document.getElementById("apply-ai-config");
    if (game.applyAiBtn) {
        game.applyAiBtn.addEventListener("click", () => {
        const config = getAIConfigFromUI();
        applyAIConfig(config);
        setAIConfigToUI(config);
        console.log("[AI Setup] Applied AI config from UI");
      });
    }

   // bindAIPauseButton();
    bindVisibilityPauseHandler();

  showRoundAndWilds();
  if (game.currentPlayer) {
    setPlayerDrawMode();
    identifyCurrentPlayer("blue");
  }
  const roundMessage =
    "Next Round: " +
    game.roundNumber +
    " - " +
    game.currentPlayer.name +
    "'s turn to draw .";

  if (game.aiManualStepMode && game.aiAutoPlayEnabled && !game.aiAutoPlayPaused && game.currentPlayer && game.currentPlayer.aiPlayer && game.roundNumber <= 11) scheduleAITurn(800);


//=============== G A M E   S T A R T ==================

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
        if (game.currentPlayer.aiPlayer && game.aiAutoPlayEnabled && !game.aiAutoPlayPaused)   scheduleAITurn(1000);
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

