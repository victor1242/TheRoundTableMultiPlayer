# Five Crowns AI Speed & Step Controls Guide

## Overview
The AI control system allows you to adjust the speed of AI turns and step through them one at a time for debugging and observation.

## Controls Location
All AI controls are located in the right-side panel under "🎮 AI Controls & Debugging"

## Features

### 1. AI Auto-Play Toggle
- **Checkbox**: "AI Auto-Play"
- **Function**: Enables/disables automatic AI turn execution
- **Usage**: Check to enable AI players to take turns automatically

### 2. Pause/Resume Button
- **Button**: "Pause AI" / "Resume AI"
- **Function**: Temporarily pauses AI auto-play without disabling it
- **Usage**: Click to pause during AI turns, click again to resume
- **Note**: Automatically pauses when browser tab is hidden

### 3. Speed Control
- **Slider**: "⚡ Speed" (0.25x to 4x)
- **Function**: Adjusts the speed of AI turn animations and delays
- **Values**:
  - 0.25x = 4x slower (great for watching AI decisions)
  - 0.5x = 2x slower (good for learning)
  - 1.0x = Normal speed
  - 2.0x = 2x faster
  - 4.0x = 4x faster (quick games)
- **Usage**: Drag slider to adjust speed in real-time
- **Display**: Current speed shown next to slider (e.g., "1.0x")

### 4. Step Through Mode
- **Checkbox**: "🔍 Step Through Turns"
- **Button**: "➡️ Next Step"
- **Function**: Allows manual control of each AI turn
- **Usage**:
  1. Enable "AI Auto-Play"
  2. Check "Step Through Turns"
  3. Click "Next Step" to execute each AI turn one at a time
- **Button States**:
  - Enabled (green): Ready to execute next step
  - Disabled (gray): No step pending or mode not active

## Use Cases

### Debugging AI Decisions
1. Enable "AI Auto-Play"
2. Set speed to 0.25x or 0.5x
3. Open browser console (F12)
4. Watch AI decision logs in real-time

### Learning AI Strategy
1. Enable "Step Through Turns"
2. Click "Next Step" for each AI turn
3. Observe the hand, meld decisions, and discard choices
4. Check console for detailed AI reasoning

### Quick Testing
1. Enable "AI Auto-Play"
2. Set speed to 4x
3. Let AI players complete rounds quickly

### Pausing During Gameplay
1. Click "Pause AI" when you need to step away
2. Click "Resume AI" to continue

## Technical Details

### Speed Implementation
- Speed multiplier affects all AI turn delays
- Minimum delay: 50ms (prevents UI freezing)
- Formula: `actualDelay = baseDelay / speed`
- Base delays:
  - Draw/discard: 4000ms (timeOut variable)
  - Meld execution: 4000ms
  - Turn scheduling: 500-1000ms

### Step Mode Implementation
- Replaces automatic scheduling with manual triggers
- Maintains all AI logic and animations
- Button only enabled when step is pending
- Compatible with pause/resume functionality

## Tips

1. **Slow Motion Analysis**: Use 0.25x speed with console open to see every AI decision
2. **Training Mode**: Use step mode to understand optimal play strategies
3. **Fast Forward**: Use 4x speed to quickly test game scenarios
4. **Pause for Breaks**: Pause button preserves game state perfectly
5. **Combine Controls**: You can adjust speed even in step mode

## Troubleshooting

**AI not moving**: Check that "AI Auto-Play" is enabled and not paused

**Step button disabled**: Ensure "Step Through Turns" is checked and AI Auto-Play is enabled

**Speed not changing**: Speed only affects future actions, not current animations

**Tab switching**: AI automatically pauses when tab is hidden for performance
