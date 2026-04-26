/**
 * Rummy Test Case Generator
 * Generates combinations of sets, sequences, and invalid hands.
 */

const SUITS = ['H', 'D', 'C', 'S','+']; // Hearts, Diamonds, Clubs, Spades. stars
const VALUES = [ '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];

// Helper: Generate a single card
const createCard = (value, suit) => ({ value, suit, id: `${value}${suit}` });

// Helper: Shuffle Array
const shuffle = (array) => array.sort(() => Math.random() - 0.5);

// 1. Generate Valid Set (3-4 of same value)
function generateSet(count = 3) {
    const value = VALUES[Math.floor(Math.random() * VALUES.length)];
    const shuffledSuits = shuffle([...SUITS]);
    return shuffledSuits.slice(0, count).map(suit => createCard(value, suit));
}

// 2. Generate Valid Sequence (3+ consecutive same suit)
function generateSequence(length = 3) {
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
    const startIdx = Math.floor(Math.random() * (VALUES.length - length + 1));
    return VALUES.slice(startIdx, startIdx + length).map(value => createCard(value, suit));
}

// 3. Generate Invalid Hand (Mixed, wrong sequence, etc.)
function generateInvalidMeld() {
    return [
        createCard('5', 'H'),
        createCard('6', 'H'),
        createCard('8', 'H'), // Missing 7
        createCard('T', 'S')  // Wrong suit
    ];
}

// Generator Factory
function generateRummyTestCases(numCases = 5) {
    const testCases = [];
    for (let i = 0; i < numCases; i++) {
        const type = Math.random();
        let hand;
        let expected;

        if (type < 0.3) {
            hand = generateSet(3);
            expected = 'valid_set';
        } else if (type < 0.6) {
            hand = generateSequence(Math.floor(Math.random() * 3) + 3);
            expected = 'valid_sequence';
        } else {
            hand = generateInvalidMeld();
            expected = 'invalid';
        }

        testCases.push({
            id: i + 1,
            hand: hand.map(c => c.id),
            expected: expected,
            description: `Testing ${expected}`
        });
    }
    return testCases;
}

// --- Usage ---
const testData = generateRummyTestCases(5);
console.log(JSON.stringify(testData, null, 2));

/*
Example Output:
[
  {
    "id": 1,
    "hand": ["8H", "8D", "8S"],
    "expected": "valid_set",
    "description": "Testing valid_set"
  },
  {
    "id": 2,
    "hand": ["4H", "5H", "6H"],
    "expected": "valid_sequence",
    "description": "Testing valid_sequence"
  }
]
*/
