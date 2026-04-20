# Testing Guide - AI Speed & Step Controls

## What Was Fixed

The "vibrating" issue was caused by an infinite loop in the `advanceTurn()` function. Here's what was corrected:

### 1. **Removed Infinite Loop**
- **Old code**: `setTimeout(advanceTurn, 0)` - called immediately with no delay
- **New code**: Uses `scheduleAITurn(500)` - properly scheduled with speed control

### 2. **Fixed Property Names**
- Changed all `.isAI` references to `.aiPlayer` (the correct property name)
- Fixed in 13 locations across main.js and functions.js

### 3. **Fixed Discard Pile Operations**
- Changed from `shift()`/`unshift()` to `pop()`/`push()` for consistency
- Fixed discard pile display to show the last card

## How to Test Now

### Step 1: Refresh Your Browser
- Press **Ctrl+F5** (or **Cmd+Shift+R** on Mac) to hard refresh
- This ensures all JavaScript changes are loaded

### Step 2: Open Console
- Press **F12** to open Developer Tools
- Go to the **Console** tab
- Watch for any error messages

### Step 3: Start a New Game
- Click "New Game" or select a game option
- Make sure at least one player is set to AI

### Step 4: Enable AI Auto-Play
- Check the **"AI Auto-Play"** checkbox in the right panel
- AI players should now take turns automatically
- No more vibrating!

### Step 5: Test Speed Control
- Drag the speed slider while AI is playing
- Try these speeds:
  - **0.25x** - Very slow, easy to watch
  - **1.0x** - Normal speed
  - **2.0x** - Fast
  - **4.0x** - Very fast

### Step 6: Test Pause
- Click **"Pause AI"** button
- AI should stop after completing current action
- Click **"Resume AI"** to continue

### Step 7: Test Step Mode
- Check **"🔍 Step Through Turns"**
- Click **"➡️ Next Step"** to advance one AI turn at a time
- Watch console for detailed AI decision logs

## What You Should See

✅ **No vibrating** - Game should run smoothly

✅ **AI takes turns** - Cards are drawn, melded, and discarded

✅ **Speed changes work** - Delays adjust in real-time

✅ **Pause works** - AI stops and resumes cleanly

✅ **Step mode works** - Manual control of each AI turn

✅ **Console logs** - Shows AI decision-making process

## Console Output Example

When AI takes a turn, you should see:
```
[AI] Alice's turn begins
[AI] Current hand: 3-hearts, 5-clubs, 7-diamonds, ...
[AI] Alice draws 4-hearts from deck
[AI] Alice found 2 possible melds
[AI] Alice melding 3 cards (run)
[AI] Alice discards king-spades
```

## Troubleshooting

### If AI still doesn't move:
1. Check console for errors
2. Verify "AI Auto-Play" is checked
3. Verify it's not paused
4. Make sure current player has `aiPlayer = true`

### If you see errors about undefined properties:
1. Hard refresh the page (Ctrl+F5)
2. Clear browser cache
3. Check that all .js files are loaded in correct order

### If speed doesn't seem to change:
- Speed only affects future actions
- Current animations complete at their original speed
- Try changing speed between turns

### If step button stays disabled:
- Make sure "Step Through Turns" is checked
- Make sure "AI Auto-Play" is enabled
- Wait for an AI player's turn to start

## Expected Behavior

### Normal Play (Auto-Play Enabled)
1. Human player takes turn manually
2. AI player turn starts automatically after 500ms
3. AI draws card (visible on screen)
4. AI melds if possible (cards highlighted, then moved)
5. AI discards card (visible on discard pile)
6. Next player's turn begins

### Step Mode
1. Human player takes turn manually
2. "Next Step" button becomes enabled
3. Click button to execute AI turn
4. AI completes full turn (draw, meld, discard)
5. Button becomes enabled again for next AI turn

### Speed Control
- **0.25x**: Each AI action takes 4x longer (16 seconds per action)
- **1.0x**: Normal speed (4 seconds per action)
- **4.0x**: Each AI action takes 1/4 time (1 second per action)

## Performance Notes

- Minimum delay is 50ms to prevent UI freezing
- Speed changes apply to next scheduled action
- Tab switching auto-pauses AI to save resources
- Step mode disables automatic scheduling

## Success Criteria

✅ Game loads without errors
✅ AI players take turns automatically
✅ No infinite loops or vibrating
✅ Speed slider changes AI turn speed
✅ Pause button stops/resumes AI
✅ Step mode gives manual control
✅ Console shows AI decision logs
✅ Game completes rounds normally

If all these work, the implementation is successful!
