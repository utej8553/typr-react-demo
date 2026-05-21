const { generateParagraphAPI } = require("../helper");
const Room = require("../models/Room");

// Generate a random 4-digit room code
const generateRoomCode = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

const joinRoom = async (req, res) => {
  try {
    const { username, roomCode, socketID } = req.body;

    console.log("JOIN ROOM REQUEST:", { username, roomCode, socketID });

    // Validation - check if required fields are provided
    if (!username || !roomCode || !socketID) {
      return res.status(400).json({
        success: false,
        error: "Username, room code, and socket ID are required",
      });
    }

    // Find the room
    const room = await Room.findOne({ roomCode: roomCode });
    if (!room) {
      return res
        .status(404)
        .json({ success: false, error: "Room doesn't exist" });
    }

    // Check if username already exists in the room
    const usernameExists = room.users.some((u) => u.username === username);
    if (usernameExists) {
      return res.status(409).json({
        success: false,
        error: "Username already taken, try another username",
      });
    }

    // Add user to room
    room.users.push({
      username,
      socketId: socketID,
      ready: false,
      completion: 0,
      accuracy: 100,
      wpm: 0,
      finished: false
    });
    await room.save();

    console.log("Room after adding user:", {
      roomCode,
      users: room.users,
    });

    // Get socket.io instance from app
    const io = req.app.get("io");
    if (io) {
      // Join the socket to the room
      const socket = io.sockets.sockets.get(socketID);
      if (socket) {
        socket.join(roomCode);
        console.log(`Socket ${socketID} joined room ${roomCode}`);

        // Emit updated user list to all clients in the room
        const users = room.users.map((u) => ({
          username: u.username,
          ready: u.ready,
        }));

        console.log("Emitting user-list-updated to room:", roomCode, users);
        io.to(roomCode).emit("user-list-updated", users);
      } else {
        console.error(`Socket ${socketID} not found in io.sockets.sockets`);
      }
    } else {
      console.error("io instance is not available");
    }

    return res.status(200).json({
      success: true,
      message: `User: ${username} successfully joined room ${roomCode}`,
      room: {
        roomCode: room.roomCode,
        usernames: room.users.map(u => u.username),
        userCount: room.users.length,
      },
    });
  } catch (error) {
    console.error("Error in joinRoom:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

const createRoom = async (req, res) => {
  try {
    const { username, socketID } = req.body;

    console.log("CREATE ROOM REQUEST:", { username, socketID });

    // Validation
    if (!username || !socketID) {
      return res.status(400).json({
        success: false,
        error: "Username and socketID are required",
      });
    }

    let roomCode;
    let roomExists = true;
    let attempts = 0;
    const maxAttempts = 10;

    while (roomExists && attempts < maxAttempts) {
      roomCode = generateRoomCode();
      const existingRoom = await Room.findOne({ roomCode });
      roomExists = !!existingRoom;
      attempts++;
    }

    if (roomExists) {
      return res.status(500).json({
        success: false,
        error: "Unable to generate unique room code. Please try again.",
      });
    }
    const para = await generateParagraphAPI(30);
    // Create new room
    const newRoom = new Room({
      roomCode: roomCode,
      users: [{
        username,
        socketId: socketID,
        ready: false,
        completion: 0,
        accuracy: 100,
        wpm: 0,
        finished: false
      }],
      paragraph: para,
      results: [],
      status: "lobby"
    });

    await newRoom.save();

    console.log("Room created:", {
      roomCode,
      users: newRoom.users,
    });

    // Get socket.io instance from app
    const io = req.app.get("io");
    if (io) {
      // Join the socket to the room
      const socket = io.sockets.sockets.get(socketID);
      if (socket) {
        socket.join(roomCode);
        console.log(`Socket ${socketID} joined room ${roomCode}`);

        // Emit initial user list to the room
        const users = newRoom.users.map((u) => ({
          username: u.username,
          ready: u.ready,
        }));

        console.log("Emitting user-list-updated to room:", roomCode, users);
        io.to(roomCode).emit("user-list-updated", users);
      } else {
        console.error(`Socket ${socketID} not found in io.sockets.sockets`);
      }
    } else {
      console.error("io instance is not available");
    }

    return res.status(201).json({
      success: true,
      message: `Room ${roomCode} created successfully`,
      room: {
        roomCode: newRoom.roomCode,
        usernames: newRoom.users.map(u => u.username),
        userCount: newRoom.users.length,
      },
    });
  } catch (error) {
    console.error("Error in createRoom:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

module.exports = {
  joinRoom,
  createRoom,
};

