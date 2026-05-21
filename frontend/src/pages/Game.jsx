import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import socket from "../socket";

function getProfile() {
  try { return JSON.parse(localStorage.getItem("typr_profile") || "null"); } catch { return null; }
}

function saveProfile(profile) {
  localStorage.setItem("typr_profile", JSON.stringify(profile));
}

function recordRace(wpm, accuracy) {
  const profile = getProfile();
  if (!profile) return;
  const updated = {
    ...profile,
    races: profile.races + 1,
    totalWpm: profile.totalWpm + wpm,
    maxWpm: Math.max(profile.maxWpm, wpm),
    totalAccuracy: profile.totalAccuracy + accuracy,
    history: [
      ...profile.history,
      { date: new Date().toISOString(), wpm, accuracy },
    ].slice(-50),
  };
  saveProfile(updated);
}

export default function Game() {
  const [loading, setLoading] = useState(true);
  const [paragraph, setParagraph] = useState([]);
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [error, setError] = useState(null);
  const { roomCode } = useParams();

  const [percentage, setPercentage] = useState(0);
  const paragraphLength = useRef(0);
  const [index, setIndex] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [wpm, setWpm] = useState(0);
  const [finished, setFinished] = useState(false);
  const [hasEmittedComplete, setHasEmittedComplete] = useState(false);
  const textRef = useRef(null);
  const caretRef = useRef(null);
  const navigate = useNavigate();
  const navigatingAway = useRef(false);
  const profile = getProfile();

  // Countdown and Timer
  const [countdown, setCountdown] = useState(5);
  const [countdownActive, setCountdownActive] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimer = useRef(null);
  const startTimeRef = useRef(null);

  const calculateAccuracy = useCallback((para) => {
    if (!para || para.length === 0) return 100;
    let typed = 0, incorrect = 0;
    for (const ch of para) {
      if (ch.valid !== -1) { typed++; if (ch.valid === 0) incorrect++; }
    }
    if (typed === 0) return 100;
    return parseFloat(((typed - incorrect) / typed * 100).toFixed(2));
  }, []);

  const calculateWPM = useCallback((para, secs) => {
    if (secs <= 0) return 0;
    const correct = para.filter((c) => c.valid === 1).length;
    return Math.round((correct / 5) / (secs / 60));
  }, []);

  const calculatePercentage = useCallback(() => {
    if (paragraphLength.current === 0) return 0;
    return parseFloat(((index / paragraphLength.current) * 100).toFixed(2));
  }, [index]);

  // Fetch room details
  const getRoomDetails = useCallback(async () => {
    try {
      const res = await axios.get(`/api/${roomCode}/details`);
      if (!res.data.success) {
        setError(res.data.error || "Failed to load game");
        return;
      }

      const letters = res.data.paragraph.split("").map((ch) => ({ letter: ch, valid: -1 }));
      setParagraph(letters);
      paragraphLength.current = letters.length;

      const tempUsers = res.data.users.map((u) => ({
        username: u.username,
        accuracy: 100,
        completion: 0,
        wpm: 0,
        finished: u.finished || false,
      }));
      setUsers(tempUsers);

      // Get own username
      try {
        const resp = await axios.get("/api/getUser", {
          params: { socketID: socket.id, roomCode },
        });
        setUsername(resp.data.username);
      } catch {
        if (profile) setUsername(profile.username);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Error loading game");
    } finally {
      setLoading(false);
    }
  }, [roomCode]);

  useEffect(() => { if (roomCode) getRoomDetails(); }, [roomCode, getRoomDetails]);
  useEffect(() => { if (roomCode) socket.emit("join-room", roomCode); }, [roomCode]);

  // Countdown
  useEffect(() => {
    if (!loading && paragraph.length > 0) {
      const id = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) { clearInterval(id); setCountdownActive(false); startTimeRef.current = Date.now(); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(id);
    }
  }, [loading, paragraph.length]);

  // Elapsed time
  useEffect(() => {
    if (countdownActive || finished) return;
    const id = setInterval(() => {
      setElapsedTime((Date.now() - startTimeRef.current) / 1000);
    }, 500);
    return () => clearInterval(id);
  }, [countdownActive, finished]);

  // Keyboard handler
  useEffect(() => {
    const handleKey = (e) => {
      if (countdownActive || finished) return;
      const key = e.key;

      // Mark typing activity for caret animation
      setIsTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setIsTyping(false), 1000);

      if ([" ", "Spacebar", "Backspace"].includes(key) || /^[a-zA-Z0-9 .,!?;:'"()\-]$/.test(key)) {
        e.preventDefault();
      }

      if (key === "Backspace") {
        if (index > 0) {
          setIndex((p) => p - 1);
          setParagraph((p) => {
            const n = [...p];
            n[index - 1].valid = -1;
            return n;
          });
        }
        return;
      }

      if (/^[a-zA-Z0-9 .,!?;:'"()\-]$/.test(key)) {
        setParagraph((p) => {
          const n = [...p];
          if (n[index]) n[index].valid = n[index].letter === key ? 1 : 0;
          return n;
        });
        setIndex((p) => p + 1);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [index, finished, countdownActive]);

  // Accuracy
  useEffect(() => { setAccuracy(calculateAccuracy(paragraph)); }, [paragraph, calculateAccuracy]);

  // WPM
  useEffect(() => {
    if (countdownActive) return;
    setWpm(calculateWPM(paragraph, elapsedTime));
  }, [paragraph, elapsedTime, countdownActive, calculateWPM]);

  // Percentage + completion check
  useEffect(() => {
    const pct = calculatePercentage();
    setPercentage(pct);

    if (!hasEmittedComplete && pct >= 100) {
      const finalWPM = calculateWPM(paragraph, elapsedTime);
      const finalAcc = calculateAccuracy(paragraph);

      socket.emit("user-completed", { msg: `${username} finished typing!`, roomCode });
      socket.emit("submit-results", { username, roomCode, wpm: finalWPM, accuracy: finalAcc });

      // Record to local profile
      recordRace(finalWPM, finalAcc);

      setFinished(true);
      setHasEmittedComplete(true);
    }
  }, [index, calculatePercentage, hasEmittedComplete, username, roomCode, elapsedTime, accuracy, paragraph, calculateWPM, calculateAccuracy]);

  // Smooth caret positioning
  useEffect(() => {
    if (!textRef.current || !caretRef.current) return;
    const spans = textRef.current.querySelectorAll(".char");
    const activeSpan = index < spans.length ? spans[index] : spans[spans.length - 1];

    if (activeSpan) {
      const containerRect = textRef.current.getBoundingClientRect();
      const spanRect = activeSpan.getBoundingClientRect();
      const isEnd = index >= paragraph.length;

      caretRef.current.style.left = `${(isEnd ? spanRect.right : spanRect.left) - containerRect.left}px`;
      caretRef.current.style.top = `${spanRect.top - containerRect.top + 2}px`;
      caretRef.current.style.height = `${spanRect.height - 4}px`;

      // Scroll into view
      activeSpan.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [index, paragraph]);

  // Emit game details to other players
  useEffect(() => {
    if (!username || users.length === 0 || countdownActive) return;
    const currentWPM = calculateWPM(paragraph, elapsedTime);
    const updatedUsers = users.map((u) =>
      u.username === username
        ? { ...u, accuracy, completion: percentage, wpm: currentWPM }
        : u
    );
    const hasChanged = updatedUsers.some((u, i) =>
      u.accuracy !== users[i]?.accuracy ||
      u.completion !== users[i]?.completion ||
      u.wpm !== users[i]?.wpm
    );
    if (hasChanged) {
      socket.emit("game-details", updatedUsers, roomCode);
      setUsers(updatedUsers);
    }
  }, [accuracy, percentage, elapsedTime, username, roomCode, users, countdownActive, calculateWPM, paragraph]);

  // Socket listeners
  useEffect(() => {
    const onGameDetails = (newUsers) => setUsers(newUsers);
    const onCompletion = (msg) => toast.success(msg, { icon: "🏁" });
    const onGameOver = (results) => {
      navigatingAway.current = true;
      toast.success("Race over! 🏆");
      setTimeout(() => navigate(`/${roomCode}/results`, { state: { results } }), 1500);
    };
    const onPlayerLeft = (who) => {
      toast(`${who} left`, { icon: "👋" });
      setUsers((p) => p.filter((u) => u.username !== who));
    };

    socket.on("recieve-game-details", onGameDetails);
    socket.on("completion-message", onCompletion);
    socket.on("game-over", onGameOver);
    socket.on("player-left", onPlayerLeft);
    return () => {
      socket.off("recieve-game-details", onGameDetails);
      socket.off("completion-message", onCompletion);
      socket.off("game-over", onGameOver);
      socket.off("player-left", onPlayerLeft);
    };
  }, [roomCode, navigate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!navigatingAway.current) {
        socket.emit("leave-room", roomCode);
      }
    };
  }, [roomCode]);

  const chars = { "-1": "char-untyped", "0": "char-incorrect", "1": "char-correct" };

  if (loading) return <div className="loading-state"><span className="spinner" /><span>Loading game…</span></div>;
  if (error) return <div className="loading-state" style={{ color: "var(--red)" }}>Error: {error}</div>;

  return (
    <div className="game-layout">
      {/* Countdown overlay */}
      {countdownActive && (
        <div className="countdown-overlay">
          <span className="countdown-label">Get ready to type…</span>
          <div className="countdown-num" key={countdown}>{countdown}</div>
        </div>
      )}

      {/* Nav bar */}
      <nav className="game-nav">
        <div className="site-title">typr<span style={{ color: "var(--accent-2)" }}>.</span></div>
        <div className="flex items-center gap-3">
          <div className="room-code-chip" style={{ cursor: "default" }}>🔑 {roomCode}</div>
          <div className="timer-chip">⏱ {Math.floor(elapsedTime)}s</div>
        </div>
      </nav>

      <div className="game-body">
        {/* Race Tracks */}
        <div className="race-section">
          <h2>🏁 Racers</h2>
          <div className="tracks">
            {users.map((user, i) => (
              <div key={i} className="track">
                <div className="track-meta">
                  <span className={`track-name ${user.username === username ? "me" : ""}`}>
                    {user.username}{user.username === username && " (you)"}
                    {user.finished && " 🏁"}
                  </span>
                  <span className="track-stats-inline">
                    {Math.round(user.wpm || 0)} wpm · {Math.round(user.accuracy || 100)}% acc
                  </span>
                </div>
                <div className="track-bar">
                  <div className="track-fill" style={{ width: `${Math.min(user.completion || 0, 100)}%` }} />
                  <div
                    className="track-car"
                    style={{ left: `${Math.min(user.completion || 0, 100)}%` }}
                  >
                    {user.username === username ? "🏎️" : "🚗"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Typing area */}
        <div className={`typing-card ${isTyping ? "typing-active" : ""}`}>
          <div
            ref={textRef}
            className="typing-text"
            style={{ position: "relative" }}
          >
            {/* Smooth caret */}
            <div ref={caretRef} className="smooth-caret" style={{ position: "absolute" }} />
            {paragraph.map((el, i) => (
              <span key={i} className={`char ${chars[String(el.valid)] || "char-untyped"}`}>
                {el.letter}
              </span>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="game-stats">
          <div className="game-stat">
            <span className="game-stat-value">{wpm}</span>
            <span className="game-stat-label">WPM</span>
          </div>
          <div className="game-stat">
            <span className="game-stat-value">{accuracy}%</span>
            <span className="game-stat-label">Accuracy</span>
          </div>
          <div className="game-stat">
            <span className="game-stat-value">{Math.round(percentage)}%</span>
            <span className="game-stat-label">Progress</span>
          </div>
        </div>

        {/* Finished banner */}
        {finished && (
          <div className="finished-banner">
            ✓ You finished! Waiting for other racers…
          </div>
        )}
      </div>
    </div>
  );
}
