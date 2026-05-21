import "./App.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import LoginPage from "./pages/LoginPage";
import Lobby from "./pages/Lobby";
import Game from "./pages/Game";
import Result from "./pages/Result";
import AuthPage from "./pages/AuthPage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-state"><span className="spinner" /><span>Loading...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return children;
};

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

      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={<ProtectedRoute><LoginPage /></ProtectedRoute>} />
            <Route path="/:roomCode/lobby" element={<ProtectedRoute><Lobby /></ProtectedRoute>} />
            <Route path="/:roomCode/game" element={<ProtectedRoute><Game /></ProtectedRoute>} />
            <Route path="/:roomCode/results" element={<ProtectedRoute><Result /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </>
  );
}

export default App;
