import { io } from "socket.io-client";

const { protocol, hostname, port } = window.location;
const socketUrl = port === "3000" 
  ? `${protocol}//${hostname}:5000` 
  : `${protocol}//${hostname}${port ? `:${port}` : ""}`;

const socket = io(socketUrl, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  path: "/api/ws",
});

export const setSocketToken = (token) => {
  if (token) {
    socket.auth = { token };
  } else {
    socket.auth = {};
  }
};

export default socket;
