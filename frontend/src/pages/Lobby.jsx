import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import socket from "../socket";

export default function Lobby() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [ready, setReady] = useState(false);

  console.log("Lobby component - Socket ID:", socket.id);
  console.log("Lobby component - Room Code:", roomCode);

  // Fetch already existing users in room
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        console.log("Fetching users for room:", roomCode);
        const res = await axios.get(`/api/${roomCode}/getAllUsers`);
        console.log("Fetched users:", res.data.users);
        setUsers(res.data.users);

        const resp = await axios.get("/api/getUser", {
          params: {
            socketID: socket.id,
            roomCode: roomCode,
          },
        });

        console.log("Current Page user:", resp.data.username);
        setUsername(resp.data.username);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError(err.message);
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [roomCode]);

  // Join the socket.io room for this lobby
  useEffect(() => {
    if (roomCode) {
      socket.emit("join-room", roomCode);
    }
  }, [roomCode]);

  useEffect(() => {
    console.log("Setting up socket listeners for room:", roomCode);

    const handleUserListUpdated = (updatedUsers) => {
      console.log("User list updated event received:", updatedUsers);
      setUsers(updatedUsers);
      
      // Update local ready state if our status changed on server
      const me = updatedUsers.find(u => u.username === username);
      if (me) {
        setReady(me.ready);
      }
    };

    const handleStartCountdown = () => {
      toast.success("Game starting!");
      navigate(`/${roomCode}/game`);
    };

    const handlePlayerLeft = (leftUsername) => {
      toast.error(`${leftUsername} left the room`);
    };

    socket.on("user-list-updated", handleUserListUpdated);
    socket.on("start-countdown", handleStartCountdown);
    socket.on("player-left", handlePlayerLeft);

    // Cleanup
    return () => {
      console.log("Cleaning up socket listeners");
      socket.off("user-list-updated", handleUserListUpdated);
      socket.off("start-countdown", handleStartCountdown);
      socket.off("player-left", handlePlayerLeft);
    };
  }, [roomCode, navigate, username]);

  const toggleUserReady = () => {
    const updatedUsers = users.map((user) =>
      user.username === username ? { ...user, ready: !user.ready } : user
    );

    // Emit updated details to server
    socket.emit("send-user-details", updatedUsers, roomCode);
  };

  if (loading)
    return (
      <div className="container">
        <p className="status muted">Loading...</p>
      </div>
    );
  if (error)
    return (
      <div className="container">
        <p className="status error">Error: {error}</p>
      </div>
    );

  return (
    <div className="container">
      <div className="lobby-card card-elevated">
        <h1>Lobby — Room: {roomCode}</h1>
        <h2>Players ({users.length})</h2>
        <div className="user-list">
          {users.length === 0 ? (
            <p className="status muted">No users in the lobby yet...</p>
          ) : (
            users.map((user, index) => (
              <div key={index} className="user-item">
                <span
                  style={{
                    color:
                      user.username === username ? "var(--accent)" : "inherit",
                    fontWeight: user.username === username ? "bold" : "normal"
                  }}
                >
                  {user.username}
                  {user.username === username && " (YOU)"}
                </span>
                <span
                  className={`ready-badge ${user.ready ? "ready" : "not-ready"}`}
                >
                  {user.ready ? "Ready" : "Not Ready"}
                </span>
              </div>
            ))
          )}
        </div>

        {users.length > 0 && (
          <button
            className="btn"
            onClick={toggleUserReady}
            style={{ marginTop: "1.5rem", width: "100%" }}
          >
            {ready ? "Set Not Ready" : "Set Ready"}
          </button>
        )}
      </div>
    </div>
  );
}
