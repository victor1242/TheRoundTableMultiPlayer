// AI Auto-Play System for 5 Crowns
// Uses the AIMeldPlanner module for intelligent decision making

function aiTakeTurn() {
    const wildRank = game.roundNumber + 2;
    const aiPlayer = game.currentPlayer;
    
    console.log(`[AI] ${aiPlayer.name}'s turn begins`);
    
    // PHASE 1: DRAW
    const topDiscard = game.discardPile[0];
    
    if (topDiscard && window.AIMeldPlanner.shouldTakeDiscard(topDiscard, aiPlayer.hand, wildRank)) {
        // Take from discard pile
        const dcard = game.discardPile.shift();
        aiPlayer.hand.push(dcard);
        console.log(`[AI] ${aiPlayer.name} takes ${dcard.rank}-${dcard.suit} from discard pile`);
        
        // Update discard display
        if (game.discardPile.length > 0) {
            displayCard(game.discardPile[0], "discard", "discard");
        }
    } else {
        // Draw from deck
        const dcard = game.deck.draw();
        aiPlayer.hand.push(dcard);
        console.log(`[AI] ${aiPlayer.name} draws ${dcard.rank}-${dcard.suit} from deck`);
    }
    
    renderPlayerHand(aiPlayer);
    
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
                
                // Execute meld
                aiWait() // Wait for visual feedback
                let aiBrakeEl = document.getElementById("ai-Step")
                aiBrakeEl.style.backgroundColor = "red";
                setTimeout(() => {
                    Meld();
                    
                    // PHASE 4: DISCARD
                    let aiBrakeEl = document.getElementById("ai-Step")
                    aiBrakeEl.style.backgroundColor = "red";
                    setTimeout(() => {
                        if (aiPlayer.hand.length > 0) {
                            const discardIdx = window.AIMeldPlanner.chooseCardToDiscard(
                                aiPlayer.hand, 
                                wildRank, 
                                false
                            );
                            
                            const discardCard = aiPlayer.hand.splice(discardIdx, 1)[0];
                            game.discardPile.unshift(discardCard);
                            displayCard(discardCard, "discard", "discard");
                            console.log(`[AI] ${aiPlayer.name} discards ${discardCard.rank}-${discardCard.suit}`);
                            renderPlayerHand(aiPlayer);
                        }
                        
                        advanceTurn();
                    }, timeOut);
                }, timeOut);
                
                return; // Exit to let timeouts handle the rest
            }
        }
    }
    
    // PHASE 4: DISCARD (if no meld was made)
    if (aiPlayer.hand.length > 0) {
        const discardIdx = window.AIMeldPlanner.chooseCardToDiscard(
            aiPlayer.hand, 
            wildRank, 
            false
        );
        
        const discardCard = aiPlayer.hand.splice(discardIdx, 1)[0];
        game.discardPile.unshift(discardCard);
        displayCard(discardCard, "discard", "discard");
        console.log(`[AI] ${aiPlayer.name} discards ${discardCard.rank}-${discardCard.suit}`);
        renderPlayerHand(aiPlayer);
    }
    
    advanceTurn();
}

