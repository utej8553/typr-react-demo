import { io } from "socket.io-client";

const { protocol, hostname, port } = window.location;
const socketUrl = port === "3000" 
  ? `${protocol}//${hostname}:5000` 
  : `${protocol}//${hostname}${port ? `:${port}` : ""}`;

// Create socket instance OUTSIDE of any component
const socket = io(socketUrl, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  path: "/api/ws",
});

export default socket;
