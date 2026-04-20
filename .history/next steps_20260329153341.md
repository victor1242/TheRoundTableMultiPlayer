Best reference set is this, in order:

Interface design spec
design.md

Actual server socket interface currently implemented
index.js

Room manager function call surface used by server handlers
roomManager.js

Room-level methods and state shape returned to client
gameRoom.js

Client-side interface wrapper and outbound calls
multiplayerClient.js

Engine function reference for Phase 3 actions
gameEngine.js

Important note: the design doc event names are conceptual and older in places. Your current live event names are the ones in index.js: room:create, room:join, game:start, game:action, room:state.

If you want, I can generate a quick side-by-side mapping next: design-name -> actual implemented call name.

GPT-5.3-Codex • 0.9x