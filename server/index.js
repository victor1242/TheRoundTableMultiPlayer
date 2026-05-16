const express = 
require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { createRoomManager } = require("./rooms/roomManager");
const SuspendedGames = require("./suspendedGames");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 5000,
  pingTimeout: 5000,
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = Number(process.env.PORT) || 3001;
const roomManager = createRoomManager(io);

// Serve the multiplayer client page and its JS from the TheRoundTable folder
app.use(express.static(path.join(__dirname, "..", "TheRoundTable")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "The Round Table - multiplayer", ts: Date.now() });
});

// REST API endpoints for suspended games
app.get("/api/suspended-games", (_req, res) => {
  try {
    const games = SuspendedGames.listPausedGames();
    res.json({ ok: true, games });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.delete("/api/suspended-games/:roomCode", (req, res) => {
  try {
    const { roomCode } = req.params;
    const deleted = SuspendedGames.deletePausedGame(roomCode);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: "Suspended game not found" });
    }
    res.json({ ok: true, message: "Game deleted" });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

io.on("connection", (socket) => {
  console.log(`[multiplayer] socket connected: ${socket.id}`);

  socket.on("room:create", ({ playerName }, callback) => {
    try {
      const result = roomManager.createRoom({ socket, playerName });
      callback?.({ ok: true, ...result });
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on("room:join", ({ roomCode, playerName, playerId }, callback) => {
    try {
      const result = roomManager.joinRoom({ socket, roomCode, playerName, playerId });
      callback?.({ ok: true, ...result });
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on("game:start", ({ roomCode, playerId }, callback) => {
    try {
      console.log(`[multiplayer] game:start requested room=${roomCode} player=${playerId}`);
      const result = roomManager.startGame({ roomCode, playerId, socketId: socket.id });
      console.log(`[multiplayer] game:start succeeded room=${roomCode}`);
      callback?.({ ok: true, ...result });
    } catch (error) {
      console.error(`[multiplayer] game:start failed room=${roomCode} player=${playerId}: ${error.message}`);
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on("game:pause", ({ roomCode, playerId, description }, callback) => {
    try {
      const result = roomManager.pauseGame({ roomCode, playerId, socketId: socket.id, description });
      callback?.({ ok: true, ...result });
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on("game:resume", ({ roomCode, playerId }, callback) => {
    try {
      const result = roomManager.resumeGame({ roomCode, playerId, socketId: socket.id });
      callback?.({ ok: true, ...result });
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on("game:restart", ({ roomCode, playerId }, callback) => {
    try {
      const result = roomManager.restartGame({ roomCode, playerId, socketId: socket.id });
      callback?.({ ok: true, ...result });
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on("game:action", ({ roomCode, playerId, action }, callback) => {
    try {
      const result = roomManager.applyAction({ roomCode, playerId, socketId: socket.id, action });
      callback?.({ ok: true, ...result });
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on("game:nextRound", ({ roomCode, playerId }, callback) => {
    try {
      const result = roomManager.startNextRound({ roomCode, playerId, socketId: socket.id });
      callback?.({ ok: true, ...result });
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on("game:skipTurn", ({ roomCode, playerId }, callback) => {
    try {
      const result = roomManager.skipTurn({ roomCode, playerId, socketId: socket.id });
      callback?.({ ok: true, ...result });
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on("chat:message", ({ roomCode, playerId, text, recipientIds }) => {
    try {
      if (!roomCode || !playerId || typeof text !== "string") return;
      const safeText = text.trim().slice(0, 200);
      if (!safeText) return;

      const routing = roomManager.resolveChatTargets({
        roomCode,
        senderPlayerId: playerId,
        recipientIds,
      });

      const payload = {
        fromPlayerId: routing.sender.id,
        playerName: routing.sender.name || "Unknown",
        text: safeText,
        roomCode: routing.roomCode,
        isBroadcast: routing.isBroadcast,
        recipientIds: routing.targets.map((target) => target.id),
        recipientNames: routing.targets.map((target) => target.name),
        ts: Date.now(),
      };

      // Echo to sender so they always see their outgoing message in chat history.
      socket.emit("chat:message", payload);

      // Deliver only to selected recipients, or all connected others for broadcast.
      routing.targets.forEach((target) => {
        const targetSocket = io.sockets.sockets.get(target.socketId);
        if (targetSocket) {
          targetSocket.emit("chat:message", payload);
        }
      });
    } catch (error) {
      socket.emit("chat:error", { error: error.message || "Unable to send message" });
    }
  });

  socket.on("disconnect", () => {
    console.log(`[multiplayer] socket disconnected: ${socket.id}`);
    roomManager.handleDisconnect(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`[multiplayer] listening on port ${PORT}`);
});
