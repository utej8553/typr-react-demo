import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        if (!formData.email || !formData.password) {
          toast.error("Please fill in all fields");
          return;
        }
        await login(formData.email, formData.password);
        toast.success("Hi!, Welcome back!");
        navigate("/");
      } else {
        if (!formData.username || !formData.email || !formData.password) {
          toast.error("Please fill in all fields");
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          toast.error("Passwords do not match");
          return;
        }
        await register(formData.username, formData.email, formData.password);
        toast.success("Account created successfully!");
        navigate("/");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-screen">
      <div className="setup-card" style={{ maxWidth: '400px' }}>
        <div className="setup-header">
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⌨️</div>
          <h1>{isLogin ? "Welcome Back" : "Join Typr"}</h1>
          <p>{isLogin ? "Log in to your account" : "Create an account to track your stats"}</p>
        </div>

        <div className="tabs" style={{ marginBottom: '1.5rem' }}>
          <button className={`tab ${isLogin ? "active" : ""}`} onClick={() => setIsLogin(true)}>Login</button>
          <button className={`tab ${!isLogin ? "active" : ""}`} onClick={() => setIsLogin(false)}>Sign Up</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isLogin && (
            <div className="field">
              <label className="field-label">Username</label>
              <input className="field-input" type="text" name="username" placeholder="Username" value={formData.username} onChange={handleChange} disabled={loading} maxLength={20} />
            </div>
          )}
          <div className="field">
            <label className="field-label">Email</label>
            <input className="field-input" type="email" name="email" placeholder="Email address" value={formData.email} onChange={handleChange} disabled={loading} />
          </div>
          <div className="field">
            <label className="field-label">Password</label>
            <input className="field-input" type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} disabled={loading} />
          </div>
          {!isLogin && (
            <div className="field">
              <label className="field-label">Confirm Password</label>
              <input className="field-input" type="password" name="confirmPassword" placeholder="Confirm password" value={formData.confirmPassword} onChange={handleChange} disabled={loading} />
            </div>
          )}

          <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
            {loading ? <><span className="spinner" />&nbsp;Please wait…</> : (isLogin ? "Log In" : "Sign Up")}
          </button>
        </form>
      </div>
    </div>
  );
}
