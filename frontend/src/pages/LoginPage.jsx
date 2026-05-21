import React, { useEffect, useState, useCallback } from "react";
import socket from "../socket";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

// ─── helpers ────────────────────────────────────────────────
function getInitials(name) {
  return name ? name.slice(0, 2).toUpperCase() : "?";
}

function getProfile() {
  try {
    return JSON.parse(localStorage.getItem("typr_profile") || "null");
  } catch {
    return null;
  }
}

function saveProfile(profile) {
  localStorage.setItem("typr_profile", JSON.stringify(profile));
}

function createNewProfile(username) {
  const profile = {
    userId: crypto.randomUUID(),
    username,
    races: 0,
    totalWpm: 0,
    maxWpm: 0,
    totalAccuracy: 0,
    history: [],
    createdAt: new Date().toISOString(),
  };
  saveProfile(profile);
  return profile;
}

function avgNum(total, count) {
  if (!count) return 0;
  return Math.round(total / count);
}

// ─── Sub-components ──────────────────────────────────────────

function ConnectionPill({ connected }) {
  return (
    <div className="conn-pill">
      <div className={`dot ${connected ? "dot-green" : "dot-red"}`} />
      <span>{connected ? "Connected" : "Connecting..."}</span>
    </div>
  );
}

function Avatar({ name, size = "md" }) {
  return <div className={`avatar avatar-${size}`}>{getInitials(name)}</div>;
}

// ─── Tab: Race ────────────────────────────────────────────────
function RaceTab({ profile, socketConnected }) {
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!socketConnected || !socket.id) {
      toast.error("Not connected yet. Please wait.");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post("/api/createroom", {
        username: profile.username,
        socketID: socket.id,
        userId: profile.userId,
      });
      if (res.data.success) {
        toast.success(`Room ${res.data.room.roomCode} created!`);
        navigate(`/${res.data.room.roomCode}/lobby`);
      } else {
        toast.error(res.data.error);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!roomCode.trim()) return toast.error("Enter a room code");
    if (!socketConnected || !socket.id) {
      return toast.error("Not connected yet. Please wait.");
    }
    setLoading(true);
    try {
      const res = await axios.post("/api/joinroom", {
        username: profile.username,
        roomCode: roomCode.trim(),
        socketID: socket.id,
        userId: profile.userId,
      });
      if (res.data.success) {
        toast.success("Joined room!");
        navigate(`/${roomCode.trim()}/lobby`);
      } else {
        toast.error(res.data.error);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to join room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Create Room */}
      <div className="card">
        <div className="flex items-center justify-between" style={{ marginBottom: "1rem" }}>
          <div>
            <h2>Create a Room</h2>
            <p style={{ marginTop: "0.25rem", fontSize: "0.82rem", color: "var(--text-3)" }}>
              Start a new private race and invite friends
            </p>
          </div>
          <span style={{ fontSize: "1.5rem" }}>🏎️</span>
        </div>
        <button
          className="btn btn-primary btn-full btn-lg"
          onClick={handleCreate}
          disabled={loading || !socketConnected}
          id="create-room-btn"
        >
          {loading ? <><span className="spinner" />&nbsp;Creating…</> : "Create Room"}
        </button>
      </div>

      {/* Join Room */}
      <div className="card">
        <div className="flex items-center justify-between" style={{ marginBottom: "1rem" }}>
          <div>
            <h2>Join a Room</h2>
            <p style={{ marginTop: "0.25rem", fontSize: "0.82rem", color: "var(--text-3)" }}>
              Enter a room code to join an existing race
            </p>
          </div>
          <span style={{ fontSize: "1.5rem" }}>🚀</span>
        </div>
        <form onSubmit={handleJoin} className="flex gap-3">
          <input
            className="field-input"
            type="text"
            placeholder="Room code (e.g. 4829)"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            disabled={loading}
            maxLength={8}
            id="room-code-input"
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-secondary"
            type="submit"
            disabled={loading || !socketConnected}
            id="join-room-btn"
          >
            Join
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Tab: Leaderboard ─────────────────────────────────────────
function LeaderboardTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get("/api/leaderboard?limit=20")
      .then((res) => {
        if (res.data.success) setEntries(res.data.leaderboard);
      })
      .catch(() => toast.error("Failed to load leaderboard"))
      .finally(() => setLoading(false));
  }, []);

  const medals = ["🥇", "🥈", "🥉"];

  if (loading) return (
    <div className="flex items-center justify-center" style={{ padding: "3rem 0" }}>
      <span className="spinner" />
    </div>
  );

  return (
    <div>
      <div className="section-header">
        <span className="section-title">Global Top Speeds</span>
        <span className="badge badge-purple">{entries.length} entries</span>
      </div>
      {entries.length === 0 ? (
        <div className="card text-center text-2" style={{ padding: "2rem" }}>
          No races recorded yet. Be the first!
        </div>
      ) : (
        <div className="lb-table">
          {entries.map((entry, i) => (
            <div
              key={i}
              className={`lb-row ${i === 0 ? "top-1" : i === 1 ? "top-2" : i === 2 ? "top-3" : ""}`}
            >
              <span className="lb-rank">{medals[i] || `${i + 1}`}</span>
              <div className="lb-user">
                <Avatar name={entry.username} size="sm" />
                <span className="lb-name">{entry.username}</span>
              </div>
              <span className="lb-wpm">{entry.wpm} <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>WPM</span></span>
              <span className="lb-acc">{entry.accuracy}% acc</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Profile ─────────────────────────────────────────────
function ProfileTab({ profile, onProfileUpdate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile.username);

  const avgWpm = avgNum(profile.totalWpm, profile.races);
  const avgAcc = avgNum(profile.totalAccuracy, profile.races);

  const handleSave = () => {
    if (!draft.trim()) return toast.error("Username can't be empty");
    const updated = { ...profile, username: draft.trim() };
    saveProfile(updated);
    onProfileUpdate(updated);
    setEditing(false);
    toast.success("Profile updated!");
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Identity Card */}
      <div className="card">
        <div className="flex items-center gap-4">
          <Avatar name={profile.username} size="lg" />
          <div style={{ flex: 1 }}>
            {editing ? (
              <div className="flex gap-2 items-center">
                <input
                  className="field-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={20}
                  style={{ flex: 1 }}
                  autoFocus
                  id="edit-username-input"
                />
                <button className="btn btn-primary btn-sm" onClick={handleSave} id="save-username-btn">Save</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 style={{ fontSize: "1.25rem", marginRight: "0.25rem" }}>{profile.username}</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)} id="edit-profile-btn">
                  ✏️ Edit
                </button>
              </div>
            )}
            <p style={{ marginTop: "0.25rem", fontSize: "0.78rem", color: "var(--text-3)" }}>
              Member since {new Date(profile.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div>
        <div className="section-header">
          <span className="section-title">Lifetime Stats</span>
        </div>
        <div className="stat-grid">
          <div className="stat-block">
            <span className="stat-num">{profile.races}</span>
            <span className="stat-lbl">Races</span>
          </div>
          <div className="stat-block">
            <span className="stat-num">{avgWpm}</span>
            <span className="stat-lbl">Avg WPM</span>
          </div>
          <div className="stat-block">
            <span className="stat-num" style={{ color: "var(--accent-2)" }}>{profile.maxWpm}</span>
            <span className="stat-lbl">Best WPM</span>
          </div>
          <div className="stat-block">
            <span className="stat-num">{avgAcc}%</span>
            <span className="stat-lbl">Avg Acc</span>
          </div>
        </div>
      </div>

      {/* History */}
      {profile.history.length > 0 && (
        <div>
          <div className="section-header">
            <span className="section-title">Recent Races</span>
            <span className="badge badge-purple">{profile.history.length}</span>
          </div>
          <div className="history-list">
            {[...profile.history].reverse().slice(0, 10).map((h, i) => (
              <div key={i} className="history-row">
                <span className="history-date">{new Date(h.date).toLocaleDateString()}</span>
                <span className="history-wpm">{h.wpm} WPM</span>
                <span className="history-acc">{h.accuracy}% acc</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Setup Screen ─────────────────────────────────────────────
function SetupScreen({ onComplete }) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!username.trim()) return toast.error("Please enter a username");
    if (username.trim().length < 2) return toast.error("Username must be at least 2 characters");
    setLoading(true);
    const profile = createNewProfile(username.trim());
    setTimeout(() => {
      setLoading(false);
      onComplete(profile);
      toast.success(`Welcome, ${profile.username}! 🎉`);
    }, 500);
  };

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-header">
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⌨️</div>
          <h1>Welcome to Typr</h1>
          <p>Create your profile to start racing</p>
        </div>

        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="field">
            <label className="field-label" htmlFor="setup-username">Your Username</label>
            <input
              id="setup-username"
              className="field-input"
              type="text"
              placeholder="Enter a cool username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              autoFocus
              disabled={loading}
            />
          </div>

          {username.trim() && (
            <div className="flex items-center gap-3 card" style={{ padding: "0.85rem 1rem" }}>
              <Avatar name={username} size="md" />
              <div>
                <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>{username}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>Your profile preview</div>
              </div>
            </div>
          )}

          <button
            className="btn btn-primary btn-full btn-lg"
            type="submit"
            disabled={loading || !username.trim()}
            id="create-profile-btn"
          >
            {loading ? <><span className="spinner" />&nbsp;Creating…</> : "Create Profile & Start Racing →"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────
export default function LoginPage() {
  const [profile, setProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("race");
  const [socketConnected, setSocketConnected] = useState(false);

  // Load profile from localStorage on mount
  useEffect(() => {
    const stored = getProfile();
    setProfile(stored);
    setProfileLoaded(true);
  }, []);

  // Socket lifecycle
  useEffect(() => {
    if (!socket.connected) socket.connect();

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    const onError = () => { setSocketConnected(false); };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onError);

    if (socket.connected) setSocketConnected(true);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);
    };
  }, []);

  const handleProfileCreated = (newProfile) => {
    setProfile(newProfile);
  };

  const handleProfileUpdate = (updated) => {
    setProfile(updated);
  };

  if (!profileLoaded) return null;
  if (!profile) return <SetupScreen onComplete={handleProfileCreated} />;

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="header">
        <div className="site-title">typr<span>.</span></div>
        <div className="header-actions">
          <ConnectionPill connected={socketConnected} />
          <div
            className="flex items-center gap-2"
            style={{ cursor: "pointer" }}
            onClick={() => setActiveTab("profile")}
          >
            <Avatar name={profile.username} size="sm" />
            <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-2)" }}>
              {profile.username}
            </span>
          </div>
        </div>
      </header>

      <div className="dashboard-body">
        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === "race" ? "active" : ""}`}
            onClick={() => setActiveTab("race")}
            id="tab-race"
          >
            🏁 Race
          </button>
          <button
            className={`tab ${activeTab === "leaderboard" ? "active" : ""}`}
            onClick={() => setActiveTab("leaderboard")}
            id="tab-leaderboard"
          >
            🏆 Leaderboard
          </button>
          <button
            className={`tab ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
            id="tab-profile"
          >
            👤 Profile
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "race" && (
          <RaceTab profile={profile} socketConnected={socketConnected} />
        )}
        {activeTab === "leaderboard" && <LeaderboardTab />}
        {activeTab === "profile" && (
          <ProfileTab profile={profile} onProfileUpdate={handleProfileUpdate} />
        )}
      </div>
    </div>
  );
}
