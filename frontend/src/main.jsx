import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import axios from "axios";

// Configure dynamic API base URL: 
// if loaded from dev port 3000, hit backend on port 5000 of the same hostname.
// Otherwise, use relative path (current origin).
const { protocol, hostname, port } = window.location;
if (port === "3000") {
  axios.defaults.baseURL = `${protocol}//${hostname}:5000`;
}

createRoot(document.getElementById("root")).render(<App />);
