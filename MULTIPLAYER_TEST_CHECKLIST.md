# Multiplayer Test Checklist

Last updated: 2026-03-30

## Environment

- [ ] Backend server running on port 3001
- [ ] Both devices on same LAN/Wi-Fi
- [ ] Windows firewall allows inbound TCP 3001 (and 5500 if used)
- [ ] Both devices open the same URL style:
  - Preferred: http://10.0.0.155:3001/multiplayer.html
  - Alternate: http://10.0.0.155:5500/TheRoundTableMultiPlayer/multiplayer.html

## Test Run (2 Players)

### 1) Connect to Lobby

- [ ] Device A opens page and sees connected status
- [ ] Device B opens page and sees connected status

Expected:
- Lobby visible on both devices
- No connection errors

### 2) Create and Join Room

- [ ] Device A enters name and clicks Create Room
- [ ] Device A confirms room code is displayed
- [ ] Device B enters name + room code and clicks Join Room

Expected:
- Both devices show player list with A and B
- Host marker is on Device A player entry

### 3) Start Game

- [ ] Host (Device A) clicks Start Game

Expected:
- Lobby hides on both devices
- Game view shows round, wild, deck/discard, and current player info
- Exactly one device shows Your turn

### 4) Turn Guardrails

- [ ] Non-current player attempts actions (deck/discard/cards)
- [ ] Current player clicks deck once

Expected:
- Non-current player cannot change game state
- Current player hand increases by 1
- Deck count decreases
- Current player phase becomes meld/discard

### 5) Meld Validation Feedback

- [ ] Try invalid meld (example: 10s, Js, Qc mixed suit)
- [ ] Try invalid run with duplicate rank shape (example: 5,5,6 same suit)
- [ ] Try valid meld (set or run)

Expected:
- Invalid meld returns specific reason
- Error includes wild reminder context: Wild this round: X and jokers
- Valid meld moves cards from hand to meld area

### 6) Discard and Turn Advance

- [ ] Current player discards one card

Expected:
- Discard top updates on both devices
- Turn advances to the other player
- Former current player resets to draw phase next turn

### 7) Draw From Discard

- [ ] New current player draws from discard pile

Expected:
- Top discard card moves into player hand
- Discard pile decreases
- Phase becomes meld/discard

### 8) Reconnect Recovery

- [ ] Refresh Device B browser

Expected:
- Device B reconnects as same player
- No duplicate player entry appears
- Room and game state remain synchronized

### 9) Round End (Optional)

- [ ] Play until one player goes out
- [ ] Host starts next round from overlay

Expected:
- Round-over/game-over overlay appears with score table
- Next round starts correctly with updated round data

## Pass / Fail Summary

- [ ] PASS: all expected outcomes matched
- [ ] FAIL: one or more expected outcomes failed

If FAIL, capture:

- Step number:
- Device where issue appeared:
- What happened:
- Expected behavior:
- Screenshot/log reference:
