import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import socket from "../socket";

export default function Game() {
  const [loading, setLoading] = useState(false);
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
  const [hasEmittedComplete, setHasEmittedComplete] = useState(false);
  const textRef = useRef(null);
  const navigate = useNavigate();

  // Countdown and Timer States
  const [countdown, setCountdown] = useState(5);
  const [countdownActive, setCountdownActive] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef(null);

  const calculateAccuracy = useCallback((paragraph) => {
    if (!paragraph || paragraph.length === 0) return 100;

    let totalTyped = 0;
    let incorrect = 0;

    for (const letterObj of paragraph) {
      if (letterObj.valid !== -1) {
        totalTyped++;
        if (letterObj.valid === 0) incorrect++;
      }
    }

    if (totalTyped === 0) return 100;

    const accuracy = ((totalTyped - incorrect) / totalTyped) * 100;
    return parseFloat(accuracy.toFixed(2));
  }, []);

  const calculatePercentage = useCallback(() => {
    if (paragraphLength.current === 0) return 0;
    const percentage = (index / paragraphLength.current) * 100;
    return parseFloat(percentage.toFixed(2));
  }, [index]);

  const calculateWPM = useCallback((typedParagraph, timeInSeconds) => {
    if (timeInSeconds <= 0) return 0;
    const correctChars = typedParagraph.filter(char => char.valid === 1).length;
    const words = correctChars / 5;
    const minutes = timeInSeconds / 60;
    return Math.round(words / minutes);
  }, []);

  const getRoomDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`/api/${roomCode}/details`);

      if (!res.data.success) {
        const errorMsg = res.data.error || "Failed to fetch room details";
        toast.error(errorMsg);
        setError(errorMsg);
        return;
      }

      let tempParagraph = [];
      for (const letter of res.data.paragraph) {
        tempParagraph.push({ letter, valid: -1 });
      }

      setParagraph(tempParagraph);
      paragraphLength.current = res.data.paragraph.length;

      const tempUsers = [];
      for (const user of res.data.users) {
        tempUsers.push({
          username: user.username,
          accuracy: 100,
          completion: 0,
          wpm: 0,
          finished: user.finished || false
        });
      }
      setUsers(tempUsers);

      const resp = await axios.get("/api/getUser", {
        params: {
          socketID: socket.id,
          roomCode: roomCode,
        },
      });

      setUsername(resp.data.username);
    } catch (error) {
      const errorMsg =
        error.response?.data?.error || error.message || "Something went wrong";
      toast.error(errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [roomCode]);

  // Fetch room details on mount
  useEffect(() => {
    if (roomCode) getRoomDetails();
  }, [roomCode, getRoomDetails]);

  // Join the socket.io room for this game
  useEffect(() => {
    if (roomCode) {
      socket.emit("join-room", roomCode);
    }
  }, [roomCode]);

  // Countdown logic
  useEffect(() => {
    if (!loading && paragraph.length > 0) {
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setCountdownActive(false);
            startTimeRef.current = Date.now();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [loading, paragraph.length]);

  // Elapsed time tracker for WPM
  useEffect(() => {
    if (countdownActive || percentage >= 100) return;

    const interval = setInterval(() => {
      const seconds = (Date.now() - startTimeRef.current) / 1000;
      setElapsedTime(seconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [countdownActive, percentage]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't process input if countdown is active or game is complete
      if (countdownActive || percentage >= 100) return;

      const key = e.key;

      // Prevent page scroll/back navigation for typing keys
      if (
        key === " " ||
        key === "Spacebar" ||
        key === "Backspace" ||
        /^[a-zA-Z0-9 .,!?;:'"()-]$/.test(key)
      ) {
        e.preventDefault();
      }

      // Handle backspace
      if (key === "Backspace") {
        if (index > 0) {
          setIndex((prev) => prev - 1);
          setParagraph((prev) => {
            const newParagraph = [...prev];
            newParagraph[index - 1].valid = -1; // reset last typed char
            return newParagraph;
          });
        }
        return;
      }

      // Allow only alphanumeric + space + punctuation
      if (/^[a-zA-Z0-9 .,!?;:'"()-]$/.test(key)) {
        setParagraph((prev) => {
          const newParagraph = [...prev];
          if (newParagraph[index]) {
            newParagraph[index].valid =
              newParagraph[index].letter === key ? 1 : 0;
          }
          return newParagraph;
        });

        setIndex((prev) => prev + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [index, percentage, countdownActive]);

  // Update accuracy when paragraph changes
  useEffect(() => {
    const newAccuracy = calculateAccuracy(paragraph);
    setAccuracy(newAccuracy);
  }, [paragraph, calculateAccuracy]);

  // Update WPM in real-time
  useEffect(() => {
    if (countdownActive) return;
    const currentWpm = calculateWPM(paragraph, elapsedTime);
    setWpm(currentWpm);
  }, [paragraph, elapsedTime, countdownActive, calculateWPM]);

  // Update percentage and check completion
  useEffect(() => {
    const newPercentage = calculatePercentage();
    setPercentage(newPercentage);

    if (!hasEmittedComplete && newPercentage >= 100) {
      const msg = `${username} has finished typing!`;
      socket.emit("user-completed", { msg, roomCode });
      
      const finalWPM = calculateWPM(paragraph, elapsedTime);
      socket.emit("submit-results", {
        username,
        roomCode,
        wpm: finalWPM,
        accuracy
      });
      setHasEmittedComplete(true);
    }
  }, [index, calculatePercentage, hasEmittedComplete, username, roomCode, elapsedTime, accuracy, paragraph, calculateWPM]);

  // Auto-scroll: keep the caret within the visible area
  useEffect(() => {
    if (!textRef.current) return;
    const caret = textRef.current.querySelector(".caret");
    if (caret) {
      caret.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [index, paragraph.length]);

  // Emit game details when stats change
  useEffect(() => {
    if (!username || users.length === 0 || countdownActive) return;

    const currentWPM = calculateWPM(paragraph, elapsedTime);

    const updatedUsers = users.map((user) =>
      user.username === username
        ? { ...user, accuracy, completion: percentage, wpm: currentWPM }
        : user
    );

    // Only emit if something actually changed
    const hasChanged = updatedUsers.some((user, idx) => {
      const oldUser = users[idx];
      return (
        user.accuracy !== oldUser.accuracy ||
        user.completion !== oldUser.completion ||
        user.wpm !== oldUser.wpm
      );
    });

    if (hasChanged) {
      socket.emit("game-details", updatedUsers, roomCode);
      setUsers(updatedUsers);
    }
  }, [accuracy, percentage, elapsedTime, username, roomCode, users, countdownActive, calculateWPM, paragraph]);

  // Socket event listeners for multiplayer state updates
  useEffect(() => {
    const handleGameDetails = (newUsers) => {
      console.log("Received game details update:", newUsers);
      setUsers(newUsers);
    };

    const handleCompletionMsg = (msg) => {
      toast.success(msg);
    };

    const handleGameOver = (results) => {
      console.log("Game over! Results:", results);
      toast.success("Race complete! Redirecting to leaderboard...");
      setTimeout(() => {
        navigate(`/${roomCode}/results`, { state: { results } });
      }, 1500);
    };

    const handlePlayerLeft = (leftUser) => {
      toast.error(`${leftUser} left the game`);
      setUsers((prev) => prev.filter((u) => u.username !== leftUser));
    };

    socket.on("recieve-game-details", handleGameDetails);
    socket.on("completion-message", handleCompletionMsg);
    socket.on("game-over", handleGameOver);
    socket.on("player-left", handlePlayerLeft);

    return () => {
      socket.off("recieve-game-details", handleGameDetails);
      socket.off("completion-message", handleCompletionMsg);
      socket.off("game-over", handleGameOver);
      socket.off("player-left", handlePlayerLeft);
    };
  }, [roomCode, navigate]);

  const getClassForValidity = (v) => {
    if (v === -1) return "char-untyped";
    if (v === 0) return "char-incorrect";
    return "char-correct";
  };

  if (loading)
    return (
      <div className="container">
        <p className="status muted">Loading game details...</p>
      </div>
    );
  if (error)
    return (
      <div className="container">
        <p className="status error">Error: {error}</p>
      </div>
    );

  return (
    <div className="container game-layout">
      {countdownActive && (
        <div className="countdown-overlay">
          <div className="countdown-content">
            <p className="countdown-subtitle">Get Ready to Type...</p>
            <div className="countdown-number">{countdown}</div>
          </div>
        </div>
      )}

      <div className="game-header">
        <h1>Room Code: {roomCode}</h1>
        <div className="timer-badge">
          Time: {Math.floor(elapsedTime)}s
        </div>
      </div>

      {/* Visual Racing Tracks */}
      <div className="race-tracks card-elevated">
        <h2>Racer Progress</h2>
        <div className="tracks-container">
          {users.map((user, idx) => (
            <div key={idx} className="track-row">
              <div className="track-info">
                <span className={`track-username ${user.username === username ? "me" : ""}`}>
                  {user.username} {user.username === username && "(YOU)"}
                </span>
                <span className="track-stats">
                  {Math.round(user.wpm || 0)} WPM | Acc: {Math.round(user.accuracy || 100)}%
                </span>
              </div>
              <div className="track-road">
                <div 
                  className="track-avatar"
                  style={{ left: `${user.completion}%` }}
                >
                  🏎️
                </div>
                <div className="track-progress-fill" style={{ width: `${user.completion}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-section">
        <div className="game-area card-elevated">
          <div className="game-text" ref={textRef}>
            {paragraph.map((el, i) => (
              <span key={i} className={`char ${getClassForValidity(el.valid)}`}>
                {i === index && <span className="caret" />}
                {el.letter}
              </span>
            ))}
            {index >= paragraph.length && (
              <span
                className="char char-untyped"
                style={{ display: "inline-block", width: 0 }}
              >
                <span className="caret" />
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="stats-strip" style={{ marginTop: "1rem" }}>
        <div className="stat-card">
          <span className="stat-value">{wpm}</span>
          <span className="stat-label">WPM</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{accuracy}%</span>
          <span className="stat-label">Accuracy</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{percentage}%</span>
          <span className="stat-label">Completion</span>
        </div>
      </div>

      {percentage >= 100 && (
        <p className="status success text-center" style={{ marginTop: "1.5rem" }}>
          Finished! Waiting for other racers...
        </p>
      )}
    </div>
  );
}

