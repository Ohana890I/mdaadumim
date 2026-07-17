import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/Login.css";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../services/firebase";


function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

 const handleLogin = async () => {
    setError("");

    if (!username.trim()) {
      setError("אנא הזן שם משתמש");
      return;
    }
    if (!password.trim()) {
      setError("אנא הזן סיסמה");
      return;
    }

    // Check user credentials
 try {

  const q = query(
    collection(db, "users"),
    where("username", "==", username)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    setError("שם משתמש או סיסמה לא נכונים");
    return;
  }

  const user = {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data(),
  };

  if (user.password !== password) {
    setError("שם משתמש או סיסמה לא נכונים");
    return;
  }

  if (user.blocked) {
    setError("החשבון חסום. יש לפנות לאדמין לפתיחת החשבון");
    return;
  }

  if (!user.approved) {
    setError("החשבון ממתין לאישור אחראי השיבוץ");
    return;
  }

  localStorage.setItem(
    "currentUser",
    JSON.stringify(user)
  );

 navigate("/home");

} catch (error) {
  console.error(error);
  setError("אירעה שגיאה בהתחברות");
}
  };

  return (
    <div className="login-container">
      <div className="login-card">

        <div className="logo-container">
          <img
            src="/logo.png"
            alt="MDA Logo"
            className="logo"
          />
        </div>

        <h1>התחברות</h1>

        <p className="subtitle">
          מערכת ניהול ושיבוץ מתנדבים
        </p>

        <input
          type="text"
          placeholder="שם משתמש"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          placeholder="סיסמה"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="error-message">{error}</p>}

        <button onClick={handleLogin}>
          התחבר
        </button>

        <p className="register-link">
          יש לך קוד הפעלה?
          <Link to="/activate"> הפעל חשבון</Link>
        </p>

      </div>
    </div>
  );
}

export default Login;
