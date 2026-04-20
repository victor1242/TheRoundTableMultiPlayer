// AI Auto-Play System for 5 Crowns

const wildRank = game.roundNumber + 2;
const aiPlayer = game.currentPlayer;

if (aiPlayer) {
    const topDiscard = game.discardPile[0];
    if (topDiscard===wildRank || topDiscard.rank === "joker"  ) {
        // draw wild card from discard pile
        console.log(`[AI] ${aiPlayer.name} takes wild card from discard pile`);
            discard();


    } else {
            
    }

  console.log(`[AI] ${aiPlayer.name}'s turn`);
} else {
  console.warn("[AI] currentPlayer is null, cannot set canDraw");
}

// Step 1: Draw phase
if (aiPlayer.canDraw) {
  
  updateDiscardPileCount();
  const breakCycle = shouldBreakDiscardCycle(topDiscard);
  if (
    !breakCycle &&
    game.discardPile.length > 0 &&
    aiPlayer.shouldTakeDiscard(topDiscard, wildRank)
  ) {
    console.log(`[AI] ${aiPlayer.name} takes from discard pile`);
    discard();
  } else {
    if (breakCycle) {
      console.log(
        `[AI] ${aiPlayer.name} breaks discard cycle by drawing from deck`,
      );
    }
    console.log(`[AI] ${aiPlayer.name} draws from deck`);
    draw();
  }

  // Schedule meld phase after draw
  scheduleAITurn(500);
  //return;
}

// Step 2: Meld phase
if (aiPlayer.canDiscard && !aiPlayer.melding) {
  const turnKey = game.turnCounter || 0;
  const existingPlan = aiPlayer.aiMeldPlan;
  const hasPlan = existingPlan && existingPlan.turnKey === turnKey;

  const debugLog =
    aiPlayer.name === "Victor" ||
    aiPlayer.name === "Alice" ||
    aiPlayer.name === "Bob";
  if (debugLog) {
    console.log(
      `[MELD-PHASE] ${aiPlayer.name}: canDiscard=${aiPlayer.canDiscard}, melting=${aiPlayer.melding}, turnKey=${turnKey}, hasPlan=${hasPlan}`,
    );
  }

  // Check if unmelding and remelding would be better
  if (
    !hasPlan &&
    aiPlayer.aiMeldAttemptedTurn !== turnKey &&
    aiPlayer.shouldUnmeldAndRemeld(wildRank)
  ) {
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
    console.log(
      `[AI] ${aiPlayer.name} unmelded, now has ${aiPlayer.hand.length} cards in hand`,
    );
  }

  if (aiPlayer.shouldAttemptMeld(wildRank)) {
    console.log(`[AI] ${aiPlayer.name} attempting to meld`);
    let bestMeld = null;
    if (hasPlan) {
      bestMeld = existingPlan.meld;
    } else {
      const melds = aiPlayer.findPossibleMelds(wildRank);
      console.log(
        `[AI] ${aiPlayer.name} found ${melds.length} possible melds in hand of ${aiPlayer.hand.length} cards`,
      );
      if (melds.length > 0) {
        melds.forEach((m, idx) => {
          console.log(
            `  [${idx}] ${m.type}: ${m.cards.map((c) => `${c.rank}-${c.suit}`).join(", ")} -> ${m.remainingCards} cards remain`,
          );
        });
      }

      const validMelds = melds.filter((meld) => {
        if (meld.cards.length > game.cardsDealt) {
          return false;
        }
        const result = validateMeld(meld.cards, {
          silent:
            aiPlayer.name !== "Victor" &&
            aiPlayer.name !== "Alice" &&
            aiPlayer.name !== "Bob",
        });
        if (
          !result.valid &&
          (aiPlayer.name === "Victor" ||
            aiPlayer.name === "Alice" ||
            aiPlayer.name === "Bob")
        ) {
          console.warn(
            `[VALIDATION FAILED] ${aiPlayer.name}: ${meld.type} with cards ${meld.cards.map((c) => `${c.rank}-${c.suit}`).join(", ")}`,
          );
        }
        return result.valid;
      });

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
            scoreOneCardRemain(current) > scoreOneCardRemain(prev)
              ? current
              : prev,
          );
        } else {
          const zeroLeftMelds = validMelds.filter(
            (m) => m.remainingCards === 0,
          );
          if (zeroLeftMelds.length > 0) {
            bestMeld = zeroLeftMelds[0];
          } else {
            bestMeld = validMelds.reduce((prev, current) =>
              prev.remainingCards < current.remainingCards ? prev : current,
            );
          }
        }

        console.log(
          `  [AI] Selected meld with ${bestMeld.remainingCards} cards remaining`,
        );
      }
      aiPlayer.aiMeldAttemptedTurn = turnKey;
    }

    if (bestMeld) {
      if (!hasPlan) {
        aiPlayer.aiMeldPlan = { turnKey, meld: bestMeld };
      }

      const candidateCards = bestMeld.cards || [];
      const allInHand = candidateCards.every((card) =>
        aiPlayer.hand.includes(card),
      );
      console.log(
        `[AI] ${aiPlayer.name} best meld: ${candidateCards.map((c) => `${c.rank}-${c.suit}`).join(", ")}, allInHand: ${allInHand}, indices: ${bestMeld.indices.join(",")}`,
      );
      const candidateValidation = validateMeld(candidateCards, {
        silent: true,
      });
      if (allInHand && candidateValidation.valid) {
        resetAIMeldSelection(aiPlayer);
        const meldedCount = getMeldedCardCount(aiPlayer);

        // Mark cards for melding
        bestMeld.indices.forEach((idx) => {
          const domCardIndex = idx + 1 + meldedCount;
          const cardEl = document.getElementById(
            aiPlayer.id + "card" + domCardIndex,
          );
          console.log(
            `[AI] ${aiPlayer.name} marking card at hand[${idx}] = ${aiPlayer.hand[idx]?.rank}-${aiPlayer.hand[idx]?.suit} (DOM: ${aiPlayer.id}card${domCardIndex}), border: "${cardEl?.style.border}"`,
          );
          if (cardEl && cardEl.style.border === "") {
            cardEl.style.border = getMeldGroupColour(aiPlayer.meldGroup + 1);
            aiPlayer.meldCount += 1;
          } else {
            console.warn(
              `[AI] ${aiPlayer.name} cannot mark card - element ${cardEl ? "has border" : "not found"}`,
            );
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
          const selectedValidation = validateMeld(selectedCards, {
            silent: true,
          });
          if (!selectedValidation.valid) {
            resetAIMeldSelection(aiPlayer);
            //return;
          }

          aiPlayer.melding = true;
          aiPlayer.meldGroup += 1;

          // Call meld function
          clearAIAutoPlayTimer();
          aiAutoPlayAnimationId = setTimeout(() => {
            if (!gameConfig.aiAutoPlay.enabled || gameConfig.aiAutoPlay.paused)
              return;
            Meld();
            scheduleAITurn(500);
          }, 300);
          //return;
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
        console.log(
          `[AI] ${aiPlayer.name} meldedCount: ${meldedCountForLog}, meldGroup: ${aiPlayer.meldGroup}, hand size: ${aiPlayer.hand.length}`,
        );
        resetAIMeldSelection(aiPlayer);
      }
    }
  }

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