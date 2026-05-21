const mongoose = require("mongoose");
const { Schema } = mongoose;

const LeaderboardSchema = new Schema({
  username: { type: String, required: true },
  wpm: { type: Number, required: true },
  accuracy: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

const MongooseLeaderboardModel = mongoose.model("Leaderboard", LeaderboardSchema);

// In-memory fallback
const memoryLeaderboard = [];

const LeaderboardProxy = {
  async create(data) {
    if (mongoose.connection.readyState === 1) {
      return await MongooseLeaderboardModel.create(data);
    } else {
      const entry = {
        username: data.username,
        wpm: data.wpm,
        accuracy: data.accuracy,
        createdAt: new Date(),
      };
      memoryLeaderboard.push(entry);
      return entry;
    }
  },

  async getTop(limit = 20) {
    if (mongoose.connection.readyState === 1) {
      return await MongooseLeaderboardModel.find({})
        .sort({ wpm: -1, accuracy: -1 })
        .limit(limit)
        .lean();
    } else {
      return [...memoryLeaderboard]
        .sort((a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy)
        .slice(0, limit);
    }
  },
};

module.exports = LeaderboardProxy;
