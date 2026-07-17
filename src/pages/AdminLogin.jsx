import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";
import "../styles/AdminLogin.css";

function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem("adminAuth") === "true") {
      navigate("/admin", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = () => {
    setError("");

    if (!password.trim()) {
      setError("אנא הזן סיסמה");
      return;
    }

    if (password.trim() !== "segel") {
      setError("הסיסמה שגויה");
      return;
    }

    localStorage.setItem("adminAuth", "true");
    navigate("/admin", { replace: true });
  };

  return (
    <div className="login-container admin-login-container">
      <div className="login-card admin-login-card">
        <div className="logo-container">
          <img src="/logo.png" alt="MDA Logo" className="logo" />
        </div>

        <h1>כניסה לפאנל ניהול</h1>
        <p className="subtitle">הזן את סיסמת האדמין כדי לגשת לפאנל.</p>

        <input
          type="password"
          placeholder="סיסמת אדמין"
          dir="auto"
          lang="he"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="error-message">{error}</p>}

        <button onClick={handleSubmit}>היכנס</button>
      </div>
    </div>
  );
}

export default AdminLogin;
