# Disconnect/Reconnect Test Checklist

Use this during multiplayer QA to validate player drop, reconnect, and state recovery behavior.

## Test Metadata
- Date:
- Build/Branch:
- Tester:
- Room Code:
- Players:

## 1) Setup
- [ ] Open two browser windows (Player A and Player B).
- [ ] Join the same room with both players.
- [ ] Start a game and play 1-2 turns to establish changing state.

## 2) Hard Disconnect (Unexpected Quit)
- [ ] Close Player B tab/window abruptly.
- [ ] Wait 5-10 seconds.
- [ ] Verify Player A UI updates (player list/status changes).
- [ ] Verify game does not stall forever waiting on Player B.

Result: PASS / FAIL
Notes:

## 3) Reconnect With Same Identity
- [ ] Reopen multiplayer page as Player B.
- [ ] Enter same room code.
- [ ] Enter same player name.
- [ ] Join room.
- [ ] Verify no duplicate/ghost player entry.
- [ ] Verify rejoin succeeds or gives a clear/intentional conflict message.

Result: PASS / FAIL
Notes:

## 4) Game State Recovery
- [ ] Rejoined player sees current round (not a new game).
- [ ] Rejoined player receives correct hand/cards.
- [ ] Draw/discard piles reflect current server state.
- [ ] Current turn indicator is accurate.

Result: PASS / FAIL
Notes:

## 5) Turn Integrity
- [ ] If disconnect happened on B turn: game resumes/advances per design.
- [ ] If disconnect happened on A turn: A can complete turn normally.
- [ ] No double-turns.
- [ ] No skipped extra players.

Result: PASS / FAIL
Notes:

## 6) Endgame + Scoreboard
- [ ] Complete a round or full game after reconnect.
- [ ] Open scoreboard from each client.
- [ ] Scores match on all clients.
- [ ] Return/close behavior goes back to correct calling screen.

Result: PASS / FAIL
Notes:

## 7) Edge/Stress Cases
- [ ] Repeat disconnect/reconnect 2-3 times in one game.
- [ ] Disconnect near end-of-round.
- [ ] Disconnect during draw action.
- [ ] Disconnect during discard action.

Result: PASS / FAIL
Notes:

## Defect Log (if any)
- ID:
- Scenario:
- Expected:
- Actual:
- Frequency:
- Severity:
- Repro Steps:
