const mongoose = require("mongoose");
const { Schema } = mongoose;

const RaceHistorySchema = new Schema(
  { date: { type: Date, default: Date.now }, wpm: Number, accuracy: Number },
  { _id: false }
);

const UserSchema = new Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  stats: {
    races:         { type: Number, default: 0 },
    totalWpm:      { type: Number, default: 0 },
    maxWpm:        { type: Number, default: 0 },
    totalAccuracy: { type: Number, default: 0 },
  },
  history: { type: [RaceHistorySchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

const MongooseUserModel = mongoose.model("User", UserSchema);

// ─── In-memory fallback ───────────────────────────────────────────────────────
const memoryUsers = new Map(); // key: userId (string)

class UserMockDocument {
  constructor(data) {
    this._id       = data._id || String(Date.now() + Math.random());
    this.username  = data.username;
    this.email     = data.email;
    this.passwordHash = data.passwordHash;
    this.stats     = data.stats || { races: 0, totalWpm: 0, maxWpm: 0, totalAccuracy: 0 };
    this.history   = data.history || [];
    this.createdAt = data.createdAt || new Date();
  }

  async save() {
    memoryUsers.set(String(this._id), this._toPlain());
    return this;
  }

  _toPlain() {
    return {
      _id: this._id, username: this.username, email: this.email,
      passwordHash: this.passwordHash, stats: { ...this.stats },
      history: [...this.history], createdAt: this.createdAt,
    };
  }

  toObject() { return this._toPlain(); }
}

// ─── Proxy ────────────────────────────────────────────────────────────────────
const isMongo = () => mongoose.connection.readyState === 1;

const UserProxy = {
  async create(data) {
    if (isMongo()) return await MongooseUserModel.create(data);
    const doc = new UserMockDocument(data);
    await doc.save();
    return doc;
  },

  async findById(id) {
    if (isMongo()) return await MongooseUserModel.findById(id).lean();
    return memoryUsers.get(String(id)) || null;
  },

  async findByIdDoc(id) {
    if (isMongo()) return await MongooseUserModel.findById(id);
    const data = memoryUsers.get(String(id));
    return data ? new UserMockDocument(data) : null;
  },

  async findOne(query) {
    if (isMongo()) return await MongooseUserModel.findOne(query).lean();
    for (const user of memoryUsers.values()) {
      let match = true;
      if (query.email    && user.email    !== query.email)    match = false;
      if (query.username && user.username !== query.username) match = false;
      if (match) return user;
    }
    return null;
  },

  async findOneDoc(query) {
    if (isMongo()) return await MongooseUserModel.findOne(query);
    const plain = await this.findOne(query);
    return plain ? new UserMockDocument(plain) : null;
  },

  // Update stats after a race; returns updated user plain object
  async addRaceResult(userId, wpm, accuracy) {
    if (isMongo()) {
      const user = await MongooseUserModel.findById(userId);
      if (!user) return null;
      user.stats.races         += 1;
      user.stats.totalWpm      += wpm;
      user.stats.maxWpm         = Math.max(user.stats.maxWpm, wpm);
      user.stats.totalAccuracy += accuracy;
      user.history.push({ date: new Date(), wpm, accuracy });
      if (user.history.length > 50) user.history = user.history.slice(-50);
      await user.save();
      return user.toObject ? user.toObject() : user;
    }
    const data = memoryUsers.get(String(userId));
    if (!data) return null;
    data.stats.races         += 1;
    data.stats.totalWpm      += wpm;
    data.stats.maxWpm         = Math.max(data.stats.maxWpm, wpm);
    data.stats.totalAccuracy += accuracy;
    data.history.push({ date: new Date(), wpm, accuracy });
    if (data.history.length > 50) data.history = data.history.slice(-50);
    memoryUsers.set(String(userId), data);
    return data;
  },

  async updateUsername(userId, newUsername) {
    if (isMongo()) {
      return await MongooseUserModel.findByIdAndUpdate(
        userId, { username: newUsername }, { new: true }
      ).lean();
    }
    const data = memoryUsers.get(String(userId));
    if (!data) return null;
    data.username = newUsername;
    memoryUsers.set(String(userId), data);
    return data;
  },
};

module.exports = UserProxy;
