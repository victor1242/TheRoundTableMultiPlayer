
// This file has been split into classes.js, functions.js, and main.js for better organization.
// Please see those files for the code.
class Deck {
  constructor() {
    this.cards = [];
    // Assuming suits and ranks are defined elsewhere or should be defined here
    const suits = ["hearts", "clubs", "diamonds", "spades", "stars"];
    const ranks = [3, 4, 5, 6, 7, 8, 9, 10, "jack", "queen", "king"];
    for (let suit of suits) {
      for (let rank of ranks) {
        console.log(getSuitIcon(suit));
        let Icon = getSuitIcon(suit).slice(0, 1);
        let Colour = getSuitIcon(suit).slice(1);
        this.cards.push(
          new Card(
            suit.toLowerCase(),
            Icon,
            Colour,
            String(rank).toLowerCase(),
            this.getRankValue(rank),
          ),
        );
      }
    }
    let Icon = getSuitIcon("stars").slice(0, 1);
    let Colour = getSuitIcon("stars").slice(1);

    for (let i = 0; i < 3; i++) {
      this.cards.push(new Card("stars", Icon, Colour, "joker", 50));
    }

    // double the deck
    this.cards = this.cards.concat(this.cards);
  }

  getRankValue(rank) {
    const values = {
      3: 3,
      4: 4,
      5: 5,
      6: 6,
      7: 7,
      8: 8,
      9: 9,
      10: 10,
      jack: 11,
      queen: 12,
      king: 13,
    };
    return values[rank];
  }

  getWildState(rank) {
    if (rank === "joker" || this.getRankValue(rank) === game.CardsDealt)
      return true;
    else return false;
  }
  getWildValue(rank) {
    if (rank === "joker") return 50;
    else if (this.getRankValue(rank) === game.CardsDealt) return 20;
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw() {
    return this.cards.pop();
  }
}

// Player class to manage hand and ID
class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.hand = [];
    this.roundscore = 0;
    this.gamescore = 0;
    this.melds = []; // array of meld groups (each group is array of Card)
    this.canDraw = false;
    this.canDiscard = false;
    this.IsOut = false;
    this.melding = false;
    this.meldCount = 0;
    this.meldGroup = 0;
    this.meldGroups = 0;
    this.meldCards = [];
    this.meldSetRun = [[]];
  }

  drawCard(deck) {
    this.hand.push(deck.draw());
  }

  discardCard(cardIndex) {
    return this.hand.splice(cardIndex, 1)[0];
  }
}
// GameState class to manage the overall game rules and turn logic
class GameState {
  constructor() {
    this.players = [];
    this.ActivePlayer = 0;
    this.DealerIndex = 0;
    this.CardsDealt = 0;
    this.roundNumber = 0;
    this.deck = new Deck();
    this.discardPile = [];
    this.deck.shuffle();
    this.cardWidth = 60;
    this.cardHeight = 80;
  }

  addPlayer(id, name) {
    this.players.push(new Player(id, name));
  }

  nextDealer() {
    this.DealerIndex = (this.DealerIndex + 1) % this.players.length;
  }
}

// L I S T E N E R S

//showMessage implementation using alert, only if DEBUG is true
function showMessage(msg) {
  if (DEBUG) alert(msg);
  console.log(msg);
}


function getValueRank(value) {
  const values = {
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9",
    10: "10",
    11: "Jack",
    12: "Queen",
    13: "King",
  };
  return values[value];
}

// ***** G A M E   B O A R D  C L I C K   E V E N T S 
function addHandCardListeners(player) {
  for (let i = 1; i <= game.players.length; i++) {
    let arg = ".p" + i + "card";
    const els = document.querySelectorAll(arg);
    els.forEach((el) =>
      el.addEventListener("click", function handleClick(event) {
        console.log("box clicked", event.currentTarget.id, game.ActivePlayer);
        console.log("Image Source:", event.currentTarget.className);
        // hand card clicks

        const className = event.currentTarget.className;
        // hand click
        let relative = game.ActivePlayer + 1;
        if (className !== "p" + relative + "card") return;

        if (Player.melding) {

// in melding mode - toggle border to select/deselect for meld          
          if (event.currentTarget.style.border === "") {
            event.currentTarget.style.border = getMeldGroupColour(
              Player.meldGroup,
            );
            Player.meldCount += 1;
          } else {

// deselect            
            event.currentTarget.style.border = "";
            Player.meldCount -= 1;
          }
        } else {

// not in melding mode - discard card to the discard pile
          let ElementId = event.currentTarget.id;
          let cardIndex = ElementId.substring(6);
          let cardIndexInt = Number(cardIndex) - 1;
          let xCard = Player.hand.splice(cardIndexInt - Player.meldCards.length, 1)[0];
          showMessage(xCard.rank + " of " + xCard.suit + " discarded.");
          renderPlayerHand(Player);
          game.discardPile.unshift(xCard);
          displayCard(xCard, "discard");
         
// after discarding, end turn
          Player.canDraw = false;
          Player.canDiscard = false;    
         
          advanceTurn();
        }
      }),
    );
  }
}
   function validateMeld(group) {
     // Five Crowns meld validation: set or run, jokers allowed
     if (!group || group.length < 3) {
       showMessage("[validateMeld] Invalid: less than 3 cards");
       return { valid: false };
     }
     // Only treat the current round's wild rank as wild
     const wildRank = String(game.roundNumber + 2);
     // Treat jokers and wild cards (of current round rank) as jokers
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
     const suits = nonJokers.map((c) => c.suit);
     const uniqueRanks = [...new Set(ranks)];
     const uniqueSuits = [...new Set(suits)];
     showMessage(
       "[validateMeld] Attempted meld:",
       group.map((c) => `${c.rank}-${c.suit}`),
     );

     // Set: all non-jokers same rank, suits unique
     // Allow sets with jokers and wilds (current round rank)
     if (uniqueRanks.length === 0 && uniqueSuits.length === nonJokers.length) {
       showMessage("[validateMeld] Valid set");
       return { valid: true, type: "set" };
     }
     // If all non-jokers are the same rank, and the rest are jokers/wilds, it's a valid set
     if (
       nonJokers.length > 0 &&
       uniqueRanks.length === 1 &&
       group.length >= 3 &&
       nonJokers.length + jokers.length === group.length
     ) {
       showMessage("[validateMeld] Valid set (with wilds/jokers)");
       return { valid: true, type: "set" };
     }
     // Run: all non-jokers same suit, ranks sequential
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

  function getMeldGroupColour(meldGroup) {
    const colours = {
      0: "",
      1: "3px solid red",
      2: "3px solid green",
      3: "3px solid blue",
    };
    return colours[meldGroup] || "3px solid black";
  }   

  function changeMeldColor(colour) {
    const El = document.getElementById("meld");
    El.style.backgroundColor = colour.substring(10);
  }

  function IdentifyActivePlayer(fontWeight) {
    let PlayerName = "";
    let PlayerArg = Player.id + "name";
    PlayerName = document.getElementById(PlayerArg);
    PlayerName.style.fontWeight = fontWeight;
    }

    function advanceTurn() {
      let PlayerName = "";
      if (game.ActivePlayer !== -1) {
        IdentifyActivePlayer("normal");
        game.ActivePlayer = (game.ActivePlayer + 1) % game.players.length;
        Player = game.players[game.ActivePlayer];

        UpdatePlayerReference();
        game.players.forEach((p) => {
          p.canDiscard = false;
          p.melding = false;
          p.meldCount = 0;
          p.meldCards = [];
        });
        Player.canDraw = true;
        Player.canDiscard = false;   
      }

     
      console.log("startRound: GameRound=",game.roundNumber,"Deck size=",game.deck.cards.length );

      game.players.forEach((p, idx) =>
        console.log(
          `player[${idx}] ${p.name} hand length:`,
          p.hand.length,
          p.hand.map((c) => `${c.rank}-${c.suit}`),
        ),
      );
  
      if (Player.IsOut)  completeRoundAndDeal();
    
      if (!Player.canDraw)
        console.log("advanceTurn: canDraw is false. Should be true!");
    }

function displayCardBack(cardId) {
  let cardImg = document.createElement("img");

  cardImg.alt = "Card Back";
  cardImg.width = game.cardWidth;
  cardImg.height = game.cardHeight;
  cardImg.src = "./cards/back.png";
  showMessage("Card path: " + cardImg.src + " in element: " + cardId);
  document.getElementById(cardId).append(cardImg);
}

function displayCard(card, cardId) {
  let imgsrc = "";
  let cardImg = document.createElement("img");
  cardImg.alt = card.rank + "-" + card.suit;
  cardImg.width = game.cardWidth;
  cardImg.height = game.cardHeight;
  cardImg.style.border = card.styleBorder;
  imgsrc = "./cards/" + card.rank + "_of_" + card.suit + ".png";
  cardImg.src = imgsrc;
  document.getElementById(cardId).innerText = "";
  document.getElementById(cardId).append(cardImg);
  showMessage(cardImg.src + ": " + cardId);
}

 function renderPlayerHand(Player) {
   // Clear previous hand display
   for (let k = 1; k <= 12; k++) {
     const el = document.getElementById(Player.id + "card" + k);
     el.innerHTML = "";
   }

  for (let i = 0; i < Player.meldCards.length; i++) {
    const el = document.getElementById(Player.id + "card" + (i + 1));
    displayCard(Player.meldCards[i], el.id);
  }
    let i = Player.meldCards.length;
   for (let k = 0; k < Player.hand.length; k++) {
     const el = document.getElementById(Player.id + "card" + (i + 1));
     displayCard(Player.hand[k], el.id);
     i++;
     }
 }
 // display each card in deck for debugging
 /*
 game.deck.cards.forEach((card) => {
   if (card.rank === "joker") {
    card.wild = true;
    card.wildValue = 50;
   } 
  else if (game.deck.getRankValue(card.rank) === game.roundNumber + 2) 
        {
        card.wild = true;
        card.wildValue = 20;
        }

   showMessage(
     "Card: " +
       card.rank +
       " of " +
       card.suit +
       " Wild: " +
       card.wild +
       " Wild Value: " +
       card.wildValue,
   );
  
 });
 */
function logInPlayers() {
  game.addPlayer("p1", "Victor");
  game.addPlayer("p2", "Alice");
  game.addPlayer("p3", "Bob");
  const p1name = document.getElementById("p1name");
  if (p1name) p1name.textContent = "Victor";
  addHandCardListeners("p1");
  const p2name = document.getElementById("p2name");
  if (p2name) p2name.textContent = "Alice";
  addHandCardListeners("p2");
  const p3name = document.getElementById("p3name");
  if (p3name) p3name.textContent = "Bob";
  addHandCardListeners("p3");
}

//===================== G A M E   S T A R T =============================
const game = new GameState();game.DealerIndex = -1;
game.ActivePlayer = -1;
game.CardsDealt = 0;
game.roundNumber = 0;
const ScoreData = [];
let waitingForPlayers = true;
let CardDealingDone = false;
let GameRound = 3; // number of cards to deal this round (start at 3 for round 1)
let roundCount = 1; // actual round number (1-based, start at 1)
let cardAlt = "";
let cardSrc = "";

// Add missing autoPlay variable to prevent ReferenceError???
let autoPlay = false;
function completeRoundAndDeal() {
  if (waitingForPlayers) logInPlayers();
  waitingForPlayers = false;
}

function UpdatePlayerReference(){
  Player = IdentifyActivePlayer("bold");
  Player = game.players[game.ActivePlayer];
  const el = document.getElementById("PlayerId");
  if (el) el.textContent = "Id: " + Player.id;
  const el2 = document.getElementById("PlayerName");
  if (el2) el2.textContent = "Name: " + Player.name;
  const el3 = document.getElementById("PlayercanDraw");
  if (el3) el3.textContent = "canDraw: " + Player.canDraw;
  const el4 = document.getElementById("PlayercanDiscard");
  if (el4) el4.textContent = "canDiscard: " + Player.canDiscard;
  const el5 = document.getElementById("PlayerroundScore");
  if (el5) el5.textContent = "roundScore: " + Player.roundscore;
  const el6 = document.getElementById("PlayergameScore");
  if (el6) el6.textContent = "gameScore: " + Player.gamescore;
  const el7 = document.getElementById("PlayerIsOut");
  if (el7) el7.textContent = "IsOut: " + Player.IsOut;
  const el8 = document.getElementById("Playermelding");
  if (el8) el8.textContent = "melding: " + Player.melding;
  }

completeRoundAndDeal();
// 1. Increment game.roundNumber for next round
game.roundNumber++;

const roundResults = [];
game.players.forEach((p) => {
  roundResults.push({
    round: game.roundNumber - 1,
    playerName: p.name,
    totalScore: p.gamescore,
    handScore: p.roundscore,
    //    handCards: p.hand.map((c) =>
    // ${c.rank}-${c.suit}`,
    melds: p.melds,
  });
});

const dataArray = [["Round", "Player", "Score", "Hand", "Cards", "Melds"]];
// update dataArray Scoring Information
game.players.forEach((p) => {
  dataArray.push([
    String(game.roundNumber),
    p.name,
    String(p.gamescore),
    String(p.roundscore),
    p.hand.map((c) => `${c.rank}-${c.suit}`).join(" "),
    p.melds.join(" | "),
  ]);
});
////=============================================================

if (game.roundNumber > 11) {
  showMessage("Game over! Maximum rounds reached.");
  //    return("Game Over");
}
game.CardsDealt = game.roundNumber + 2;
game.DealerIndex = (game.DealerIndex + 1) % game.players.length;
game.ActivePlayer = (game.DealerIndex + 1) % game.players.length;
Player = game.players[game.ActivePlayer];
UpdatePlayerReference();

Player.canDraw = true;

// Update round number UI immediately after increment
let roundNumber = document.getElementById("round-number");
if (roundNumber) roundNumber.textContent = "Round: " + String(game.roundNumber);

let WildText = document.getElementById("wild-card");
if (WildText)
  WildText.textContent =
    " Wild Cards: " + getValueRank(game.roundNumber + 2) + "'s and Joker''s ";

if (game.deck.cards.length < 116) {
  game.deck = new Deck();
  game.deck.shuffle();
  showMessage("Deck reshuffled for new round.");
}

game.players.forEach((p) => {
  p.hand = [];
  //p.canDraw = false;
  p.canDiscard = false;
  p.melding = false;
  p.meldCount = 0;
  p.meldGroups = 0;
  p.meldCards = [];
  p.meldSetRun = [[]];
  p.IsOut = false;

  for (let i = 0; i < game.CardsDealt; i++) {
    let card = game.deck.draw();
    p.hand.push(card);
    displayCard(card, p.id + "card" + (i + 1));
  }
});
displayCardBack("deck");

let drawnCard = game.deck.draw();
displayCard(drawnCard, "discard");
game.discardPile.push(drawnCard);
Player = game.players[game.ActivePlayer];
Player.canDraw = true;
Player.canDiscard = false;
IdentifyActivePlayer('bold');
alert("Round: " + game.roundNumber + " - " + Player.name + "'s turn to draw .");

window.game = game; // Make game globally accessible for UI updates
// Set dealerId to the first active player on reload/start

game.dealerId = Player.id;

console.log("Game initialized with players:", game.players);

//========================================================================
  showMessage("Welcome to Five Crowns! v01 ");

// Ensure DOM is loaded before attaching event listeners

    window.addEventListener("DOMContentLoaded", function () {
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
    });


function Test() {
  console.log("Test button clicked.");
  let cardIndex = game.deck.cards.length - 1; // Example index to discard
  let card = game.deck.cards[cardIndex];

  console.log("Drew card:", card.rank, "of", card.suit);
}

// draw a card from deck
 function draw() {
  UpdatePlayerReference();
   if (Player.canDraw) {
     const card = game.deck.draw();
     Player.hand.push(card);
     // after drawing, disable further draws and enable discard
     Player.canDraw = false;
     Player.canDiscard = true;
     displayCard(
       card,
       Player.id +
         "card" +
         Player.hand.length,
     );
   } else {
     if (Player.meldCount === game.roundNumber + 2) {
       alert(
         Player.name +
           " you have melded all your cards and gone out!",
       );
     } else {
       alert(
        Player.name + " you have already drawn a card this turn",
       );
     }
   }
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

  function Meld() {
    UpdatePlayerReference();
    if (Player.canDraw) {
      alert("You must draw a card before melding");
      return;
    }
    if (Player.meldCount === 0) {
      if (Player.melding) {
        Player.melding = false;
        changeMeldColor("");
        return;
      } else {
        Player.melding = true;
        Player.meldGroup += 1;
        changeMeldColor(
          getMeldGroupColour(Player.meldGroup),
        );
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
        let value = game.deck.getRankValue(meldCardrank);
        let wild = meldCardrank === "joker" || value === game.CardsDealt;
        let wildValue =
          meldCardrank === "joker" ? 50 : value === game.CardsDealt ? 20 : 0;
        let styleBorder = getMeldGroupColour(
          Player.meldGroup,
        );
        let bckgrndColour = getMeldGroupColour(
          Player.meldGroup,
        );
        let NewMeldCard = new Card(
          meldCardsuit,
          getSuitIcon(meldCardsuit).slice(0,1),
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
    });

    let handMeldIndex = 0;
    if (validateMeld(Player.meldCards).valid) {
      showMessage("Valid Meld");
      // Remove meld cards from hand
      for (let i = 0; i < game.CardsDealt + 1; i++) {
        arg = Player.id + "card" + (i + 1);
        let El = document.getElementById(arg);
        if (El.style.border != "") {
          El.style.border = "";
          Player.hand.splice(handMeldIndex, 1);
        } else handMeldIndex += 1;
      }
      Player.melding = false;

      changeMeldColor("");
      //combine the melded cards and remaining hand cards for display
  //    Player.meldSetRun = [
  //      ...Player.meldCards,
  //      ...Player.hand,
   //   ];

      // Replace hand with meldSetRun , hand cards 
   //   let temp = []
  //    temp = [...Player.meldCards, ...Player.hand];
  //    Player.hand = [];
   //   Player.hand = temp;
      renderPlayerHand(Player);
      if (Player.meldCount === game.roundNumber + 2) {
        alert(
          Player.name +
            " you have melded all your cards! You have GONE OUT!!!",
        );
        Player.IsOut = true;
      }
      Player.meldCount = 0;
      Player.meldGroup = 0;
    } else alert("Invalid Meld");
  }

function unMeld() {
  console.log("Unmeld button clicked.");
}
function ScoreBoard() {
  // Save the latest Data to localStorage before navigating
  localStorage.setItem("scoreboard_data", JSON.stringify(dataArray));
  window.location.href = "ScoreBoard.html";
  const storedString = localStorage.getItem("dataArray");

  // 2. Convert the JSON string back to a JavaScript object
  const storedObject = JSON.parse(storedString);

  // 3. Use the object's properties
  //console.log(storedObject.name); // Output: John
}