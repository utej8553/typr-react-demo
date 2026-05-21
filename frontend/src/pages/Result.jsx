import React, { useEffect, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import socket from "../socket";
import axios from "axios";
import toast from "react-hot-toast";

export default function Result() {
  const { roomCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [results, setResults] = useState(location.state?.results || []);
  const [loading, setLoading] = useState(!location.state?.results);

  useEffect(() => {
    // Connect socket if disconnected
    if (!socket.connected) {
      socket.connect();
    }
    // Join room so we receive redirect events
    socket.emit("join-room", roomCode);

    const handleRedirectToLobby = () => {
      toast.success("Starting new race! Back to Lobby.");
      navigate(`/${roomCode}/lobby`);
    };

    socket.on("redirect-to-lobby", handleRedirectToLobby);

    return () => {
      socket.off("redirect-to-lobby", handleRedirectToLobby);
    };
  }, [roomCode, navigate]);

  useEffect(() => {
    if (!location.state?.results) {
      const fetchResults = async () => {
        try {
          const res = await axios.get(`/api/${roomCode}/details`);
          if (res.data.success && res.data.results) {
            setResults(res.data.results);
          }
        } catch (e) {
          console.error("Error fetching results:", e);
          toast.error("Failed to load results from server");
        } finally {
          setLoading(false);
        }
      };
      fetchResults();
    }
  }, [roomCode, location.state]);

  const handlePlayAgain = () => {
    socket.emit("play-again", roomCode);
  };

  const sortedResults = [...results].sort((a, b) => {
    if (b.wpm !== a.wpm) {
      return b.wpm - a.wpm;
    }
    return b.accuracy - a.accuracy;
  });

  if (loading) {
    return (
      <div className="container">
        <p className="status muted">Loading leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="results-card card-elevated">
        <h1>🏆 Leaderboard</h1>
        <p style={{ marginBottom: "1.5rem" }}>Room Code: {roomCode}</p>

        <div className="results-list">
          {sortedResults.length === 0 ? (
            <p className="status muted">No results found...</p>
          ) : (
            sortedResults.map((player, index) => {
              let medal = "";
              if (index === 0) medal = "🥇";
              else if (index === 1) medal = "🥈";
              else if (index === 2) medal = "🥉";

              return (
                <div key={index} className="result-row">
                  <div className="result-rank-name">
                    <span className="result-medal">{medal || `${index + 1}.`}</span>
                    <span className="result-username">{player.username}</span>
                  </div>
                  <div className="result-stats">
                    <span className="result-wpm">{player.wpm} WPM</span>
                    <span className="result-accuracy">Acc: {player.accuracy}%</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="actions-row">
          <button className="btn btn-primary" onClick={handlePlayAgain}>
            Play Again (New Paragraph)
          </button>
          <button className="btn btn-secondary" onClick={() => navigate("/")}>
            Exit to Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}

