// AI Auto-Play System for 5 Crowns
function aiTakeTurn() {


    const wildRank = game.roundNumber + 2;
    const aiPlayer = game.currentPlayer;
    let topDiscard = new Card
    topDiscard = game.discardPile[0];
    let dcard = new Card
    let xrank = topDiscard.rank;
    
    if (topDiscard===wildRank || xrank === "joker"  ) {
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
        renderPlayerHand(game.currentPlayer);
        }   

        // Step 2: Meld phase

        // Check if unmelding and remelding would be better
  
        // Step 3: Discard phase
   
        let discardCard = game.currentPlayer.hand.splice(0,1)[0]; 
        game.discardPile.unshift(discardCard);
        
        console.log(`[AI] ${aiPlayer.name} discarding ${discardCard.rank}-${discardCard.suit} from hand`);
        renderPlayerHand(game.currentPlayer);
        advanceTurn()
    }

