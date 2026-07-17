import { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/Register.css";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { reconcileNewUserReferences } from "../utils/userReconcile";


function Register() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    setError("");

    // Validation
    if (!fullName.trim()) {
      setError("אנא הזן שם מלא");
      return;
    }
    if (!username.trim()) {
      setError("אנא הזן שם משתמש");
      return;
    }
    if (!password.trim()) {
      setError("אנא הזן סיסמה");
      return;
    }
    if (password.length < 4) {
      setError("הסיסמה חייבת להיות באורך מינימום 4 תווים");
      return;
    }
    if (!role) {
      setError("אנא בחר תפקיד");
      return;
    }

    // Check for duplicates
try {

  const usersRef = collection(db, "users");

  const q = query(
    usersRef,
    where("username", "==", username)
  );

  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    setError("שם משתמש זה כבר קיים");
    return;
  }

  const cleanedFullName = fullName.trim();
  const cleanedUsername = username.trim();

  const createdUserRef = await addDoc(usersRef, {
    fullName: cleanedFullName,
    username: cleanedUsername,
    password,
    role,
    approved: false,
    createdAt: new Date(),
  });

  try {
    await reconcileNewUserReferences({
      userId: createdUserRef.id,
      fullName: cleanedFullName,
      username: cleanedUsername,
    });
  } catch (reconcileError) {
    console.error("Reconcile warning:", reconcileError);
  }

  setRegistered(true);

} catch (err) {
  console.error(err);
  setError("אירעה שגיאה ביצירת החשבון");
}
  };

  return (
    <div className="register-container">
      <div className="register-card">

        {!registered ? (
          <>
            <h1>הרשמה למערכת</h1>
            <p className="subtitle">
              מערכת ניהול ושיבוץ מתנדבים
            </p>

            <input 
              type="text" 
              placeholder="שם מלא"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />

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

            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">בחר תפקיד</option>
              <option value="מתנדב חדש">מתנדב חדש</option>
              <option value="מתנדב ותיק">מתנדב ותיק</option>
              <option value="אחמ״ש">אחמ״ש</option>
            </select>

            {error && <p className="error-message">{error}</p>}

            <button onClick={handleRegister}>
              יצירת חשבון
            </button>

            <p className="login-link">
              יש לך חשבון?
              <Link to="/"> התחבר</Link>
            </p>


          </>
        ) : (
          <div className="success-box">
            <div className="success-icon">✓</div>

            <h2>ההרשמה נקלטה בהצלחה</h2>

            <p>
              החשבון שלך נוצר וממתין לאישור
              אחראי השיבוץ.
            </p>

            <p>
              לאחר האישור תוכל להתחבר ולהגיש
              שיבוץ למשמרות.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

export default Register;