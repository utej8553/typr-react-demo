const mongoose = require("mongoose");
const { Schema } = mongoose;

const RoomSchema = new Schema({
  roomCode: { type: String, required: true, unique: true },
  users: [
    {
      username: { type: String, required: true },
      userId: { type: String, required: true },
      socketId: { type: String, required: true },
      ready: { type: Boolean, default: false },
      completion: { type: Number, default: 0 },
      accuracy: { type: Number, default: 100 },
      wpm: { type: Number, default: 0 },
      finished: { type: Boolean, default: false },
    },
  ],
  paragraph: { type: String },
  status: { type: String, enum: ["lobby", "game", "results"], default: "lobby" },
  results: [
    {
      username: { type: String, required: true },
      wpm: { type: Number },
      accuracy: { type: Number },
    },
  ],
});

const MongooseRoomModel = mongoose.model("Room", RoomSchema);

// In-memory store fallback for offline/development mode
const memoryStore = new Map();

class RoomMockDocument {
  constructor(data) {
    this.roomCode = data.roomCode;
    this.users = (data.users || []).map((u) => ({
      username: u.username,
      userId: u.userId || "",
      socketId: u.socketId,
      ready: u.ready ?? false,
      completion: u.completion ?? 0,
      accuracy: u.accuracy ?? 100,
      wpm: u.wpm ?? 0,
      finished: u.finished ?? false,
    }));
    this.paragraph = data.paragraph || "";
    this.status = data.status || "lobby";
    this.results = (data.results || []).map((r) => ({
      username: r.username,
      wpm: r.wpm ?? 0,
      accuracy: r.accuracy ?? 100,
    }));
  }

  async save() {
    memoryStore.set(this.roomCode, {
      roomCode: this.roomCode,
      users: this.users,
      paragraph: this.paragraph,
      status: this.status,
      results: this.results,
    });
    return this;
  }

  toObject() {
    return {
      roomCode: this.roomCode,
      users: this.users,
      paragraph: this.paragraph,
      status: this.status,
      results: this.results,
    };
  }
}

// Proxied model that switches dynamically based on Mongoose connection state
const RoomProxy = function (data) {
  if (mongoose.connection.readyState === 1) {
    return new MongooseRoomModel(data);
  } else {
    return new RoomMockDocument(data);
  }
};

// Add static methods to RoomProxy
RoomProxy.findOne = async function (query) {
  if (mongoose.connection.readyState === 1) {
    return await MongooseRoomModel.findOne(query);
  } else {
    for (const [code, room] of memoryStore.entries()) {
      let match = true;
      for (const [key, val] of Object.entries(query)) {
        if (key === "roomCode" && room.roomCode !== val) {
          match = false;
        } else if (key === "users.socketId") {
          const hasSocket = room.users.some((u) => u.socketId === val);
          if (!hasSocket) match = false;
        } else if (key === "users.username") {
          const hasUsername = room.users.some((u) => u.username === val);
          if (!hasUsername) match = false;
        }
      }
      if (match) {
        return new RoomMockDocument(room);
      }
    }
    return null;
  }
};

RoomProxy.findOneAndDelete = async function (query) {
  if (mongoose.connection.readyState === 1) {
    return await MongooseRoomModel.findOneAndDelete(query);
  } else {
    const roomCode = query.roomCode;
    const room = memoryStore.get(roomCode);
    if (!room) return null;
    memoryStore.delete(roomCode);
    return new RoomMockDocument(room);
  }
};

RoomProxy.deleteOne = async function (query) {
  if (mongoose.connection.readyState === 1) {
    return await MongooseRoomModel.deleteOne(query);
  } else {
    const roomCode = query.roomCode;
    const exists = memoryStore.has(roomCode);
    memoryStore.delete(roomCode);
    return { deletedCount: exists ? 1 : 0 };
  }
};

module.exports = RoomProxy;
