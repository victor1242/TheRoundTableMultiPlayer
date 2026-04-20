// Utility and helper functions for Five CrownsdataArray

let DEBUG = false;
let TRACE = false;
let restoredState = false;
let useIcons = true;

function logInPlayers() {
  if (game.players.length >= 3) return; // Players already logged in
  game.addPlayer("p1", "Victor");
  game.addPlayer("p2", "Alice");
  game.addPlayer("p3", "Bob");

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

function getValueRank(value) {
  const Rank = [ '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King' ];
  if(value < 3 || value > 13) return '???';
  return Rank[value -3];
}

function addEventListeners() {
  console.log("adding EVENT LISTENER");
  // Bind UI handlers immediately if DOM is ready, otherwise wait for DOMContentLoaded.
  const bindHandlers = () => {
    const deckEl = document.getElementById("deck");
    if (deckEl) deckEl.addEventListener("click", draw);

    const discardEl = document.getElementById("discard");
    if (discardEl) discardEl.addEventListener("click", discard);

    const meldEl = document.getElementById("meld");
    if (meldEl) meldEl.addEventListener("click", Meld);

    const unMeldEl = document.getElementById("unMeld");
    if (unMeldEl) unMeldEl.addEventListener("click", unMeld);

    const NextRoundEl = document.getElementById("NextRound");
    if (NextRoundEl) NextRoundEl.addEventListener("click", NextRound);

    const TestEl = document.getElementById("Test");
    if (TestEl) TestEl.addEventListener("click", Test);

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
  };
  bindHandlers();
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
    updateCurrentPlayerReference();
    // turn on melding
    changeMeldColor("blue")
    game.currentPlayer.melding = true;
    game.currentPlayer.meldGroup += 1;
    updatePlayerPrompt("Draw a card from the deck or discard pile.");
}


function showRoundAndWilds() {
  let WildText = document.getElementById("wild-card");
  if (WildText)
    WildText.textContent =
      " Wild Cards: " + getValueRank(game.roundNumber + 2) + "'s and Joker''s ";
}

function dealNewRoundCards() {

    game.currentPlayer=game.players[game.currentPlayerIndex];
    game.deck = new Deck(game.roundNumber);
    game.deck.shuffle();
    //game.discardPile = [];
    game.cardsDealt = game.roundNumber + 2;
    displayCardBack("deck");
    let drawnCard = game.deck.draw();
    displayCard(drawnCard, "discard", "discard"   );
    game.discardPile.push(drawnCard);
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
      dealHand(p, game.cardsDealt);
      identifyActivePlayer("");
      identifyCurrentPlayer("");
      renderPlayerHand(p);
      });

    setPlayerDrawMode()
}

function GameBoard() {
  restoreGameState();
  window.location.href = "index.html";
}

function updatePlayerReference() {
  Player = identifyActivePlayer("bold");
  Player = game.players[game.activePlayer];
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
  if (game.roundNumber === 1) game.scoreboardData = []; // Clear scoreboard data at the start of the game
  game.players.forEach((p) => {
    // Ensure gameScore is initialized
    if (p.gameScore === null || p.gameScore === undefined || isNaN(p.gameScore)) {
      p.gameScore = 0;
    }
    p.roundScore = 0;
    
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
    players: game.players.map((p) => ({
      name: p.name,
      IsOut: p.IsOut,
      cards: game.players(p).lenght +game.players
      roundScore: p.roundScore ?? 0,  
      gameScore: p.gameScore ?? 0,
      hand: Array.isArray(p.hand)
        ? p.hand.map((c) => formatScoreboardCard(c)).join(" ")
        : "",
      melds: Array.isArray(p.meldSets)
        ? p.meldSets
            .map((meld) =>
              Array.isArray(meld) && meld.length > 0
                ? meld
                    .map((c) => formatScoreboardCard(c))
                    .join(" ")
                : "",
            )
            .filter((s) => s.length > 0)
            .join(" | ")
        : "",
    })),
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
  if (!game.roundNumber === 0) saveScoreBoard();
  game.roundNumber +=  1;
  console.log(`[NextRound] Round advanced to ${game.roundNumber}`);
  
  if (game.roundNumber > 11) {
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
    saveGameState();
    upsertGamesDirectoryEntry();
    
  }
  else {
    console.log(`[NextRound] Starting round ${game.roundNumber}`);
    dealNewRoundCards();
    showRoundAndWilds();
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

function Test() {
 // dealNewRoundCards();
//saveScoreBoard()
//saveGameState();
//restoreGameState(); 
  
}

function draw() {
  if (game.currentPlayer.hand.length +
    game.currentPlayer.meldSets.length >= 
    game.cardsDealt + 1){
    showMessage("you have already drawn a card this turn", game.currentPlayer.name);
    return}

  updateCurrentPlayerReference();
  game.currentPlayer = game.players[game.currentPlayerIndex]; 

  const card = game.deck.draw();
  game.currentPlayer.hand.push(card);
  recordDraw("deck", card, game.currentPlayer);
  game.currentPlayer.lastDrawnCard = card;
  game.currentPlayer.lastDrawnSource = "deck";
  renderPlayerHand(game.currentPlayer);
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
    console.warn("[Meld] Invalid selection", {
      player: game.currentPlayer?.name,
      selected: selectedCards.map((c) => `${String(c.rank)}-${c.suit}`),
    });
    alert("Invalid Meld");
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
      game.currentPlayer.isOut = true;
      identifyCurrentPlayer("red")
   
      if (!game.currentPlayer.isAI && game.AIPlayers !== game.players.length) {
        alert(game.currentPlayer.name + " you have gone out!");
      } else {
        showMessage(game.currentPlayer.name + " you have gone out!");
      }
      advanceTurn()
      
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

renderPlayerHand(game.currentPlayer);
}


function validateMeld(group) {
  if (!group || group.length < 3) {
    showMessage("[validateMeld] Invalid: less than 3 cards");
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
  showMessage(
    "[validateMeld] Attempted meld:",
    group.map((c) => `${c.rank}-${c.suit}`),
  );
  if (uniqueRanks.length === 0 && uniqueSuits.length === nonJokers.length) {
    showMessage("[validateMeld] Valid set");
    return { valid: true, type: "set" };
  }
  if (
    nonJokers.length > 0 &&
    uniqueRanks.length === 1 &&
    group.length >= 3 &&
    nonJokers.length + jokers.length === group.length
  ) {
    showMessage("[validateMeld] Valid set (with wilds/jokers)");
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
    showMessage(
      `[validateMeld] Run gaps: ${gaps}, jokers: ${jokers.length}`,
    );
    if (gaps <= jokers.length) {
      showMessage("[validateMeld] Valid run");
      return { valid: true, type: "run" };
    } else {
      showMessage("[validateMeld] Invalid run: too many gaps");
    }
  } else {
    showMessage("[validateMeld] Invalid run: not all same suit");
  }
  showMessage("[validateMeld] Invalid meld");
  return { valid: false };
}
 
 function advanceTurn(options = {}) {

  if (game.currentPlayerIndex !== -1) {
    identifyCurrentPlayer("");
    updatePlayerPrompt('');
  }
     // Advance to next player
  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
  game.currentPlayer = game.players[game.currentPlayerIndex];

  if (game.currentPlayer.IsOut) {
    console.log("All players have had their final turn. End of round.");
   
    NextRound();

  }
  else
  {  game.turnCounter = (game.turnCounter || 0) + 1;
  setPlayerDrawMode();
  }
 }

function saveGameState() {
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
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      gameScore: p.gameScore,
      roundScore: p.roundScore,
      hand: Array.isArray(p.hand) ? p.hand.map((card) => ({ ...card })) : [],
      meldCards: Array.isArray(p.meldCards) ? p.meldCards.map((card) => ({ ...card })) : [],
      meldSets: Array.isArray(p.meldSets) ? p.meldSets.map((set) => Array.isArray(set) ? set.map((card) => ({ ...card })) : []) : [],
      meldCount: p.meldCount,
      melding: p.melding,
      IsOut: p.IsOut,
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

function restoreGameState(storageKey) {
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

function validateMeld(group, options = {}) {
  const silent = Boolean(options.silent);
  if (!group || group.length < 3) {
    if (!silent) showMessage("[validateMeld] Invalid: less than 3 cards");
    return { valid: false };
  }
  const wildValue = game.roundNumber + 2;
  const rankStr = (r) => String(r).toLowerCase();
  const wilds = group.filter((c) => {
    const r = rankStr(c.rank);
    return r === "joker" || c.value === wildValue;
  });
  const nonWilds = group.filter(
    (c) => {
      const r = rankStr(c.rank);
      return r !== "joker" && c.value !== wildValue;
    },
  );
  const rankValue = (r) => {
    const val = rankStr(r);
    if (val === "jack") return 11;
    if (val === "queen") return 12;
    if (val === "king") return 13;
    return Number(val);
  };
  const ranks = nonWilds.map((c) => rankValue(c.rank));
  const suitsArr = nonWilds.map((c) => c.suit);
  const uniqueRanks = [...new Set(ranks)];
  const uniqueSuits = [...new Set(suitsArr)];
  if (!silent) {
    showMessage(
      "[validateMeld] Attempted meld:",
      group.map((c) => `${rankStr(c.rank)}-${c.suit}`),
    );
  }
  if (uniqueRanks.length === 0 && uniqueSuits.length === nonWilds.length) {
    if (!silent) showMessage("[validateMeld] Valid set");
    return { valid: true, type: "set" };
  }
  if (
    nonWilds.length > 0 &&
    uniqueRanks.length === 1 &&
    group.length >= 3 &&
    nonWilds.length + wilds.length === group.length
  ) {
    if (!silent) showMessage("[validateMeld] Valid set (with wilds)");
    return { valid: true, type: "set" };
  }
  if (uniqueSuits.length === 1) {
    let values = nonWilds.map((c) => rankValue(c.rank)).sort((a, b) => a - b);
    let gaps = 0;
    for (let i = 1; i < values.length; i++) {
      gaps += values[i] - values[i - 1] - 1;
    }
    if (!silent) {
      showMessage(`[validateMeld] Run gaps: ${gaps}, wilds: ${wilds.length}`);
    }
    if (gaps <= wilds.length) {
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

function bindAIPauseButton() {
  const pauseAiBtn = document.getElementById("ai-pause");
  if (!pauseAiBtn || aiPauseButtonBound) return;
  pauseAiBtn.addEventListener("click", () => {
    if (aiAutoPlayPaused) {
      resumeAIAutoPlay();
    } else {
      pauseAIAutoPlay();
    }
  });
  aiPauseButtonBound = true;
  updateAIPauseButton();
  updateAIStepButton();
}