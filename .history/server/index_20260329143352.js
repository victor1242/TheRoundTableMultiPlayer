const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { createRoomManager } = require("./rooms/roomManager");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = Number(process.env.PORT) || 3001;
const roomManager = createRoomManager(io);

// Serve the multiplayer client page and its JS from the 5Crowns folder
app.use(express.static(path.join(__dirname, "..", "5Crowns")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "5crowns-multiplayer", ts: Date.now() });
});

io.on("connection", (socket) => {
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
      const result = roomManager.startGame({ roomCode, playerId });
      callback?.({ ok: true, ...result });
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on("game:action", ({ roomCode, playerId, action }, callback) => {
    try {
      const result = roomManager.applyAction({ roomCode, playerId, action });
      callback?.({ ok: true, ...result });
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on("disconnect", () => {
    roomManager.handleDisconnect(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`[multiplayer] listening on port ${PORT}`);
});
