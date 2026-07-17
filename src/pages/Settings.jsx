import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, query, collection, where, getDocs, updateDoc } from "firebase/firestore";
import Navbar from "../components/Navbar";
import { db } from "../services/firebase";
import "../styles/Settings.css";

function Settings() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
  const [fullName, setFullName] = useState(currentUser?.fullName || "");
  const [username, setUsername] = useState(currentUser?.username || "");
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletionRequested, setDeletionRequested] = useState(
    currentUser?.deletionRequested || false
  );

  useEffect(() => {
    if (!currentUser?.id) {
      navigate("/");
    }
  }, [currentUser?.id, navigate]);

  useEffect(() => {
    const loadDeleteStatus = async () => {
      if (!currentUser?.id) return;

      try {
        const snapshot = await getDoc(doc(db, "users", currentUser.id));
        if (snapshot.exists()) {
          setDeletionRequested(!!snapshot.data().deletionRequested);
        }
      } catch (error) {
        console.error(error);
      }
    };

    loadDeleteStatus();
  }, [currentUser?.id]);

  if (!currentUser?.id) {
    return null;
  }

  const saveProfile = async () => {
    setProfileMessage("");

    if (!fullName.trim()) {
      setProfileMessage("אנא הזן שם מלא");
      return;
    }

    if (!username.trim()) {
      setProfileMessage("אנא הזן שם משתמש");
      return;
    }

    try {
      const usersRef = collection(db, "users");
      const duplicateSnapshot = await getDocs(
        query(usersRef, where("username", "==", username.trim()))
      );

      const duplicate = duplicateSnapshot.docs.find(
        (docItem) => docItem.id !== currentUser.id
      );

      if (duplicate) {
        setProfileMessage("שם המשתמש תפוס, בחר שם אחר");
        return;
      }

      await updateDoc(doc(db, "users", currentUser.id), {
        fullName: fullName.trim(),
        username: username.trim(),
      });

      const updatedUser = {
        ...currentUser,
        fullName: fullName.trim(),
        username: username.trim(),
      };

      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
      setProfileMessage("הפרטים נשמרו בהצלחה");
    } catch (error) {
      console.error(error);
      setProfileMessage("אירעה שגיאה בשמירת הפרטים");
    }
  };

  const changePassword = async () => {
    setPasswordMessage("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage("יש למלא את כל שדות הסיסמה");
      return;
    }

    if (newPassword.length < 4) {
      setPasswordMessage("הסיסמה החדשה חייבת להיות לפחות 4 תווים");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage("אימות הסיסמה אינו תואם");
      return;
    }

    try {
      const userRef = doc(db, "users", currentUser.id);
      const snapshot = await getDoc(userRef);

      if (!snapshot.exists()) {
        setPasswordMessage("המשתמש לא נמצא");
        return;
      }

      const data = snapshot.data();
      if (data.password !== currentPassword) {
        setPasswordMessage("הסיסמה הנוכחית שגויה");
        return;
      }

      await updateDoc(userRef, {
        password: newPassword,
      });

      localStorage.setItem(
        "currentUser",
        JSON.stringify({ ...currentUser, password: newPassword })
      );

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("הסיסמה עודכנה בהצלחה");
    } catch (error) {
      console.error(error);
      setPasswordMessage("אירעה שגיאה בעדכון הסיסמה");
    }
  };

  const requestDeleteAccount = async () => {
    setDeleteMessage("");

    if (deletionRequested) {
      setDeleteMessage("בקשת מחיקה כבר נשלחה וממתינה לטיפול.");
      return;
    }

    const confirmed = window.confirm(
      "לשלוח בקשת מחיקת חשבון? ניתן לבטל דרך האדמין."
    );

    if (!confirmed) {
      setDeleteMessage("הבקשה בוטלה");
      return;
    }

    try {
      await updateDoc(doc(db, "users", currentUser.id), {
        deletionRequested: true,
        deletionRequestedAt: new Date(),
      });

      const updatedUser = {
        ...currentUser,
        deletionRequested: true,
      };

      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
      setDeletionRequested(true);
      setDeleteMessage(
        "בקשת מחיקה נשלחה בהצלחה. מתבצעת התנתקות..."
      );

      setTimeout(() => {
        localStorage.removeItem("currentUser");
        navigate("/");
      }, 1200);
    } catch (error) {
      console.error(error);
      setDeleteMessage("אירעה שגיאה בשליחת בקשת המחיקה");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/");
  };

  return (
    <>
      <Navbar />
      <div className="settings-container">
        <div className="settings-card">
          <h1>הגדרות</h1>
          <p className="settings-subtitle">ניהול פרטי המשתמש שלך</p>

          <section className="settings-section">
            <h2>פרטים אישיים</h2>

            <div className="settings-field">
              <label>שם מלא</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="settings-field">
              <label>שם משתמש</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="settings-row">
              <span>תפקיד</span>
              <strong>{currentUser?.role || "-"}</strong>
            </div>

            {profileMessage && (
              <p className="settings-message">{profileMessage}</p>
            )}

            <button className="primary-btn" onClick={saveProfile}>
              שמור פרטים
            </button>
          </section>

          <section className="settings-section">
            <h2>שינוי סיסמה</h2>

            <div className="settings-field">
              <label>סיסמה נוכחית</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="settings-field">
              <label>סיסמה חדשה</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="settings-field">
              <label>אימות סיסמה חדשה</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {passwordMessage && (
              <p className="settings-message">{passwordMessage}</p>
            )}

            <button className="primary-btn" onClick={changePassword}>
              עדכן סיסמה
            </button>
          </section>

          <section className="settings-section danger-section">
            <h2>מחיקת חשבון</h2>
            <p>
              ניתן לשלוח בקשת מחיקה. לאחר השליחה תנותק מהחשבון.
            </p>

            {deleteMessage && (
              <p className="settings-message">{deleteMessage}</p>
            )}

            <button
              className="danger-btn"
              onClick={requestDeleteAccount}
              disabled={deletionRequested}
            >
              {deletionRequested ? "בקשה נשלחה" : "בקש מחיקת חשבון"}
            </button>
          </section>

          <div className="settings-actions">
            <button className="primary-btn" onClick={() => navigate("/home")}>
              חזרה לדף הבית
            </button>
            <button className="secondary-btn" onClick={handleLogout}>
              התנתק מהחשבון
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default Settings;
