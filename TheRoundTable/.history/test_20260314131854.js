function PlayerHandBlinkOn(buttonGroup) {
  startBlinking(buttonGroup);
}

function PlayerHandBlinkOff(buttonGroup) {
  stopBlinking(buttonGroup);  
}

function Test() { 
  PlayerHandBlinkOn("." + game.currentPlayer.id + "card");
 
}