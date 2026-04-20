// Utility and helper functions for Five CrownsdataArray

let DEBUG = false;
let TRACE = false;
let restoredState = false;
let useIcons = true;

function logInPlayers() {
  // Only add players if not already present (prevents overwriting restored state)
  if (!game.players || game.players.length === 0) {
    game.addPlayer("p1", "Victor");
    game.addPlayer("p2", "Alice");
    game.addPlayer("p3", "Bob");
  }
  const p1name = document.getElementById("p1name");
  if (p1name) p1name.textContent = "Victor";

  const p2name = document.getElementById("p2name");
  if (p2name) p2name.textContent = "Alice";

  const p3name = document.getElementById("p3name");
  if (p3name) p3name.textContent = "Bob";


}

window.logInPlayers = logInPlayers;
function getSuitIcon(suit) {
  const suitIcons = {
    stars: "★gold",
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
  const RankValues = {
    "3":3,
    "4":4,
    "5":5,
    "6":6,
    "7":7,
    "8":8,
    "9":9,
    "10":10,
    "jack":11,
    "queen":12,
    "king":13 ,
  };
  return RankValues[value]; 
}

function addEventListeners() {
  window.addEventListener("DOMContentLoaded", function () {
  console.log("Adding hand card listeners...");
  for (let i = 1; i <= game.players.length; i++) {
    let arg = ".p" + i + "card";
    const els = document.querySelectorAll(arg);
    els.forEach((el) => {
      // Remove any existing click listeners by replacing the element
      const newEl = el.cloneNode(true);
      el.parentNode.replaceChild(newEl, el);
      newEl.addEventListener("click", function handleClick(event) {
        console.log("box clicked", event.currentTarget.id, game.activePlayer);
        console.log("Image Source:", event.currentTarget.className);
        // hand card clicks

        const className = event.currentTarget.className;
        // hand click
        let relative = game.activePlayer + 1;
        if (className !== "p" + relative + "card") return;

        const Player = game.players[game.activePlayer];
        if (Player.melding) {
          // in melding mode - toggle border to select/deselect for meld
          if (event.currentTarget.style.border === "") {
            event.currentTarget.style.border = getMeldGroupColour(
              Player.meldGroup,
            );
            Player.meldCount += 1;
          } else {
            event.currentTarget.style.border = "";
            Player.meldCount -= 1;
          }
        } else {
          let ElementId = event.currentTarget.id;
          let cardIndex = ElementId.substring(6);
          let cardIndexInt = Number(cardIndex) - 1;
          let xCard = Player.hand.splice(
            cardIndexInt - Player.meldCards.length,
            1,
          )[0];
          showMessage(xCard.rank + " of " + xCard.suit + " discarded.");
          renderPlayerHand(Player);
          game.discardPile.unshift(xCard);
          displayCard(xCard, "discard");

          Player.canDraw = false;
          Player.canDiscard = false;

          advanceTurn();
        }
      });
    });
    }
  };
}

  
function showRoundAndWilds() {
    let WildText = document.getElementById("wild-card");
  if (WildText)
    WildText.textContent =
      " Wild Cards: " + getValueRank(game.roundNumber + 2) + "'s and Joker''s ";
}

function addEventListeners() {
    // window.addEventListener("DOMContentLoaded", function () {
      const deckEl = document.getElementById("deck");
      if (deckEl) deckEl.addEventListener("click", draw);

      const discardEl = document.getElementById("discard");
      if (discardEl) discardEl.addEventListener("click", discard);

      const meldEl = document.getElementById("meld");
      if (meldEl) meldEl.addEventListener("click", Meld);

      const NextRoundEl = document.getElementById("NextRound");
      if (NextRoundEl) NextRoundEl.addEventListener("click", NextRound);

      const TestEl = document.getElementById("Test");
      if (TestEl) TestEl.addEventListener("click", Test);

      const ScoreBoardEl = document.getElementById("ScoreBoard");
      if (ScoreBoardEl) ScoreBoardEl.addEventListener("click", ScoreBoard);
    }

function GameBoard() {
  restoreGameState();
  window.location.href = "index.html";
}

function UpdatePlayerReference() {
  Player = identifyActivePlayer("bold");
  Player = game.players[game.activePlayer];
  const el = document.getElementById("PlayerId");
  if (el) el.textContent = "Id: " + Player.id;
  const el2 = document.getElementById("PlayerName");
  if (el2) el2.textContent = "Name: " + Player.name;
  const el3 = document.getElementById("PlayercanDraw");
  if (el3) el3.textContent = "canDraw: " + Player.canDraw;
  const el4 = document.getElementById("PlayercanDiscard");
  if (el4) el4.textContent = "canDiscard: " + Player.canDiscard;
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
    game.players.forEach((p) => {
      p.roundScore = 0;
      let CardsInHand = p.hand.map((c) => `${c.rank}`);
      CardsInHand.forEach((cardRank) => {
        if (Number(getValueRank(cardRank)) === wildRank) {
          p.roundScore += 20;
        } else {
          if (cardRank === "joker") {
            p.roundScore += 50;
          } else {
            let RVal = Number(getValueRank(cardRank));
            p.roundScore += RVal;
          }
        }
      });
      p.gameScore += p.roundScore;
    });
  // Create round object
  const roundObj = {
    round: game.roundNumber,
    players: game.players.map((p) => ({
      name: p.name,
      gameScore: p.gameScore,
      roundScore: p.roundScore,
      hand: typeof useIcons !== 'undefined' && useIcons
        ? p.hand.map((c) => `${c.rank ?? " "}-${getSuitIcon(c.suit).slice(0,1) ?? " "}`).join(" ")
        : p.hand.map((c) => `${c.rank ?? " "}-${c.suit ?? " "}`).join(" "),
      melds: Array.isArray(p.meldSets)
        ? p.meldSets
            .map((meld) =>
              Array.isArray(meld) && meld.length > 0
                ? meld.map((c) => `${c.rank ?? " "}-${getSuitIcon(c.suit).slice(0,1) ?? " "}`).join(" ")
                : "",
            )
            .filter((s) => s.length > 0)
            .join(" | ")
        : "",
    })),
  };
  game.scoreboardData.push(roundObj);
  localStorage.setItem("scoreboard_data", JSON.stringify(game.scoreboardData));
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
  game.roundNumber += 1;
  if (game.roundNumber > 11) {
    showMessage("Game over! Maximum rounds reached.");
    return;
  }
  game.cardsDealt = game.roundNumber + 2;
  game.dealerIndex = (game.dealerIndex + 1) % game.players.length;
  game.activePlayer = (game.dealerIndex + 1) % game.players.length;
  game.players[game.activePlayer].canDraw= true;

  // Update round number UI immediately after increment
  let roundNumber = document.getElementById("round-number");
  if (roundNumber)
    roundNumber.textContent = "Round: " + String(game.roundNumber);

  showRoundAndWilds();


  if (game.deck.cards.length < 116) {
    game.deck = new Deck();
    game.deck.shuffle();
    showMessage("Deck reshuffled for new round.");
  }

  game.players.forEach((p) => {
    p.hand = [];
    p.canDiscard = false;
    p.melding = false;
    p.meldCount = 0;
    p.meldGroups = 0;
    p.meldCards = [];
    p.meldSetRun = [[]];
    p.IsOut = false;


    for (let i = 0; i < game.cardsDealt; i++) {
      let card = game.deck.draw();
      p.hand.push(card);
      displayCard(card, p.id + "card" + (i + 1));
    }
  });

  game.players[game.activePlayer].canDraw = true;
  game.players[game.activePlayer].canDiscard = false;
  const NextPlayer = (game.activePlayer + 1) % game.players.length;
  alert(
    "Round: " +
      game.roundNumber +
      " - " +
      game.players[NextPlayer].name +
      "'s turn to draw .",
  );

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
  let Player =game.players[game.activePlayer];
  let PlayerArg = Player.id + "name";
  let PlayerName = document.getElementById(PlayerArg);
  if (PlayerName) PlayerName.style.fontWeight = fontWeight;
  return Player;
}

function Test() {
  saveScoreBoard() ;
 //   saveGameState(); 
  /*

  console.log("local storage");
  for (i = 0; i < localStorage.length; i++) {
    console.log(
      localStorage.key(i) +
        "=[" +
        localStorage.getItem(localStorage.key(i)) +
        "]",
    );
  }
  console.info    ("Test function called.");
  */
}

function draw() {
  UpdatePlayerReference();
  if (Player.canDraw) {
    const card = game.deck.draw();
    Player.hand.push(card);
    // after drawing, disable further draws and enable discard
    Player.canDraw = false;
    Player.canDiscard = true;
    renderPlayerHand(Player);
 //   displayCard(card, Player.id + "card" + Player.hand.length);
  } else {
    if (Player.meldCount === game.roundNumber + 2) {
      alert(Player.name + " you have melded all your cards and gone out!");
    } else {
      alert(Player.name + " you have already drawn a card this turn");
    }
  }
}

  function Meld() {
    UpdatePlayerReference();
    if (Player.canDraw) {
      alert("You must draw a card before melding");
      return;
    }
    if (Player.meldCount === 0) {
      if (Player.melding) {
        Player.melding = false;
        Player.meldGroup -= 1;
        changeMeldColor("0");
        return;
      } else {
        Player.melding = true;
        Player.meldGroup += 1;
        changeMeldColor(getMeldGroupColour(Player.meldGroup));
        return;
      }
    }
    Player.meldCards = [];
    let arg = "." + Player.id + "card";
    let els = document.querySelectorAll(arg);
    els.forEach((el) => {
      let El = document.getElementById(el.id);
      if (El.style.border != "") {
        let img = El.querySelector("img");
        let altText = img ? img.alt : "";
        let ScrnRef = El.id;
        let meldCardrank = altText.split("-")[0];
        let meldCardsuit = altText.split("-")[1];
        let value = getValueRank(meldCardrank);
        let wild = meldCardrank === "joker" || value === game.cardsDealt;
        let wildValue =
          meldCardrank === "joker" ? 50 : value === game.cardsDealt ? 20 : 0;
        let styleBorder = getMeldGroupColour(Player.meldGroup);
        let bckgrndColour = getMeldGroupColour(Player.meldGroup);
        let NewMeldCard = new Card(
          meldCardsuit,
          getSuitIcon(meldCardsuit).slice(0, 1),
          getSuitIcon(meldCardsuit).slice(1),
          meldCardrank,
          value,
          wild,
          wildValue,
          ScrnRef,
          styleBorder,
          bckgrndColour,
        );
        Player.meldCards.push(NewMeldCard);
      }
    }); // <-- Close the forEach here

    let handMeldIndex = 0;
    if (validateMeld(Player.meldCards).valid) {
      showMessage("Valid Meld");
      // Remove meld cards from hand
      for (let i = -0; i < game.cardsDealt + 1; i++) {
        arg = Player.id + "card" + (i + 1);
        let El = document.getElementById(arg);
        if (El.style.border != "") {
          El.style.border = "";
          Player.hand.splice(handMeldIndex, 1);
        } else handMeldIndex += 1;
      }
      Player.meldSets=[]
      Player.meldSets.push(Player.meldCards);
      Player.melding = false;
      changeMeldColor("0");
      renderPlayerHand(Player);
      if (Player.hand.length === 1) {
        Player.IsOut = true;
        alert(Player.name + " you have gone out!");
      }         
  }
   else alert("Invalid Meld");
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



 // draw top card from the discard pileL
 function discard() {
  UpdatePlayerReference();
   if (Player.canDraw) {
     const card = game.discardPile.shift();
     if (game.discardPile.length === 0) {
       document.getElementById("discard").innerHTML = "";
     }
     Player.hand.push(card);
     Player.canDraw = false;
     Player.canDiscard = true;
     displayCard(
       card,
       Player.id +
         "card" +
         Player.hand.length,
     );
   } else {
     alert(Player.name + " you have already drawn a card this turn");
   }
 }
 
 function advanceTurn() {
   let PlayerName = "";
   if (game.activePlayer !== -1) {
     identifyActivePlayer("normal");
     game.activePlayer = (game.activePlayer + 1) % game.players.length;
     Player = game.players[game.activePlayer];

     UpdatePlayerReference();
     game.players.forEach((p) => {
       p.canDiscard = false;
       p.melding = false;

     });
     Player.canDraw = true;
     Player.canDiscard = false;
   }

   console.log(
     "startRound: GameRound=",
     game.roundNumber+1,
     "Deck size=",
     game.deck.cards.length,
   );

   game.players.forEach((p, idx) =>
     console.log(
       `player[${idx}] ${p.name} hand length:`,
       p.hand.length,
       p.hand.map((c) => `${c.rank}-${c.suit}`),
     ),
   );
   
   if (Player.IsOut)
    {
  
      saveScoreBoard() 
      saveGameState();
      NextRound();}
 //  else {
  //   PlayerName = Player.name;
 //    alert("Round: " + game.roundNumber + " - " + PlayerName + "'s turn to draw.//");
 //  }

   if (!Player.canDraw)
         console.log("advanceTurn: canDraw is false. Should be true!");
    }
function saveGameState() {
  // Only save serializable properties
  const stateToSave = {
    cardWidth: game.cardWidth,
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
      melds: Array.isArray(p.melds) ? p.melds.map((card) => ({ ...card })) : [],
      meldCount: p.meldCount,
      canDraw: p.canDraw,
      canDiscard: p.canDiscard,
      melding: p.melding,
      IsOut: p.IsOut,
      melds: Array.isArray(p.meldCards)
        ? p.meldCards.map((card) => ({ ...card }))
        : [],
    })),
    discardPile: game.discardPile,
    scoreboardData: game.scoreboardData,
    // Add other game properties as needed
  };
  localStorage.setItem("game_state", JSON.stringify(stateToSave));
}
}