// AI Auto-Play System for 5 Crowns
function aiTakeTurn() {
    const wildRank = game.roundNumber + 2;
    const aiPlayer = game.currentPlayer;
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

