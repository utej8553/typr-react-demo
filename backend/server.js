const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const PORT = process.env.PORT || 5000;
const path = require("path");

// MongoDB connection
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/typeracer";

mongoose
  .connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 2000,
  })
  .then(() => {
    console.log("Connected to MongoDB successfully");
  })
  .catch((error) => {
    console.warn(
      "MongoDB connection failed. Falling back to local in-memory store for development."
    );
  });

// Handle MongoDB connection events
mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected");
});

mongoose.connection.on("error", (error) => {
  if (mongoose.connection.readyState !== 1) {
    return;
  }
  console.error("MongoDB error:", error);
});

// Middleware
app.use(cors());
app.use(express.json());

const io = new Server(server, {
  path: "/api/ws",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Make io available to routes
app.set("io", io);

// Routes
const loginControllers = require("./controllers/loginControllers");
const roomControllers = require("./controllers/roomControllers");
const Room = require("./models/Room");
const Leaderboard = require("./models/Leaderboard");

app.post("/api/joinroom", loginControllers.joinRoom);
app.post("/api/createroom", loginControllers.createRoom);
app.get("/api/:roomCode/getAllUsers", roomControllers.getAllUsers);
app.get("/api/:roomCode/details", roomControllers.roomDetails);

// Global leaderboard endpoint
app.get("/api/leaderboard", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const entries = await Leaderboard.getTop(limit);
    return res.status(200).json({ success: true, leaderboard: entries });
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join-room", (roomCode) => {
    try {
      socket.join(roomCode);
      console.log(`Socket ${socket.id} joined room ${roomCode}`);
    } catch (e) {
      console.error("join-room error:", e);
    }
  });

  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);
    try {
      const room = await Room.findOne({ "users.socketId": socket.id });
      if (room) {
        const disconnectedUser = room.users.find(
          (u) => u.socketId === socket.id
        );
        const username = disconnectedUser ? disconnectedUser.username : "";

        room.users = room.users.filter((u) => u.socketId !== socket.id);

        if (room.users.length === 0) {
          await Room.deleteOne({ roomCode: room.roomCode });
          console.log(`Room ${room.roomCode} deleted as it became empty.`);
        } else {
          await room.save();
          console.log(`User ${username} removed from Room ${room.roomCode}`);

          const usersList = room.users.map((u) => ({
            username: u.username,
            ready: u.ready,
          }));
          io.to(room.roomCode).emit("user-list-updated", usersList);

          if (username) {
            io.to(room.roomCode).emit("player-left", username);
          }

          // If the game was running, check if remaining users are all finished
          if (room.status === "game") {
            const allFinished = room.users.every((u) => u.finished);
            if (allFinished) {
              room.status = "results";
              await room.save();
              io.to(room.roomCode).emit("game-over", room.results);
            }
          }
        }
      }
    } catch (e) {
      console.error("disconnect cleanup error:", e);
    }
  });

  socket.on("send-user-details", async (usersList, roomCode) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (room) {
        usersList.forEach((u) => {
          const roomUser = room.users.find((ru) => ru.username === u.username);
          if (roomUser) {
            roomUser.ready = u.ready;
          }
        });
        await room.save();
        io.to(roomCode).emit("user-list-updated", usersList);

        const allReady =
          room.users.length > 0 && room.users.every((u) => u.ready);
        if (allReady) {
          room.status = "game";
          await room.save();
          io.to(roomCode).emit("start-countdown");
        }
      }
    } catch (e) {
      console.error("send-user-details error:", e);
    }
  });

  socket.on("game-details", async (newUsers, roomCode) => {
    try {
      socket.to(roomCode).emit("recieve-game-details", newUsers);
      const room = await Room.findOne({ roomCode });
      if (room) {
        newUsers.forEach((nu) => {
          const u = room.users.find((ru) => ru.username === nu.username);
          if (u) {
            u.completion = nu.completion;
            u.accuracy = nu.accuracy;
            u.wpm = nu.wpm;
          }
        });
        await room.save();
      }
    } catch (e) {
      console.error("game-details error:", e);
    }
  });

  socket.on("submit-results", async (payload) => {
    try {
      const { username, roomCode, wpm, accuracy } = payload || {};
      if (!roomCode || !username) return;

      const room = await Room.findOne({ roomCode });
      if (room) {
        const user = room.users.find((u) => u.username === username);
        if (user) {
          user.finished = true;
          user.wpm = wpm;
          user.accuracy = accuracy;
          user.completion = 100;
        }

        const exists = room.results.some((r) => r.username === username);
        if (!exists) {
          room.results.push({ username, wpm, accuracy });
        }

        await room.save();

        // Write to global leaderboard
        if (wpm > 0) {
          await Leaderboard.create({ username, wpm, accuracy });
        }

        const allFinished = room.users.every((u) => u.finished);
        if (allFinished) {
          room.status = "results";
          await room.save();
          io.to(roomCode).emit("game-over", room.results);
        } else {
          const updatedUsers = room.users.map((u) => ({
            username: u.username,
            completion: u.completion,
            accuracy: u.accuracy,
            wpm: u.wpm,
            finished: u.finished,
          }));
          io.to(roomCode).emit("recieve-game-details", updatedUsers);
        }
      }
    } catch (e) {
      console.error("submit-results error:", e);
    }
  });

  socket.on("play-again", async (roomCode) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (room) {
        room.status = "lobby";
        room.results = [];

        room.users.forEach((u) => {
          u.ready = false;
          u.completion = 0;
          u.accuracy = 100;
          u.wpm = 0;
          u.finished = false;
        });

        const { generateParagraphAPI } = require("./helper");
        const newPara = await generateParagraphAPI(30);
        room.paragraph = newPara;

        await room.save();
        io.to(roomCode).emit("redirect-to-lobby");
      }
    } catch (e) {
      console.error("play-again error:", e);
    }
  });

  socket.on("leave-room", async (roomCode) => {
    try {
      console.log(`Socket ${socket.id} explicitly leaving room ${roomCode}`);
      const room = await Room.findOne({ roomCode });
      if (room) {
        const leavingUser = room.users.find((u) => u.socketId === socket.id);
        const username = leavingUser ? leavingUser.username : "";

        room.users = room.users.filter((u) => u.socketId !== socket.id);

        if (room.users.length === 0) {
          await Room.deleteOne({ roomCode: room.roomCode });
          console.log(`Room ${room.roomCode} deleted as it became empty.`);
        } else {
          await room.save();
          console.log(`User ${username} removed from Room ${room.roomCode}`);

          const usersList = room.users.map((u) => ({
            username: u.username,
            ready: u.ready,
          }));
          io.to(room.roomCode).emit("user-list-updated", usersList);

          if (username) {
            io.to(room.roomCode).emit("player-left", username);
          }

          // If the game was running, check if remaining users are all finished
          if (room.status === "game") {
            const allFinished = room.users.every((u) => u.finished);
            if (allFinished) {
              room.status = "results";
              await room.save();
              io.to(room.roomCode).emit("game-over", room.results);
            }
          }
        }
      }
      socket.leave(roomCode);
    } catch (e) {
      console.error("leave-room error:", e);
    }
  });

  socket.on("user-completed", (payload) => {
    try {
      const { msg, roomCode } = payload || {};
      if (!roomCode) return;
      socket.to(roomCode).emit("completion-message", msg);
    } catch (e) {
      console.error("user-completed error:", e);
    }
  });
});

app.get("/api/getUser", async (req, res) => {
  try {
    const { socketID, roomCode } = req.query;

    if (!socketID || !roomCode) {
      return res.status(400).json({ error: "Missing socketID or roomCode" });
    }

    const room = await Room.findOne({ roomCode });
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const user = room.users.find((u) => u.socketId === socketID);
    if (user) {
      return res.status(200).json({ username: user.username });
    }

    return res.status(404).json({ error: "User not found in room" });
  } catch (err) {
    console.error("Error in /api/getUser:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "../frontend/dist")));

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(path.join(__dirname, "../frontend/dist"));
});
