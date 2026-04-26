// AI Auto-Play System for 5 Crowns
function aiTakeTurn() {
    const wildRank = game.roundNumber + 2;
    const aiPlayer = game.currentPlayer;
    const new ctopDiscard = game.discardPile[0];
    if (topDiscard===wildRank || topDiscard.rank === "joker"  ) {
        // draw wild card from discard pile
        let dcard = game.discardPile[0];
        game.currentPlayer.hand.push(dcard);
        console.log(`[AI] ${aiPlayer.name} takes wild card from discard pile`);
        }   
    else
        {
        // draw from deck
        let dcard = game.deck.draw();
        game.currentPlayer.hand.push(dcard);
        console.log(`[AI] ${aiPlayer.name} draws ${dcard.rank}-${dcard.suit} from deck`);
        }   

        // Step 2: Meld phase

        // Check if unmelding and remelding would be better
  
        // Step 3: Discard phase
        console.log(`[AI] ${aiPlayer.name} discarding`);
        let discardCard = game.currentPlayer.hand[0]; // game.discardPile.unshift(discardCard);

        advanceTurn()
    }

