import "./App.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import LoginPage from "./pages/LoginPage";
import Lobby from "./pages/Lobby";
import Game from "./pages/Game";
import Result from "./pages/Result";

function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1a1a1f",
            color: "#f0f0f3",
            border: "1px solid rgba(255,255,255,0.07)",
            fontSize: "0.875rem",
            borderRadius: "8px",
          },
        }}
      />

      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/:roomCode/lobby" element={<Lobby />} />
          <Route path="/:roomCode/game" element={<Game />} />
          <Route path="/:roomCode/results" element={<Result />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
