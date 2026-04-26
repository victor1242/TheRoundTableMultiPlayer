// Utility and helper functions for Five CrownsdataArray

 // const { StrictMode } = require("react");

let DEBUG = false;
let TRACE = false;
let restoredState = false;
let useIcons = true;


function logInPlayers() {
  if (game.players.length >= 3) return; // Players already logged in
  game.addPlayer("p1", "Victor");
  game.addPlayer("p2", "Alice");
  game.addPlayer("p3", "Bob");
  /*
  game.players[0].aiPlayer = false;
  game.players[1].aiPlayer = false;
  game.players[2].aiPlayer = false;
*/
  const player1name = document.getElementById("player1name");
  if (player1name) player1name.textContent = "Victor";

  const player2name = document.getElementById("player2name");
  if (player2name) player2name.textContent = "Alice";

  const player3name = document.getElementById("player3name");
  if (player3name) player3name.textContent = "Bob";
}

function getSuitIcon(suit) {
  const suitIcons = {
    stars: "★orange",
    diamonds: "♦red",
    hearts: "♥red",
    clubs: "♣black",
    spades: "♠black",
  };
  return suitIcons[suit] || "";
}

function showMessage(msg) {
  if (DEBUG) alert(msg);
  console.log(msg);
} 

function debugLog(...args) {
  if (!DEBUG) return;
  console.log("[DEBUG]", ...args);
}

function traceLog(...args) {
  if (!TRACE) return;
  console.log("[TRACE]", ...args);
}

function getMeldGroupColour(meldGroup) {
  const colours = {
    0: "",
    1: "8px solid blue",
    2: "8px solid blue",
    3: "8px solid blue",
  };
  return colours[meldGroup] || "";
}

function getValueRank(value) {
  const Rank = [ '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King' ];
  if(value < 3 || value > 13) return '???';
  return Rank[value -3];
}

function addEventListeners() {
  console.log("adding EVENT LISTENER");
  // Bind UI handlers immediately if DOM is ready, otherwise wait for DOMContentLoaded.
  const bindHandlers = () => {

    const deckEl = document.getElementById("deck-card");
    if (deckEl) deckEl.addEventListener("click", draw);

    const discardEl = document.getElementById("discard-card");
    if (discardEl) discardEl.addEventListener("click", discard);

    const meldEl = document.getElementById("meld");
    if (meldEl) meldEl.addEventListener("click", Meld);

    const unMeldEl = document.getElementById("unMeld");
    if (unMeldEl) unMeldEl.addEventListener("click", unMeld);

    const NextRoundEl = document.getElementById("NextRound");
    if (NextRoundEl) NextRoundEl.addEventListener("click", NextRound);

    const TestAEl = document.getElementById("TestA");
    if (TestAEl) TestAEl.addEventListener("click", TestA);

    const TestBEl = document.getElementById("TestB");
    if (TestBEl) TestBEl.addEventListener("click", TestB);

    const aiStepEl = document.getElementById("ai-step") || document.getElementById("ai-Step");
    if (aiStepEl) aiStepEl.addEventListener("click", aiStep);

    const debugToggleEl = document.getElementById("debug-toggle");
    if (debugToggleEl) {
      debugToggleEl.addEventListener("change", function (event) {
        DEBUG = Boolean(event.target.checked);
        console.log("DEBUG is now", DEBUG ? "ON" : "OFF");
      });
    }

    const traceToggleEl = document.getElementById("trace-toggle");
    if (traceToggleEl) {
      traceToggleEl.addEventListener("change", function (event) {
        TRACE = Boolean(event.target.checked);
        console.log("TRACE is now", TRACE ? "ON" : "OFF");
      });
    }

    const ScoreBoardEl = document.getElementById("ScoreBoard");
    if (ScoreBoardEl) ScoreBoardEl.addEventListener("click", ScoreBoard);
    
    // Add New Game button logic
    const resumeGameBtn = document.getElementById("resume-game");
    if (resumeGameBtn) {
      resumeGameBtn.addEventListener("click", function () {
        GameBoard();
      });
    }

    // Add New Game button logic
    const newGameBtn = document.getElementById("new-game");
    if (newGameBtn) {
      newGameBtn.addEventListener("click", function () {
        if (
            confirm("Are you sure you want to start a new game? This will erase the current progress.")
          ) {
          setCurrentGameId("");
          localStorage.removeItem("game_state");

          location.reload();
        }
      });
    }
    // Add Game Option button logic
    const newGameStartBtn = document.getElementById("start-game");
    if (newGameStartBtn) {
      newGameStartBtn.addEventListener("click", function () {
        const gameStartOption = document.getElementById("game-options");
        const gameSelectedOption = gameStartOption.value;
      });
    }
  };
  bindHandlers();
}

function  drawDiscardHint() {
  // Implement the logic for draw/discard hint
  //function shouldTakeDiscard(discardCard, hand, wildRank) {
  if (!game.optDrawHint) return;
  if (shouldTakeDiscard(game.discardPile[game.discardPile.length-1], game.currentPlayer.hand, game.roundNumber + 2)) updatePlayerPrompt("Hint: You should take the discard pile card.");
  else updatePlayerPrompt("Hint: You should draw a new card from the deck.");
}


// draw top card from the discard pile
function discard() {
  debugLog("discard clicked", {
    playerIndex: game.currentPlayerIndex,
    discardCount: game.discardPile.length,
  });
  game.currentPlayer = [game.currentPlayerIndex];
  updateCurrentPlayerReference();
  game.currentPlayer = game.players[game.currentPlayerIndex];
  if (game.currentPlayer.hand.length + game.currentPlayer.meldSets.length === game.cardsDealt + 1) {
    showMessage("you have already drawn a card this turn", game.currentPlayer.name);
    return;
  }
  if (game.discardPile.length === 0) {
    const discardCardEl = document.getElementById("discard-card");
    if (discardCardEl) discardCardEl.innerHTML = "";
    const discardCountEl = document.getElementById("discard-card");
    if (discardCountEl) discardCountEl.textContent = "0";
  } else {
    const dcard = game.discardPile.pop();
    game.currentPlayer.hand.push(dcard);
    debugLog("discard draw result", {
      player: game.currentPlayer.name,
      card: `${dcard.rank}-${dcard.suit}`,
      handCount: game.currentPlayer.hand.length,
      discardCount: game.discardPile.length,
    });
    updateDeckAndDiscardDisplay();
  }
  renderPlayerHand(game.currentPlayer);
  applyMeldingStrategy();
  discardHint();
}

function discardHint() {
  if (chooseCardToDiscard(game.currentPlayer.hand,( game.roundNumber+2) , game.finalTurn)) {
    updatePlayerPrompt("Hint: You should discard " + game.currentPlayer.hand[game.currentPlayer.hand.length -1].rank + "-" + game.currentPlayer.hand[game.currentPlayer.hand.length -1].suit);
  } else {
    updatePlayerPrompt("Hint: You should discard " + game.currentPlayer.hand[0].rank + "-" + game.currentPlayer.hand[0].suit);
  }
}

function shouldTakeDiscard(discardCard, hand, wildRank) {
  if (!discardCard) return false;
}

function aiStep() {
 const aiBrakeEl = document.getElementById("ai-step") || document.getElementById("ai-Step")
 if (aiBrakeEl) aiBrakeEl.style.backgroundColor = "";
}

function aiWaitUserOk()
  { return
    confirm("AI has completed this step. Click OK to continue.");
    const aiStepEl = document.getElementById("ai-step") || document.getElementById("ai-Step");
    if (aiStepEl) aiStepEl.style.backgroundColor = "";
  }

function dealHand(player, numCards) {
  for (let i = 0; i < numCards; i++) {
    let card = game.deck.draw();
    player.hand.push(card);
    displayCard(card, player.id + "card" + (i + 1), "hand" );
  }
  renderPlayerHand(player);
}

function setPlayerDrawMode() {
    identifyCurrentPlayer("blue");
    updateCurrentPlayerReference();
    // turn on melding
    changeMeldColor("blue")
    game.currentPlayer.melding = true;
    game.currentPlayer.meldGroup += 1;
    updatePlayerPrompt("Draw a card from the deck or discard pile.");
    drawDiscardHint();
}

function showRoundAndWilds() {
  let WildText = document.getElementById("wild-card");
  if (WildText)
    WildText.textContent =
      " Wild Cards: " + getValueRank(game.roundNumber + 2) + "'s and Joker''s ";
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


function dealNewRoundCards() {
    console.log(`[dealNewRoundCards] Starting - roundNumber=${game.roundNumber}, cardsDealt will be ${game.roundNumber + 2}`);
    game.currentPlayer=game.players[game.currentPlayerIndex];
    game.deck = new Deck(game.roundNumber);
    game.deck.shuffle();
    game.cardsDealt = game.roundNumber + 2;
    console.log(`[dealNewRoundCards] Set cardsDealt=${game.cardsDealt}`);
    displayCardBack("deck-card");
    let drawnCard = game.deck.draw();
    displayCard(drawnCard,"discard-card", "discard"   );
    game.discardPile = []
    game.discardPile.push(drawnCard);
    updateDisplay()
    game.players.forEach((p) => {
      game.currentPlayer = game.players[game.currentPlayerIndex];
      const nameEl = document.getElementById("player" + p.id.substring(1) + "name");
      if (nameEl) nameEl.textContent = p.name;
      p.hand = [];
      p.meldCards = [];
      p.meldSets = [];
      p.meldCount = 0;
      p.roundScore = 0;
      p.IsOut = false;
  /*    p.wildDiscard = wildDiscard;  
      p.wildDraw = wildDraw;
      p.wildCardUse = wildCardUse;
      p.goingOutBonus = goingOutBonus;
      p.aiPlayer = aiPlayer;*/
      dealHand(p, game.cardsDealt);
      identifyActivePlayer("");
      identifyCurrentPlayer("");
      renderPlayerHand(p);
      });
    setPlayerDrawMode()
}

function GameBoard() {
  reLoadGameState(storageKey);
  window.location.href = "index.html";
}

function updatePlayerReference() {
  identifyActivePlayer("bold");
//  const Player = game.players[game.currentPlayer];
  if(game.currentPlayer.aiPlayer) {
    /*
    const myButton = document.getElementById(Player.id + "ai-h");
    let buttonImage = document.createElement("img");
    buttonImage.src = "./android.png";
    buttonImage.alt = "AI in action";
    buttonImage.width = 20;
    buttonImage.height = 20;
    buttonImage.style.backgroundSize = "contain";
    
    myButton.appendChild(buttonImage);
    */
  }
  //else aiEl.style.backgroundColor = "";

  const el = document.getElementById("PlayerId");
  if (el) el.textContent = "Id: " + Player.id;
  const el2 = document.getElementById("PlayerName");
  if (el2) el2.textContent = "Name: " + Player.name;
  const el5 = document.getElementById("PlayerroundScore");
  if (el5) el5.textContent = "roundScore: " + Player.roundScore;
  const el6 = document.getElementById("PlayergameScore");
  if (el6) el6.textContent = "gameScore: " + Player.gameScore;
  const el7 = document.getElementById("PlayerIsOut");
  if (el7) el7.textContent = "IsOut: " + Player.IsOut;
  const el8 = document.getElementById("Playermelding");
  if (el8) el8.textContent = "melding: " + Player.melding;
}

function saveScoreBoard() {
  let wildRank = game.roundNumber + 2;

  function serializeCard(card) {
    if (!card || typeof card !== "object") return card;
    return {
      rank: card.rank,
      suit: card.suit,
      suitColour: card.suitColour,
      value: card.value,
    };
  }

  function getMeldSetCardCount(player) {
    if (!Array.isArray(player?.meldSets)) return 0;
    return player.meldSets.reduce((count, set) => {
      if (!Array.isArray(set)) return count;
      return count + set.length;
    }, 0);
  }

  if (game.roundNumber === 1) game.scoreboardData = []; // Clear scoreboard data at the start of the game
  game.players.forEach((p) => {
    // Ensure gameScore is initialized
    if (p.gameScore === null || p.gameScore === undefined || isNaN(p.gameScore)) {
      p.gameScore = 0;
    }
    let Bonus = 0;
    p.roundScore = 0;
    if (p.IsOut && game.optGoingOutBonus){
      Bonus = -wildRank
      p.roundScore +=  Bonus;
    }
    // Calculate round score using card.value directly
    p.hand.forEach((card) => {
      if (!card || !card.value) {
        console.warn(`[saveScoreBoard] Invalid card in ${p.name}'s hand:`, card);
        return;
      }
      
      if (card.rank === "joker") {
        p.roundScore += 50;
      } else if (card.value === wildRank) {
        p.roundScore += 20;
      } else {
        p.roundScore += card.value;
      }
    });
    
    p.gameScore += p.roundScore;
    // Ensure no NaN values
    if (isNaN(p.roundScore)) p.roundScore = 0;
    if (isNaN(p.gameScore)) p.gameScore = 0;
  });
  
  // Create round object
   roundObj = {
    round: game.roundNumber,
    optGoingOutBonus: Boolean(game.optGoingOutBonus),
    players: game.players.map((p) => {
      const handCount = Array.isArray(p.hand) ? p.hand.length : 0;
      const meldCardCount = getMeldSetCardCount(p);
      const meldSetCount = Array.isArray(p.meldSets) ? p.meldSets.length : 0;

      return ({
        name: p.name,
        IsOut: p.IsOut,
        cards: handCount + meldCardCount,
        wentOutScore: p.wentOutScore ?? 0,
        wentOutBonus: p.IsOut && game.optGoingOutBonus ? -wildRank : 0,
        roundScore: p.roundScore ?? 0,
        gameScore: p.gameScore ?? 0,
        hand: Array.isArray(p.hand) ? p.hand.map((card) => serializeCard(card)) : [],
        handCount,
        meldSets: Array.isArray(p.meldSets)
          ? p.meldSets.map((set) => (Array.isArray(set) ? set.map((card) => serializeCard(card)) : []))
          : [],
        meldCardCount,
        melds: meldSetCount,
      });
    }),
  };
  game.scoreboardData.push(roundObj);
    localStorage.setItem(
      getCurrentScoreboardKey(),
      JSON.stringify(game.scoreboardData),
    );
}

function ScoreBoard() {
    // Save the latest Data to localStorage before navigating
    localStorage.setItem("scoreboard_data", JSON.stringify(game.scoreboardData));
   
    const storedString = localStorage.getItem("scoreboard_data");

    // 2. Convert the JSON string back to a JavaScript object
    const storedObject = JSON.parse(storedString);
    window.location.href = "ScoreBoard.html";
  }

function NextRound() {
  saveScoreBoard();
  // Note: saveScoreBoard is called above for all rounds
  
  // reset blinking for players who went out in previous round
  for (let i = 0; i < game.players.length; i++) {
      PlayerHandBlinkOff("." + game.players[i].id + "card");
    
  }

  console.log(`[NextRound] BEFORE increment: roundNumber=${game.roundNumber}, cardsDealt=${game.cardsDealt}`);
  game.roundNumber +=  1;
  console.log(`[NextRound] AFTER increment: roundNumber=${game.roundNumber}, next cardsDealt will be ${game.roundNumber + 2}`);
  
  if (game.roundNumber > lastRound) {
    // Game is complete - show final scores
    console.log("[NextRound] GAME COMPLETE - Showing final scores");
    disableAIAutoPlay();
    
    const finalScores = game.players
      .map(p => ({ 
        name: p.name, 
        score: isNaN(p.gameScore) ? 0 : (p.gameScore ?? 0) 
      }))
      .sort((a, b) => a.score - b.score);
    
    let message = "🎉 GAME COMPLETE! 🎉\n\nFinal Scores:\n";
    finalScores.forEach((player, idx) => {
      const position = idx === 0 ? "👑 WINNER" : `${idx + 1}${getOrdinalSuffix(idx + 1)} Place`;
      message += `\n${position}: ${player.name} - ${player.score} points`;
    });
    
    alert(message);
    console.log("[NextRound] Final scores:", finalScores);
    
    // Save final state and update directory
    storeGameState(game);
    upsertGamesDirectoryEntry();
    ScoreBoard();
    
  }
  else {
    console.log(`[NextRound] Starting round ${game.roundNumber} with ${game.roundNumber + 2} cards`);
    
    // Reset player states for new round
    game.players.forEach(p => {
      p.IsOut = false;
      p.melding = false;
      p.meldCount = 0;
      p.meldCards = [];
      p.meldSets = [];
    });
    
    dealNewRoundCards();
    showRoundAndWilds();
    game.finalTurn = false;
    
    // If current player is AI and auto-play is enabled, schedule their turn
    if (game.currentPlayer.aiPlayer && aiAutoPlayEnabled && !aiAutoPlayPaused) {
      console.log(`[NextRound] Scheduling AI turn for ${game.currentPlayer.name}`);
      scheduleAITurn(1000);
    }
    }
}

function getMeldGroupColour(meldGroup) {
  const colours = {
    0: "",
    1: "3px solid red",
    2: "3px solid green",
    3: "3px solid blue",
  };
  return colours[meldGroup] || "";
}

function changeMeldColor(colour) {
  const El = document.getElementById("meld");
  El.style.backgroundColor = colour.substring(10);
}

function identifyActivePlayer(fontWeight) {
  let PlayerArg = game.currentPlayer.id + "name";
  let PlayerName = document.getElementById(PlayerArg);
  if (PlayerName) PlayerName.style.fontWeight = fontWeight;
  return;
}
  function PlayerHandBlinkOn(buttonGroup) {
    const buttons = document.querySelectorAll(buttonGroup);
    buttons.forEach(button => {
        button.classList.add('blinking');
    });
}

function PlayerHandBlinkOff(buttonGroup) {
    const buttons = document.querySelectorAll(buttonGroup);
    buttons.forEach(button => {
        button.classList.remove('blinking');
    });
}

function TestAI() {
  const testHand = [kingOfHearts, kingOfSpades, kingOfDiamonds, threeOfClubs, joker];
  const testMeldSets = [[threeOfHearts, fourOfHearts, fiveOfHearts]];
  const shouldUnmeld = window.AIMeldPlanner.shouldUnmeldAndRemeld(testHand, testMeldSets, 5);
  const shouldMeld = window.AIMeldPlanner.shouldAttemptMeld(testHand, testMeldSets, 5);
  console.log("Test AI Meld Strategy:");
  console.log("Should Unmeld & Remeld?", shouldUnmeld);
  console.log("Should Attempt Meld?", shouldMeld);
}

function TestA() { 
//storeGameState(game);
  const card = game.deck.draw();
  game.discardPile.push(card);
  displayCard(card, "discard-card", "discard");
  updateDisplay()
  let x=0
    
}

function TestB() { 
  const dCard = game.discardPile.pop();
  game.deck.cards.push(dCard)
  updateDisplay()
  displayCard(dCard, "discard-card", "discard");
//reLoadGameState(storageKey); 

  let x=0
    
}

function draw() {
  debugLog("draw clicked", {
    player: game.currentPlayer?.name,
    handCount: game.currentPlayer?.hand?.length,
    cardsDealt: game.cardsDealt,
  });
  if (game.currentPlayer.hand.length +
    game.currentPlayer.meldSets.length >= 
    game.cardsDealt + 1){
    showMessage("you have already drawn a card this turn", st);
    return}

  updateCurrentPlayerReference();
  game.currentPlayer = game.players[game.currentPlayerIndex]; 

  const card = game.deck.draw();
  while (!card) {
    console.log("No more cards in the deck");
    shuffleDiscardIntoDeck();
    card = game.deck.draw();
    console.log ("Deck size after shuffling discard in:", game.deck.cards.length);
  }

  game.currentPlayer.hand.push(card);
  debugLog("draw result", {
    player: game.currentPlayer.name,
    card: `${card.rank}-${card.suit}`,
    handCount: game.currentPlayer.hand.length,
    deckCount: game.deck.cards.length,
  });

  renderPlayerHand(game.currentPlayer);
  applyMeldingStrategy( )
  discardHint()
  }

  function Meld() {
  game.currentPlayer = game.players[game.currentPlayerIndex];
  updateCurrentPlayerReference();
  game.currentPlayer = game.players[game.currentPlayerIndex];
  updatePlayerPrompt('');
  if (game.currentPlayer.meldCount === 0) {
    if (game.currentPlayer.melding) {
      game.currentPlayer.melding = false;
      game.currentPlayer.meldGroup -= 1;
      changeMeldColor("");
      return;
    } else {
      game.currentPlayer.melding = true;
      game.currentPlayer.meldGroup += 1;
      changeMeldColor("blue");
      //  changeMeldColor(getMeldGroupColour(game.currentPlayer.meldGroup));
      return;
    }
  }

  // Identify cards in hand flagged for melding.
  const selectedCards = getSelectedMeldCards(game.currentPlayer);

// check if meld is valid, if so move cards from hand to meldSets, if not alert user and reset meldCards and borders  

  const meldResult = validateMeld(selectedCards);
  if (!meldResult.valid) {
    debugLog("meld rejected", {
      player: game.currentPlayer?.name,
      selectedCount: selectedCards.length,
      cards: selectedCards.map((c) => `${String(c.rank)}-${c.suit}`),
    });
    console.warn("[Meld] Invalid selection", {
      player: game.currentPlayer?.name,
      selected: selectedCards.map((c) => `${String(c.rank)}-${c.suit}`),
    });
    alert("Invalid Meld");
    selectedCards=[]
    return;
  }

  if (selectedCards.length > game.cardsDealt) {
    alert(
      `Invalid Meld: too many cards (${selectedCards.length} > ${game.cardsDealt} dealt). Did you include the discard?`,
    );
    // Reset meld mode and clear selections
    const selectedEls = document.querySelectorAll(
      "." + game.currentPlayer.id + "card",
    );
    selectedEls.forEach((el) => {
      if (el.style.border !== "") {
        el.style.border = "";
      }
    });
    selectedCards.forEach((card) => {
      card.styleBorder = "";
    });
    game.currentPlayer.meldCards = [];
    game.currentPlayer.meldCount = 0;
    game.currentPlayer.melding = false;
    game.currentPlayer.meldGroup = Math.max(0, game.currentPlayer.meldGroup - 1);
    return;
  }

  showMessage("Valid Meld");
  debugLog("meld accepted", {
    player: game.currentPlayer?.name,
    selectedCount: selectedCards.length,
    type: meldResult.type,
  });
  let cardsToMeld = [...selectedCards];
  const meldBorder = getMeldGroupColour(game.currentPlayer.meldGroup);

  cardsToMeld.forEach((card) => {
    card.styleBorder = meldBorder;
  });

    const hand = game.currentPlayer.hand;
    const selectedSet = new Set(cardsToMeld);
    game.currentPlayer.hand = hand.filter((handCard) => !selectedSet.has(handCard));

    let selectedEls = document.querySelectorAll("." + game.currentPlayer.id + "card");
    selectedEls.forEach((el) => {
      if (el.style.border != "") {
        el.style.border = "";
      }
    });

    if (cardsToMeld.length > 0) {
      game.currentPlayer.meldCards = cardsToMeld;
      game.currentPlayer.meldSets.push(game.currentPlayer.meldCards);
    }

    if (game.currentPlayer.isAI) {
      // Clear stale AI plan so the next AI cycle can look for another meld.
      game.currentPlayer.aiMeldPlan = null;
      // Prevent repeated unmeld/remeld loops within the same turn.
      game.currentPlayer.aiMeldAttemptedTurn = game.turnCounter || 0;
    }
    game.currentPlayer.meldCount = 0;
    renderPlayerHand(game.currentPlayer);

    if (game.currentPlayer.hand.length === 0) {
      console.log(`[Meld] *** PLAYER GOING OUT *** ${game.currentPlayer.name} has no cards left!`);
      PlayerHandBlinkOn("." + game.currentPlayer.id + "card");
      game.currentPlayer.IsOut = true;
      game.finalTurn = true;
      console.log(`[Meld] Set IsOut=true, finalTurn=true for ${game.currentPlayer.name}`);
   
      if (!game.currentPlayer.aiPlayer && game.AIPlayers !== game.players.length) {
        alert(game.currentPlayer.name + " you have gone out!");
      } else {
        showMessage(game.currentPlayer.name + " you have gone out!");
      }
      advanceTurn()
      
    }
}

function applyMeldingStrategy( ) {

    // PHASE 2: UNMELD & REMELD (if beneficial)
  if (window.AIMeldPlanner.shouldUnmeldAndRemeld(game.currentPlayer.hand, game.currentPlayer.meldSets, (game.roundNumber + 2))) {
      console.log(`${game.currentPlayer.name} unmelding to optimize melds`);
      
      // Unmeld all cards back to hand
      for (let i = 0; i < game.currentPlayer.meldSets.length; i++) {
          for (let k = 0; k < game.currentPlayer.meldSets[i].length; k++) {
              game.currentPlayer.meldSets[i][k].bckgrndColour = "";
              game.currentPlayer.meldSets[i][k].styleBorder = "";
              game.currentPlayer.hand.push(game.currentPlayer.meldSets[i][k]);
          }
      }
      game.currentPlayer.meldSets = [];
      game.currentPlayer.meldCards = [];
      game.currentPlayer.meldCount = 0;
      game.currentPlayer.meldGroup = 0;
      renderPlayerHand(game.currentPlayer);
  }
  
  // PHASE 3: MELD
  if (window.AIMeldPlanner.shouldAttemptMeld(game.currentPlayer.hand, game.currentPlayer.meldSets, (game.roundNumber + 2))) {
      const possibleMelds = window.AIMeldPlanner.findPossibleMelds(game.currentPlayer.hand, (game.roundNumber + 2));
      console.log(`[AI] ${game.currentPlayer.name} found ${possibleMelds.length} possible melds`);
      
      if (possibleMelds.length > 0) {
          const bestMeld = window.AIMeldPlanner.selectBestMeld(possibleMelds, (game.roundNumber + 2));
          
          if (bestMeld) {
              console.log(`[AI] ${game.currentPlayer.name} melding ${bestMeld.size} cards (${bestMeld.type})`);
              
              // Mark cards for melding
              game.currentPlayer.melding = true;
              game.currentPlayer.meldGroup += 1;
              const meldedCount = getMeldedCardCount(game.currentPlayer);
              
              bestMeld.indices.forEach(idx => {
                  const domCardIndex = idx + 1 + meldedCount;
                  const cardEl = document.getElementById(game.currentPlayer.id + "card" + domCardIndex);
                  if (cardEl) {
                      cardEl.style.border = meldingColour; 
                      game.currentPlayer.meldCount += 1;
                  }
              });
            } 
          }       
        }
      }


function unMeld() {
console.log ("unMeld clicked for player:", game.currentPlayer.name);
for (let i = 0; i < game.currentPlayer.meldSets.length; i++) {
  for (let k = 0; k < game.currentPlayer.meldSets[i].length; k++) {

  game.currentPlayer.meldSets[i][k].bckgrndColour = "";
  game.currentPlayer.meldSets[i][k].styleBorder = "";
  game.currentPlayer.hand.push(game.currentPlayer.meldSets[i][k]);}
}
game.currentPlayer.meldSets = [];
game.currentPlayer.meldCards = [];
game.currentPlayer.meldCount = 0;
game.currentPlayer.meldGroup = 0;

for (let i = 0; i < game.currentPlayer.hand.length; i++) {
  game.currentPlayer.hand[i].bckgrndColour = "";
  game.currentPlayer.hand[i].styleBorder = "";
  }
renderPlayerHand(game.currentPlayer);
}


// Validates whether a group of cards forms a legal Five Crowns meld (set or run).
// NOTE: This function only checks if the cards themselves are a valid meld.
// It does NOT enforce the mandatory discard rule. A player can never meld their
// entire hand — at least 1 card must always remain to discard at end of turn.
// The mandatory discard rule is enforced by selectBestMeld() in aiMeldPlanner.js
// which filters out any meld where remainingCards === 0.
function validateMeld(group, options = {}) {
  const silent = Boolean(options.silent);
  
  if (!group || group.length < 3) {
    if (!silent) showMessage("[validateMeld] Invalid: less than 3 cards");
    return { valid: false };
  }
  const wildRank = String(game.roundNumber + 2);
  const jokers = group.filter(
    (c) => c.rank === "joker" || c.rank === wildRank,
  );
  const nonJokers = group.filter(
    (c) => c.rank !== "joker" && c.rank !== wildRank,
  );
  const rankValue = (r) => {
    if (r === "jack") return 11;
    if (r === "queen") return 12;
    if (r === "king") return 13;
    return Number(r);
  };
  const ranks = nonJokers.map((c) => c.rank);
  const suitsArr = nonJokers.map((c) => c.suit);
  const uniqueRanks = [...new Set(ranks)];
  const uniqueSuits = [...new Set(suitsArr)];
  
  if (!silent) {
    showMessage(
      "[validateMeld] Attempted meld:",
      group.map((c) => `${c.rank}-${c.suit}`),
    );
  }
  
  if (uniqueRanks.length === 0 && uniqueSuits.length === nonJokers.length) {
    if (!silent) showMessage("[validateMeld] Valid set");
    return { valid: true, type: "set" };
  }
  if (
    nonJokers.length > 0 &&
    uniqueRanks.length === 1 &&
    group.length >= 3 &&
    nonJokers.length + jokers.length === group.length
  ) {
    if (!silent) showMessage("[validateMeld] Valid set (with wilds/jokers)");
    return { valid: true, type: "set" };
  }
  if (uniqueSuits.length === 1) {
    let values = nonJokers
      .map((c) => rankValue(c.rank))
      .sort((a, b) => a - b);
    let gaps = 0;
    for (let i = 1; i < values.length; i++) {
      gaps += values[i] - values[i - 1] - 1;
    }
    if (!silent) {
      showMessage(
        `[validateMeld] Run gaps: ${gaps}, jokers: ${jokers.length}`,
      );
    }
    if (gaps <= jokers.length) {
      if (!silent) showMessage("[validateMeld] Valid run");
      return { valid: true, type: "run" };
    } else {
      if (!silent) showMessage("[validateMeld] Invalid run: too many gaps");
    }
  } else {
    if (!silent) showMessage("[validateMeld] Invalid run: not all same suit");
  }
  if (!silent) showMessage("[validateMeld] Invalid meld");
  return { valid: false };
}
 
 function advanceTurn(options = {}) {

  if (game.currentPlayerIndex !== -1) {
    updatePlayerReference();
    identifyCurrentPlayer("");
    updatePlayerPrompt('');
  }

  // Advance to next player
  const previousPlayerIndex = game.currentPlayerIndex;
  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
  game.currentPlayer = game.players[game.currentPlayerIndex];
  
  console.log(`[advanceTurn] Advanced from player ${previousPlayerIndex} to ${game.currentPlayerIndex} (${game.currentPlayer.name})`);
  console.log(`[advanceTurn] Player state: AI=${game.currentPlayer.aiPlayer}, IsOut=${game.currentPlayer.IsOut}, finalTurn=${game.finalTurn}, hand=${game.currentPlayer.hand.length} cards`);

  // If we've returned to a player who is out, the round is over
  if (game.currentPlayer.IsOut) {
    console.log(`[advanceTurn] *** ROUND ENDING *** Returned to player who went out (${game.currentPlayer.name}). Calling NextRound().`);
    NextRound();
    return;
  }
  
  game.turnCounter = (game.turnCounter || 0) + 1;
  setPlayerDrawMode();

  // Check if player has no cards - this should only happen at game start
  // During normal play, players should always have cards after drawing
  if (game.currentPlayer.hand.length === 0 && !game.finalTurn && game.roundNumber === 1) {
    console.log(`[advanceTurn] Player has no cards at game start, dealing initial round`);
    dealNewRoundCards();
  }
  
  if (game.currentPlayer.aiPlayer && aiAutoPlayEnabled && !aiAutoPlayPaused) {
    console.log(`[advanceTurn] Scheduling AI turn for ${game.currentPlayer.name}`);
    scheduleAITurn(500);
  } else {
    console.log(`[advanceTurn] NOT scheduling AI turn: aiPlayer=${game.currentPlayer.aiPlayer}, autoPlayEnabled=${aiAutoPlayEnabled}, paused=${aiAutoPlayPaused}`);
  }
 }



function XGameState(game) {
// Only save serializable properties
  const stateToSave = {
    cardWidth: game.cardWidth,
    currentPlayer: game.currentPlayer,
    cardHeight: game.cardHeight,
    roundNumber: game.roundNumber,
    scoreboardData: game.scoreboardData,
    dealerIndex: game.dealerIndex,
    activePlayer: game.activePlayer,
    cardsDealt: game.cardsDealt,
    deck: game.deck.cards,
    players: game.players.map((p) => (  { 
      id: p.id,
      name: p.name,
      gameScore: p.gameScore,
      roundScore: p.roundScore,
      hand: p.hand,
      meldSets: p.meldSets,
      meldCount: p.meldCount,
      melding: p.melding,
      IsOut: p.IsOut,
      wildDiscard: p.wildDiscard,  
      wildDraw: p.wildDraw,
      wildCardUse: p.wildCardUse,
      goingOutBonus: p.goingOutBonus,
      aiPlayer: p.aiPlayer
    })),
    discardPile: game.discardPile,
    scoreboardData: game.scoreboardData,
    // Add other game properties as needed
  };

  //console.log(JSON.stringify(stateToSave));
  localStorage.setItem("game_state", JSON.stringify(stateToSave));

  game.players.forEach((p) => {
  console.log(`Player: ${p.name} (ID: ${p.id})`);
  // Stringify makes the card objects readable
  console.log("Hand:", JSON.stringify(p.hand, null, 2)); 
  });
  const storageKey = getCurrentGameStorageKey(true);
  localStorage.setItem(storageKey, JSON.stringify(stateToSave));
  upsertGamesDirectoryEntry();

}


 


function xrestoreGameState(storageKey) {

  console.log("Restoring game state from localStorage...");
  const resolvedKey = storageKey || getCurrentGameStorageKey();
  const saved = localStorage.getItem(resolvedKey);
  if (saved) 
    {
    const state = JSON.parse(saved);
    console.log("Restoring game state from localStorage...");
  
    storageKey = getCurrentGameStorageKey();

    game.roundNumber = state.roundNumber;
    game.dealerIndex = state.dealerIndex;
    game.currentPlayer = state.currentPlayer;
    game.cardsDealt = state.cardsDealt;
    game.players = []; // Clear existing players before restoring

    // Restore players
    if (Array.isArray(state.players)) {

      for (let i = 0; i < state.players.length; i++) {
          game.addPlayer(state.players[i].id, state.players[i].name);
          let pSuffix = state.players[i].id;
          pSuffix = pSuffix.charAt(pSuffix.length - 1);
          const nameEl = document.getElementById("player" + pSuffix + "name");
          nameEl.textContent = state.players[i].name;
          
          const savedGameScore = state.players[i].gameScore;
          const savedgoingOutBonus = state.players[i].goingOutBonus;
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
                  cardObj.bckgrndColour)
                )
              
          // Rehydrate meldSets to Card instances
      
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
                        cardObj.bckgrndColour
                      )
                  )
                : []
            );
          
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
                  cardObj.bckgrndColour
                )
            );
          }

          console.log(
            `${game.players[i].id}-${game.players[i].name} hand:`,
            game.players[i].hand.map((c) => `${c.rank}-${c.suit}`)
          );
          console.log(
            `${game.players[i].id}-${game.players[i].name} melds:`,
            game.players[i].meldCards.map((c) => `${c.rank}-${c.suit}`)
          );
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
          displayCardBack("deck")
          const drawnCard = game.discardPile.pop();
          updateDisplay()
          displayCard(drawnCard, "discard-card", "discard"   );
          game.discardPile.push(drawnCard);
          updateDisplay()
        game.players.forEach((p) =>  renderPlayerHand(p));
      };
  
  
    game.currentPlayer = game.players[game.currentPlayerIndex];
      
    restoredState = true;
    game.newRound = false;
    console.log("Game state restored from localStorage.");  

      }
  else
    {
      logInPlayers()
    }
  }
  function updatePlayerPrompt(msg) {
  const promptEl = document.getElementById(game.currentPlayer.id + "prompt")
  if (promptEl) promptEl.textContent = msg;
  }

function identifyCurrentPlayer(colour) {
  game.currentPlayer = game.players[game.currentPlayerIndex];
  let pSuffix = game.currentPlayer.id
  pSuffix = pSuffix.charAt(pSuffix.length - 1);
  const nameEl = document.getElementById("player" + pSuffix + "name");
  nameEl.textContent = game.currentPlayer.name;
  nameEl.style.backgroundColor = colour;
}
  addEventListeners()
  function changeMeldColor(colour) {
  const El = document.getElementById("meld");
  if (El) {
  El.style.backgroundColor = colour;
  }
}

function showRoundAndWilds() {
  let WildText = document.getElementById("wild-card");
  if (WildText)
    WildText.textContent ="round: " + game.roundNumber +
      " Wild Cards: " + getValueRank(game.roundNumber + 2) + "'s and Joker''s ";
}


function loadAIAutoPlayState() {
  const stored = localStorage.getItem(AI_AUTO_PLAY_STORAGE_KEY);
  if (stored === "true") {
    aiAutoPlayEnabled = true;
    const checkbox = document.getElementById("ai-auto-play");
    if (checkbox) checkbox.checked = true;
    return true;
  }
  aiAutoPlayEnabled = false;
  return false;
}
//=======================================================

function updateDisplay() {
    const deckCardsEl = document.getElementById('deck-count');
    const discardCardsEl = document.getElementById('discard-count');
    if (deckCardsEl) {
      deckCardsEl.innerText =''
      deckCardsEl.innerText = `${game.deck.cards.length}`;
    }
    if (discardCardsEl) 
    {
      discardCardsEl.innerText = ''
      discardCardsEl.innerText = `${game.discardPile.length}`;   
      if (game.discardPile.length === 0) {
        discardCardsEl = document.getElementById('discard-card');
        discardCardsEl.innerText = ''
        
      }

    }
    
function shuffleDiscardIntoDeck() {
    // 1. Add all cards from the discard pile to the main deck
    while( game.discardPile.length> 3) 
      game.deck.push(game.discardPile.pop()); 
    

    // 2. Shuffle the entire deck using the Fisher-Yates algorithm
    game.deck.shuffle(); 

    console.log("Discard pile shuffled into the deck. New deck size:", game.deck.cards.length);
}

