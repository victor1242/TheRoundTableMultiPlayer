# Five Crowns AI Meld Planner

## Overview
This document describes the AI move planning system created for the Five Crowns card game.

## Files Created

### 1. aiMeldPlanner.js
A comprehensive AI decision-making module that provides intelligent card melding strategies.

**Key Functions:**

- `findPossibleMelds(hand, wildRank)` - Analyzes hand and finds all valid meld combinations
- `selectBestMeld(possibleMelds, wildRank)` - Chooses optimal meld based on strategy
- `shouldAttemptMeld(hand, meldSets, wildRank)` - Determines if AI should try to meld
- `shouldUnmeldAndRemeld(hand, meldSets, wildRank)` - Checks if remelding would be better
- `shouldTakeDiscard(discardCard, hand, wildRank)` - Decides whether to take from discard pile
- `chooseCardToDiscard(hand, wildRank, isFinalTurn)` - Selects best card to discard
- `evaluateCardValue(card, wildRank)` - Scores card strategic value

**Strategy:**
1. Always take wild cards from discard
2. Take discard if it creates new meld opportunities
3. Unmeld and remeld if it allows melding more cards
4. Prioritize melds that leave 0 or 1 card
5. Discard high-value cards that don't fit melds
6. Never discard wilds unless necessary

### 2. AI.js (Updated)
Refactored to use the meld planner module with a clear 4-phase turn structure:

**Phase 1: DRAW**
- Check if discard pile top card is useful
- Take from discard or draw from deck

**Phase 2: UNMELD & REMELD**
- Evaluate if unmelding would allow better combinations
- Unmeld all cards if beneficial

**Phase 3: MELD**
- Find all possible melds
- Select best meld using strategy
- Mark cards and execute meld

**Phase 4: DISCARD**
- Choose least valuable card
- Discard and advance turn

## Installation

Add the following script tag to index.html BEFORE AI.js:

```html
<script src="aiMeldPlanner.js"></script>
```

The complete script loading order should be:
```html
<script src="classes.js"></script>
<script src="functions.js"></script>
<script src="aiMeldPlanner.js"></script>
<script src="AI.js"></script>
<script src="main.js"></script>
```

## How It Works

### Meld Discovery
The planner generates all possible combinations of 3+ cards and validates each against game rules:
- **Sets**: 3+ cards of same rank, different suits
- **Runs**: 3+ cards of same suit in sequence

### Meld Selection Priority
1. Melds that use all cards (going out)
2. Melds leaving 1 low-value card
3. Largest melds (most cards)

### Discard Strategy
Cards are scored for discarding based on:
- Card value (prefer discarding high values)
- Singleton status (prefer discarding unmatched cards)
- Sequence potential (prefer discarding cards that can't form runs)
- Wild status (never discard wilds unless forced)

### Unmeld Logic
AI will unmeld existing melds if:
- Combined hand + melded cards can form larger melds
- More total cards can be melded after remelding

## Testing

To test the AI:
1. Set player 2 and 3 as AI players in the game
2. Enable AI auto-play
3. Observe console logs for AI decision-making
4. Watch for strategic melding and discarding

## Future Enhancements

Potential improvements:
- Difficulty levels (conservative vs aggressive)
- Memory of opponent discards
- Probability calculations for drawing needed cards
- Multi-meld planning (planning multiple melds in sequence)
- Defensive play (blocking opponents)

## Notes

- The AI uses the existing `validateMeld()` function from functions.js
- All AI decisions are logged to console for debugging
- The planner is exposed as `window.AIMeldPlanner` for browser access
- Compatible with the existing game state management system
