// AI Auto-Play System for 5 Crowns
// Uses the AIMeldPlanner module for intelligent decision making

function aiTakeTurn() {
    const wildRank = game.roundNumber + 2;
    const aiPlayer = game.currentPlayer;
    
    console.log(`[AI] ${aiPlayer.name}'s turn begins`);
    console.log(`[AI] Hand size: ${aiPlayer.hand.length}, Melded: ${getMeldedCardCount(aiPlayer)}, Expected: ${game.cardsDealt}`);
    console.log(`[AI] Current hand: ${aiPlayer.hand.map(c => c.rank + "-" + c.suit).join(", ")}`);

    // DEADLOCK DETECTION: track hand size across consecutive turns per player.
    // If hand size hasn't decreased in 3 consecutive turns, the player is stuck
    // in a draw-meld-discard cycle. Force a deck draw to break it.
    if (!aiPlayer._stuckTurns) aiPlayer._stuckTurns = 0;
    if (!aiPlayer._lastMeldedCount) aiPlayer._lastMeldedCount = 0;
    const currentMeldedCount = getMeldedCardCount(aiPlayer);
    if (currentMeldedCount <= aiPlayer._lastMeldedCount) {
        aiPlayer._stuckTurns++;
    } else {
        aiPlayer._stuckTurns = 0;
    }
    aiPlayer._lastMeldedCount = currentMeldedCount;
    const isStuck = aiPlayer._stuckTurns >= 3;
    if (isStuck) {
        console.log(`[AI] ${aiPlayer.name} DEADLOCK DETECTED (${aiPlayer._stuckTurns} turns stuck) — forcing deck draw`);
        aiPlayer._stuckTurns = 0; // reset after breaking
    }

    // PHASE 1: DRAW
    const topDiscard = game.discardPile[game.discardPile.length - 1];
    
    if (!isStuck && topDiscard && window.AIMeldPlanner.shouldTakeDiscard(topDiscard, aiPlayer.hand, wildRank)) {
        // Take from discard pile
        const dcard = game.discardPile.pop();
        aiPlayer.hand.push(dcard);
        console.log(`[AI] ${aiPlayer.name} takes ${dcard.rank}-${dcard.suit} from discard pile`);
        
        // Update discard display
        if (game.discardPile.length > 0) {
            displayCard(game.discardPile[game.discardPile.length - 1], "discard-count", "discard");
        } else {
            document.getElementById("discard-count").innerHTML = "";
        }
    } else {
        // Draw from deck
        const dcard = game.deck.draw();
        while(!dcard) {
            console.warn(`[AI] ${aiPlayer.name} attempted to draw from deck but it's empty!`);

            shuffleDiscardIntoDeck();
            card = game.deck.draw();
            console.log ("Deck size after shuffling discard in:", game.deck.cards.length);
            } 
       
        console.log(`[AI] ${aiPlayer.name} draws ${dcard.rank}-${dcard.suit} from deck`);

        aiPlayer.hand.push(dcard);
        
 
        }
    renderPlayerHand(aiPlayer);
    console.log(`[AI] Current hand: ${aiPlayer.hand.map(c => c.rank + "-" + c.suit).join(", ")}`); 

    // PHASE 2: UNMELD & REMELD (if beneficial)
    if (window.AIMeldPlanner.shouldUnmeldAndRemeld(aiPlayer.hand, aiPlayer.meldSets, wildRank)) {
        console.log(`[AI] ${aiPlayer.name} unmelding to optimize melds`);
        
        // Unmeld all cards back to hand
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
    }
    
    // PHASE 3: MELD
    if (window.AIMeldPlanner.shouldAttemptMeld(aiPlayer.hand, aiPlayer.meldSets, wildRank)) {
        const possibleMelds = window.AIMeldPlanner.findPossibleMelds(aiPlayer.hand, wildRank);
        console.log(`[AI] ${aiPlayer.name} found ${possibleMelds.length} possible melds`);
        
        if (possibleMelds.length > 0) {
            const bestMeld = window.AIMeldPlanner.selectBestMeld(possibleMelds, wildRank);
            
            if (bestMeld) {
                console.log(`[AI] ${aiPlayer.name} melding ${bestMeld.size} cards (${bestMeld.type})`);
                
                // Mark cards for melding
                aiPlayer.melding = true;
                aiPlayer.meldGroup += 1;
                const meldedCount = getMeldedCardCount(aiPlayer);
                
                bestMeld.indices.forEach(idx => {
                    const domCardIndex = idx + 1 + meldedCount;
                    const cardEl = document.getElementById(aiPlayer.id + "card" + domCardIndex);
                    if (cardEl) {
                        cardEl.style.border = getMeldGroupColour(aiPlayer.meldGroup);
                        aiPlayer.meldCount += 1;
                    }
                });
                
                // Execute meld - AI bypasses UI validation
                const meldDelay = Math.max(50, Math.round(timeOut / aiAutoPlaySpeed));
                setTimeout(() => {
                    // Directly meld the cards without going through UI validation
                    const cardsToMeld = bestMeld.indices.map(idx => aiPlayer.hand[idx]);
                    
                    // Check total melded cards doesn't exceed cards dealt
                    const currentMeldedCount = getMeldedCardCount(aiPlayer);
                    const totalAfterMeld = currentMeldedCount + cardsToMeld.length;
                    const cardsLeftInHand = aiPlayer.hand.length - cardsToMeld.length;
                    
                    console.log(`[AI] ${aiPlayer.name} Meld check: currentMelded=${currentMeldedCount}, meldSize=${cardsToMeld.length}, total=${totalAfterMeld}, cardsDealt=${game.cardsDealt}, leftInHand=${cardsLeftInHand}`);
                    
                    // Can't meld more than cards dealt
                    if (totalAfterMeld > game.cardsDealt) {
                        console.warn(`[AI] Meld would exceed cards dealt: ${totalAfterMeld} > ${game.cardsDealt}`);
                        // Reset and skip melding
                        resetAIMeldSelection(aiPlayer);
                        
                        // Just discard and advance
                        if (aiPlayer.hand.length > 0) {
                            const discardIdx = window.AIMeldPlanner.chooseCardToDiscard(aiPlayer.hand, wildRank, game.finalTurn);
                            const discardCard = aiPlayer.hand.splice(discardIdx, 1)[0];
                            game.discardPile.push(discardCard);
                            displayCard(discardCard, "discard", "discard");
                            console.log(`[AI] ${aiPlayer.name} discards ${discardCard.rank}-${discardCard.suit}`);
                            renderPlayerHand(aiPlayer);
                        }
                        advanceTurn();
                        return;
                    }
                    
                    // Must have at least 1 card left to discard (unless going out with exact meld)
                    if (cardsLeftInHand === 0 && totalAfterMeld < game.cardsDealt) {
                        console.warn(`[AI] ${aiPlayer.name}Can't meld all cards without going out: melded=${totalAfterMeld}, needed=${game.cardsDealt}`);
                        // Reset and skip melding
                        resetAIMeldSelection(aiPlayer);
                        
                        // Just discard and advance
                        if (aiPlayer.hand.length > 0) {
                            const discardIdx = window.AIMeldPlanner.chooseCardToDiscard(aiPlayer.hand, wildRank, game.finalTurn);
                            const discardCard = aiPlayer.hand.splice(discardIdx, 1)[0];
                            game.discardPile.push(discardCard);
                            displayCard(discardCard, "discard", "discard");
                            console.log(`[AI] ${aiPlayer.name} discards ${discardCard.rank}-${discardCard.suit}`);
                            renderPlayerHand(aiPlayer);
                        }
                        advanceTurn();
                        return;
                    }
                    
                    // Validate the meld
                    const meldResult = validateMeld(cardsToMeld, { silent: true });
                    if (!meldResult.valid) {
                        console.warn(`[AI] ${aiPlayer.name}Meld validation failed for ${aiPlayer.name}:`, cardsToMeld.map(c => c.rank + "-" + c.suit));
                        // Reset and skip melding
                        resetAIMeldSelection(aiPlayer);
                        
                        // Just discard and advance
                        if (aiPlayer.hand.length > 0) {
                            const discardIdx = window.AIMeldPlanner.chooseCardToDiscard(aiPlayer.hand, wildRank, game.finalTurn);
                            const discardCard = aiPlayer.hand.splice(discardIdx, 1)[0];
                            game.discardPile.push(discardCard);
                            displayCard(discardCard, "discard", "discard");
                            console.log(`[AI] ${aiPlayer.name} discards ${discardCard.rank}-${discardCard.suit}`);
                            renderPlayerHand(aiPlayer);
                        }
                        advanceTurn();
                        return;
                    }
                    
                    // Remove cards from hand
                    const selectedSet = new Set(cardsToMeld);
                    aiPlayer.hand = aiPlayer.hand.filter(card => !selectedSet.has(card));
                    
                    // Add to meld sets
                    const meldBorder = getMeldGroupColour(aiPlayer.meldGroup);
                    cardsToMeld.forEach(card => {
                        card.styleBorder = meldBorder;
                    });
                    aiPlayer.meldSets.push(cardsToMeld);
                    aiPlayer.meldCards = [];
                    aiPlayer.meldCount = 0;
                    aiPlayer.melding = false;
                    
                    renderPlayerHand(aiPlayer);
                    console.log(`[AI] ${aiPlayer.name} successfully melded ${cardsToMeld.length} cards`);
                    
                    // PHASE 4: DISCARD
                    const discardDelay = Math.max(50, Math.round(timeOut / aiAutoPlaySpeed));
                    setTimeout(() => {
                        if (aiPlayer.hand.length > 0) {
                            const discardIdx = window.AIMeldPlanner.chooseCardToDiscard(
                                aiPlayer.hand, 
                                wildRank, 
                                game.finalTurn
                            );
                            
                            const discardCard = aiPlayer.hand.splice(discardIdx, 1)[0];
                            game.discardPile.push(discardCard);
                            displayCard(discardCard, "discard", "discard");
                            console.log(`[AI] ${aiPlayer.name} discards ${discardCard.rank}-${discardCard.suit}`);
                            renderPlayerHand(aiPlayer);
                            
                            // Check if player went out
                            if (aiPlayer.hand.length === 0) {
                                console.log(`[AI] ${aiPlayer.name}*** PLAYER GOING OUT ***  Has no cards left!`);
                                PlayerHandBlinkOn("." + game.currentPlayer.id + "card");
                                aiPlayer.IsOut = true;
                                game.finalTurn = true;
                                console.log(`[AI] Set IsOut=true, finalTurn=true for ${aiPlayer.name}`);
                            }
                        }
                        
                        advanceTurn();
                    }, discardDelay);
                }, meldDelay);
                
                return; // Exit to let timeouts handle the rest
            }
        }
    }
    
    // PHASE 4: DISCARD (if no meld was made)
    if (aiPlayer.hand.length > 0) {
        const discardIdx = window.AIMeldPlanner.chooseCardToDiscard(
            aiPlayer.hand, 
            wildRank, 
            game.finalTurn
        );
        
        const discardCard = aiPlayer.hand.splice(discardIdx, 1)[0];
        game.discardPile.push(discardCard);
        displayCard(discardCard, "discard", "discard");
        console.log(`[AI] ${aiPlayer.name} discards ${discardCard.rank}-${discardCard.suit}`);
        renderPlayerHand(aiPlayer);
        
        // Check if player went out
        if (aiPlayer.hand.length === 0) {
            console.log(`[AI] *** PLAYER GOING OUT *** ${aiPlayer.name} has no cards left!`);
            PlayerHandBlinkOn("." + game.currentPlayer.id + "card");
            aiPlayer.IsOut = true;
            game.finalTurn = true;
            console.log(`[AI] Set IsOut=true, finalTurn=true for ${aiPlayer.name}`);
          
        }
    }
    
    advanceTurn();
}

