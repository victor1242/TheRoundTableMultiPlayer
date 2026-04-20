// AI Auto-Play System for 5 Crowns

const wildRank = game.roundNumber + 2;
const aiPlayer = game.currentPlayer;

if (aiPlayer) {
    const topDiscard = game.discardPile[0];
    if (topDiscard===wildRank || topDiscard.rank === "joker"  ) {
        // draw wild card from discard pile
        const dcard = game.discardPile.shift();
        game.currentPlayer.hand.push(dcard);
        console.log(`[AI] ${aiPlayer.name} takes wild card from discard pile`);
        }   
    else
        {
        // draw from deck
        let dcard = game.deck.draw();
        game.currentPlayer.hand.push(dcard);
        console.log(`[AI] ${aiPlayer.name} draws from deck`);
        }   

        // Step 2: Meld phase

  // Check if unmelding and remelding would be better
  
  // Step 3: Discard phase
  console.log(`[AI] ${aiPlayer.name} discarding`);
  const isFinalTurn =
    gameConfig.gameFlow.playerWhoWentOut !== -1 && !aiPlayer.IsOut;
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
}

function enableAIAutoPlay() {
  gameConfig.enableAIAutoPlay();
  if (
    game.currentPlayer &&
    game.currentPlayer.isAI &&
    !gameConfig.aiAutoPlay.paused
  ) {
    scheduleAITurn(AI_SETTINGS.TURN_DELAYS.INITIAL);
  }
}

function disableAIAutoPlay() {
  gameConfig.disableAIAutoPlay();
}

function clearAIAutoPlayTimer() {
  gameConfig.clearAITimer();
}

function scheduleAITurn(delayMs) {
  if (!gameConfig.isAIAutoPlayActive()) return;
  if (!game.currentPlayer || !game.currentPlayer.isAI) return;
  if (game.roundNumber > GAME_RULES.ROUNDS.MAX) {
    console.log("[AI] Game is complete, not scheduling AI turn");
    return;
  }
  const scaledDelay = gameConfig.getAITurnDelay("BASE");
  if (gameConfig.aiAutoPlay.stepMode) {
    gameConfig.aiAutoPlay.pendingStep = true;
    updateAIStepButton();
    return;
  }
  clearAIAutoPlayTimer();
  const timerId = setTimeout(() => performAITurn(), scaledDelay);
  gameConfig.setAITimer(timerId);
}

function updateAIPauseButton() {
  const pauseBtn = document.getElementById("ai-pause");
  if (pauseBtn)
    pauseBtn.textContent = gameConfig.aiAutoPlay.paused
      ? "Resume AI"
      : "Pause AI";
}

function updateAISpeedLabel() {
  const speedValue = document.getElementById("ai-speed-value");
  if (speedValue)
    speedValue.textContent = `${gameConfig.aiAutoPlay.speed.toFixed(2)}x`;
}

function updateAIStepButton() {
  const stepBtn = document.getElementById("ai-step");
  if (!stepBtn) return;
  const canStep =
    gameConfig.aiAutoPlay.pendingAdvance || gameConfig.aiAutoPlay.pendingStep;
  stepBtn.disabled =
    !gameConfig.aiAutoPlay.stepMode || !canStep || gameConfig.aiAutoPlay.paused;
}

function setAIStepMode(enabled) {
  gameConfig.setAIStepMode(enabled);
  clearAIAutoPlayTimer();
  updateAIStepButton();
}

function pauseAIAutoPlay() {
  gameConfig.pauseAIAutoPlay();
  updateAIPauseButton();
}

function resumeAIAutoPlay() {
  gameConfig.resumeAIAutoPlay();
  updateAIPauseButton();
  updateAIStepButton();
  if (
    gameConfig.isAIAutoPlayActive() &&
    game.currentPlayer &&
    game.currentPlayer.isAI
  ) {
    scheduleAITurn(AI_SETTINGS.TURN_DELAYS.CYCLE_BREAK);
  }
}

function bindAIPauseButton() {
  const pauseAiBtn = document.getElementById("ai-pause");
  if (!pauseAiBtn || gameConfig.isListenerBound("aiPauseButton")) return;
  pauseAiBtn.addEventListener("click", () => {
    if (gameConfig.aiAutoPlay.paused) {
      resumeAIAutoPlay();
    } else {