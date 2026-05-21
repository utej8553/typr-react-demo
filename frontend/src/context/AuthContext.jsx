import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { setSocketToken } from "../socket";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("typr_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      localStorage.setItem("typr_token", token);
      setSocketToken(token);
      refreshProfile();
    } else {
      delete axios.defaults.headers.common["Authorization"];
      localStorage.removeItem("typr_token");
      setSocketToken(null);
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  const refreshProfile = async () => {
    try {
      const res = await axios.get("/api/auth/profile");
      setUser(res.data.user);
    } catch (err) {
      console.error("Failed to fetch profile", err);
      if (err.response?.status === 401) {
        setToken(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await axios.post("/api/auth/login", { email, password });
    if (res.data.success) {
      setToken(res.data.token);
      setUser(res.data.user);
    }
    return res.data;
  };

  const register = async (username, email, password) => {
    const res = await axios.post("/api/auth/register", { username, email, password });
    if (res.data.success) {
      setToken(res.data.token);
      setUser(res.data.user);
    }
    return res.data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const updateUsername = async (newUsername) => {
    const res = await axios.patch("/api/auth/profile", { username: newUsername });
    if (res.data.success) {
      setToken(res.data.token);
      setUser(res.data.user);
    }
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshProfile, updateUsername }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
