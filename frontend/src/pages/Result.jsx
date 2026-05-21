import React, { useEffect, useState, useRef } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import socket from "../socket";
import axios from "axios";
import toast from "react-hot-toast";

function getInitials(name) {
  return name ? name.slice(0, 2).toUpperCase() : "?";
}

function Avatar({ name, size = "sm" }) {
  return <div className={`avatar avatar-${size}`}>{getInitials(name)}</div>;
}

export default function Result() {
  const { roomCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [results, setResults] = useState(location.state?.results || []);
  const [loading, setLoading] = useState(!location.state?.results);
  const navigatingToLobby = useRef(false);

  useEffect(() => {
    if (!socket.connected) socket.connect();
    socket.emit("join-room", roomCode);

    const handleRedirect = () => {
      navigatingToLobby.current = true;
      toast.success("New race! Back to lobby.");
      navigate(`/${roomCode}/lobby`);
    };

    socket.on("redirect-to-lobby", handleRedirect);
    return () => {
      socket.off("redirect-to-lobby", handleRedirect);
      // Leave room when exiting results unless going back to lobby
      if (!navigatingToLobby.current) {
        socket.emit("leave-room", roomCode);
      }
    };
  }, [roomCode, navigate]);

  useEffect(() => {
    if (!location.state?.results) {
      const fetch = async () => {
        try {
          const res = await axios.get(`/api/${roomCode}/details`);
          if (res.data.success && res.data.results) setResults(res.data.results);
        } catch { toast.error("Failed to load results"); }
        finally { setLoading(false); }
      };
      fetch();
    }
  }, [roomCode, location.state]);

  const handlePlayAgain = () => {
    socket.emit("play-again", roomCode);
  };

  const handleExit = () => {
    socket.emit("leave-room", roomCode);
    navigate("/");
  };

  const sorted = [...results].sort((a, b) => b.wpm !== a.wpm ? b.wpm - a.wpm : b.accuracy - a.accuracy);
  const medals = ["🥇", "🥈", "🥉"];

  if (loading) return (
    <div className="loading-state">
      <span className="spinner" />
      <span>Loading results…</span>
    </div>
  );

  return (
    <div className="results-page">
      {/* Header */}
      <header className="header">
        <div className="site-title">typr<span style={{ color: "var(--accent-2)" }}>.</span></div>
        <div className="header-actions">
          <div className="room-code-chip" style={{ cursor: "default" }}>🔑 {roomCode}</div>
        </div>
      </header>

      <div className="results-body">
        {/* Hero */}
        <div style={{ textAlign: "center", padding: "1rem 0" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🏆</div>
          <h1>Race Complete!</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--text-3)", marginTop: "0.25rem", textAlign: "center" }}>
            Final leaderboard for Room {roomCode}
          </p>
        </div>

        {/* Leaderboard */}
        <div className="card">
          <div className="section-header">
            <span className="section-title">Final Standings</span>
          </div>

          {sorted.length === 0 ? (
            <div className="text-center text-2" style={{ padding: "2rem 0" }}>No results yet</div>
          ) : (
            <div className="lb-table">
              {sorted.map((player, i) => (
                <div
                  key={i}
                  className={`lb-row ${i === 0 ? "top-1" : i === 1 ? "top-2" : i === 2 ? "top-3" : ""}`}
                >
                  <span className="lb-rank">{medals[i] || `${i + 1}`}</span>
                  <div className="lb-user">
                    <Avatar name={player.username} size="sm" />
                    <span className="lb-name">{player.username}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="lb-wpm">
                      {player.wpm}
                      <span style={{ fontSize: "0.7rem", color: "var(--text-3)", marginLeft: "0.25rem" }}>WPM</span>
                    </span>
                    <span className="lb-acc">{player.accuracy}% acc</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Winner spotlight */}
        {sorted.length > 0 && (
          <div className="card" style={{ borderColor: "rgba(234,179,8,0.3)", background: "rgba(234,179,8,0.04)" }}>
            <div className="flex items-center gap-3">
              <Avatar name={sorted[0].username} size="md" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginBottom: "0.15rem" }}>
                  🥇 Race Winner
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 700 }}>{sorted[0].username}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--accent-2)" }}>
                  {sorted[0].wpm}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>WPM</div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button className="btn btn-primary btn-full btn-lg" onClick={handlePlayAgain} id="play-again-btn">
            Play Again
          </button>
          <button className="btn btn-secondary btn-full" onClick={handleExit} id="exit-btn">
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}
