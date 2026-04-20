const gameState = {
    playerName: "Hero",
    health: 100,
    level: 5,
    inventory: ["sword", "shield", "potion"],
    position: { x: 50, y: 75 }
};

const saveString = JSON.stringify(gameState);
// The saveString is now a single string that can be stored (e.g., in localStorage)

localStorage.setItem("gameSaveData", saveString);

const storedSaveString = localStorage.getItem("gameSaveData");
if (storedSaveString) {
    const loadedGameState = JSON.parse(storedSaveString);
    // You can then use the data in loadedGameState to restore your game
}
