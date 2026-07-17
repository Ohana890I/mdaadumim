import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  doc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import "../styles/ActivateAccount.css";

function ActivateAccount() {
  const navigate = useNavigate();
  const [activationCode, setActivationCode] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [activated, setActivated] = useState(false);

  const normalizeName = (value) =>
    value
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  const activate = async () => {
    setMessage("");
    setMessageType("");

    const code = activationCode.trim().toUpperCase();

    if (!code) {
      setMessage("יש להזין קוד הפעלה");
      setMessageType("error");
      return;
    }

    if (!password.trim()) {
      setMessage("יש להזין סיסמה");
      setMessageType("error");
      return;
    }

    if (password.length < 4) {
      setMessage("הסיסמה חייבת להיות באורך מינימום 4 תווים");
      setMessageType("error");
      return;
    }

    try {
      const codeQuery = query(
        collection(db, "pendingUsers"),
        where("activationCode", "==", code)
      );
      const pendingSnapshot = await getDocs(codeQuery);

      if (pendingSnapshot.empty) {
        setMessage("קוד הפעלה לא קיים");
        setMessageType("error");
        return;
      }

      const pendingDoc = pendingSnapshot.docs[0];
      const pendingData = pendingDoc.data();

      if (pendingData.activated) {
        setMessage("קוד זה כבר הופעל בעבר");
        setMessageType("error");
        return;
      }

      const fullName = (pendingData.fullName || "").trim();
      const role = pendingData.role || "מתנדב חדש";

      if (!fullName) {
        setMessage("משתמש ההזמנה אינו תקין");
        setMessageType("error");
        return;
      }

      const usersSnapshot = await getDocs(collection(db, "users"));
      const fullNameExists = usersSnapshot.docs.some((docItem) => {
        const user = docItem.data();
        return normalizeName(user.fullName || "") === normalizeName(fullName);
      });

      if (fullNameExists) {
        setMessage("כבר קיים משתמש עם אותו שם מלא");
        setMessageType("error");
        return;
      }

      await addDoc(collection(db, "users"), {
        fullName,
        username: fullName,
        role,
        password,
        approved: true,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "pendingUsers", pendingDoc.id), {
        activated: true,
      });

      setActivated(true);
      setMessage("החשבון הופעל בהצלחה. ניתן להתחבר למערכת.");
      setMessageType("success");
      setActivationCode("");
      setPassword("");

      setTimeout(() => {
        navigate("/");
      }, 1200);
    } catch (error) {
      console.error(error);
      setMessage("אירעה שגיאה בהפעלת החשבון");
      setMessageType("error");
    }
  };

  return (
    <div className="activate-container">
      <div className="activate-card">
        <h1>הפעלת חשבון</h1>
        <p className="subtitle">
          הזן קוד הפעלה וסיסמה כדי להפעיל משתמש שנוצר עבורך על ידי האדמין.
        </p>

        <input
          type="text"
          placeholder="קוד הפעלה"
          value={activationCode}
          onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
        />

        <input
          type="password"
          placeholder="סיסמה"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {message && (
          <p className={messageType === "success" ? "success-message" : "error-message"}>
            {message}
          </p>
        )}

        <button onClick={activate} disabled={activated}>
          הפעל חשבון
        </button>

        <p className="activate-link">
          כבר הופעל חשבון?
          <Link to="/"> חזרה להתחברות</Link>
        </p>
      </div>
    </div>
  );
}

export default ActivateAccount;
