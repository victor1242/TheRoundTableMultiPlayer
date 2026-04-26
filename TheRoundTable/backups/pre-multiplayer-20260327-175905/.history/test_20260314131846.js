function PlayerHandBlinkOn(buttonGroup) {
  startBlinking(buttonGroup);
}

function PlayerHandBlinkOff(buttonGroup) {
  stopBlinking(buttonGroup);  
}

function Test() { 
  let victor = 'me';
  PlayerHandBlinkOn("." + game.currentPlayer.id + "card");
 
}