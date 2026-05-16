# ToDo

- [x] Scoreboard: minimize row spacing so results fit on iPad without scrolling.
- [x] Scoreboard: make scoreboard display always available.
- [x] Meld display: make opponent meld display optional; default should only show player melds on their own screen.
- [x] Scoreboard: change heading "Going Out Bonus" to "Bonus".
- [x] Investigate game destruction during results check when one player was Android.
	- [x] Log excerpt: `[disconnect] Room has 2 total players: victor(offline), Me(offline)`
	- [x] Log excerpt: `[disconnect] No connected players remain in E99RE5. Destroying room.`
	- [x] Server fix added: delayed empty-room destroy grace period with auto-cancel on reconnect.
	- [x] TESTED: No issues observed during retest. Fix verified working.
- [x] Add support for pausing a game and possibly starting a new game.
- [x] Add support for resuming a paused game.
- [x] Add chat/broadcast capability.