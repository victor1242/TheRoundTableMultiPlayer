const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { createRoomManager } = require("./rooms/roomManager");

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

// Serve the multiplayer client page and its JS from the TheRoundTableMultiPlayer folder
app.use(express.static(path.join(__dirname, "..", "TheRoundTableMultiPlayer")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "TheRoundTable-multiplayer", ts: Date.now() });
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

  socket.on("disconnect", () => {
    console.log(`[multiplayer] socket disconnected: ${socket.id}`);
    roomManager.handleDisconnect(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`[multiplayer] listening on port ${PORT}`);
});
