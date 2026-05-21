import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import socket from "../socket";

import { useAuth } from "../context/AuthContext";

function getInitials(name) {
  return name ? name.slice(0, 2).toUpperCase() : "?";
}

function Avatar({ name, size = "sm" }) {
  return <div className={`avatar avatar-${size}`}>{getInitials(name)}</div>;
}

export default function Lobby() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const navigatingToGame = useRef(false);
  const { user } = useAuth();

  // Fetch existing users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get(`/api/${roomCode}/getAllUsers`);
        setUsers(res.data.users || []);

        const resp = await axios.get("/api/getUser", {
          params: { socketID: socket.id, roomCode },
        });
        setUsername(resp.data.username || "");
      } catch (err) {
        // If user not found in room (e.g. page refresh), try to rejoin
        if (user) {
          try {
            if (!socket.connected) socket.connect();
            await new Promise((res) => setTimeout(res, 500));
            await axios.post("/api/joinroom", {
              username: user.username,
              roomCode,
              socketID: socket.id,
              userId: user.userId,
            });
            const res2 = await axios.get(`/api/${roomCode}/getAllUsers`);
            setUsers(res2.data.users || []);
            setUsername(user.username);
          } catch (e) {
            toast.error("Could not rejoin room");
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [roomCode]);

  // Join socket room
  useEffect(() => {
    if (roomCode) socket.emit("join-room", roomCode);
  }, [roomCode]);

  // Socket events
  useEffect(() => {
    const handleUserList = (updated) => {
      setUsers(updated);
      const me = updated.find((u) => u.username === username);
      if (me) setReady(me.ready);
    };
    const handleGameStart = () => {
      navigatingToGame.current = true;
      toast.success("Everyone's ready — Race starting!");
      navigate(`/${roomCode}/game`);
    };
    const handlePlayerLeft = (who) => {
      toast(`${who} left the room`, { icon: "👋" });
    };

    socket.on("user-list-updated", handleUserList);
    socket.on("start-countdown", handleGameStart);
    socket.on("player-left", handlePlayerLeft);
    return () => {
      socket.off("user-list-updated", handleUserList);
      socket.off("start-countdown", handleGameStart);
      socket.off("player-left", handlePlayerLeft);
    };
  }, [roomCode, navigate, username]);

  // Cleanup on unmount — leave room unless navigating to game
  useEffect(() => {
    return () => {
      if (!navigatingToGame.current) {
        socket.emit("leave-room", roomCode);
      }
    };
  }, [roomCode]);

  const [ready, setReady] = useState(false);

  const toggleReady = () => {
    const updatedUsers = users.map((u) =>
      u.username === username ? { ...u, ready: !u.ready } : u
    );
    socket.emit("send-user-details", updatedUsers, roomCode);
    setReady((prev) => !prev);
  };

  const handleLeave = () => {
    socket.emit("leave-room", roomCode);
    navigate("/");
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => toast.success("Room code copied!"));
  };

  const allReady = users.length > 1 && users.every((u) => u.ready);
  const readyCount = users.filter((u) => u.ready).length;

  if (loading) return (
    <div className="loading-state">
      <span className="spinner" />
      <span>Loading lobby…</span>
    </div>
  );

  return (
    <div className="page">
      {/* Header */}
      <header className="header">
        <div className="site-title">typr<span style={{ color: "var(--accent-2)" }}>.</span></div>
        <div className="header-actions">
          <div
            className="room-code-chip"
            onClick={handleCopyCode}
            title="Click to copy room code"
          >
            🔑 {roomCode}
            <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>copy</span>
          </div>
          <button className="btn btn-danger btn-sm" onClick={handleLeave} id="leave-lobby-btn">
            Leave
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 600, margin: "0 auto", width: "100%", padding: "1.5rem" }}>
        {/* Top area */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.3rem", marginBottom: "0.25rem" }}>Waiting for players…</h1>
          <p style={{ fontSize: "0.82rem", color: "var(--text-3)", textAlign: "left", margin: 0 }}>
            {readyCount}/{users.length} ready
            {users.length < 2 && " · Need at least 2 players to start"}
          </p>
        </div>

        {/* Players */}
        <div className="card" style={{ marginBottom: "1rem" }}>
          <div className="section-header">
            <span className="section-title">Players</span>
            <span className="badge badge-purple">{users.length}</span>
          </div>
          <div className="player-list">
            {users.length === 0 ? (
              <div className="text-2 text-sm text-center" style={{ padding: "1rem 0" }}>
                No players yet…
              </div>
            ) : (
              users.map((user, i) => (
                <div key={i} className="player-row">
                  <div className="player-info">
                    <Avatar name={user.username} size="sm" />
                    <span className={`player-name ${user.username === username ? "me" : ""}`}>
                      {user.username}
                      {user.username === username && (
                        <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", color: "var(--text-3)" }}>(you)</span>
                      )}
                    </span>
                  </div>
                  <span className={`badge ${user.ready ? "badge-green" : "badge-red"}`}>
                    {user.ready ? "Ready ✓" : "Not ready"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Actions */}
        {users.length > 0 && (
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              className={`btn btn-full btn-lg ${ready ? "btn-secondary" : "btn-primary"}`}
              onClick={toggleReady}
              id="ready-btn"
              style={{ flex: 2 }}
            >
              {ready ? "Set Not Ready" : "✓ Ready Up"}
            </button>
          </div>
        )}

        {/* Hint when all ready */}
        {allReady && (
          <div className="finished-banner" style={{ marginTop: "0.75rem" }}>
            All players ready! Race starting soon…
          </div>
        )}

        {/* Invite hint */}
        <div className="card" style={{ marginTop: "1rem", textAlign: "center" }}>
          <p style={{ fontSize: "0.8rem", color: "var(--text-3)", margin: 0 }}>
            Invite friends with code&nbsp;
            <strong
              style={{ color: "var(--accent-2)", cursor: "pointer", fontFamily: "var(--font-mono)" }}
              onClick={handleCopyCode}
            >
              {roomCode}
            </strong>
          </p>
        </div>
      </div>
    </div>
  );
}
