import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import "../styles/Volunteers.css";

function Volunteers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [roleDrafts, setRoleDrafts] = useState({});
  const [savingRoleUserId, setSavingRoleUserId] = useState("");

  useEffect(() => {
    if (localStorage.getItem("adminAuth") !== "true") {
      navigate("/admin/login", { replace: true });
      return;
    }

    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const usersData = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      setUsers(usersData);
    });

    return () => {
      unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    const drafts = {};
    users.forEach((user) => {
      drafts[user.id] = user.role || "מתנדב חדש";
    });
    setRoleDrafts(drafts);
  }, [users]);

  const toggleBlockUser = async (user) => {
    try {
      const blocked = !!user.blocked;

      await updateDoc(doc(db, "users", user.id), {
        blocked: !blocked,
        blockedAt: !blocked ? new Date() : null,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const saveRole = async (user) => {
    const selectedRole = roleDrafts[user.id] || "מתנדב חדש";

    if (selectedRole === user.role) {
      return;
    }

    try {
      setSavingRoleUserId(user.id);
      await updateDoc(doc(db, "users", user.id), {
        role: selectedRole,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setSavingRoleUserId("");
    }
  };

  return (
    <div className="volunteers-container">
      <div className="volunteers-card">
        <div className="volunteers-header">
          <h1>ניהול מתנדבים</h1>
          <button className="back-btn" onClick={() => navigate("/admin")}>
            חזרה לאדמין
          </button>
        </div>

        <p className="volunteers-subtitle">
          חסימת חשבון תמנע התחברות עד פתיחה מחדש.
        </p>

        <div className="volunteers-list">
          {users.length === 0 ? (
            <p>אין משתמשים להצגה כרגע.</p>
          ) : (
            users.map((user) => (
              <div className="volunteer-row" key={user.id}>
                <div>
                  <h3>{user.fullName || "ללא שם"}</h3>
                  <p>{user.username || "ללא שם משתמש"}</p>
                  <p className="role-text">תפקיד נוכחי: {user.role || "לא הוגדר"}</p>
                </div>

                <div className="volunteer-actions">
                  <span className={user.blocked ? "status-badge blocked" : "status-badge active"}>
                    {user.blocked ? "חסום" : "פעיל"}
                  </span>

                  <select
                    className="role-select"
                    value={roleDrafts[user.id] || "מתנדב חדש"}
                    onChange={(e) =>
                      setRoleDrafts((prev) => ({
                        ...prev,
                        [user.id]: e.target.value,
                      }))
                    }
                  >
                    <option value="מתנדב חדש">מתנדב חדש</option>
                    <option value="מתנדב ותיק">מתנדב ותיק</option>
                    <option value="אחמ״ש">אחמ״ש</option>
                  </select>

                  <button
                    className="save-role-btn"
                    onClick={() => saveRole(user)}
                    disabled={savingRoleUserId === user.id}
                  >
                    {savingRoleUserId === user.id ? "שומר..." : "שמור תפקיד"}
                  </button>

                  <button
                    className={user.blocked ? "unblock-btn" : "block-btn"}
                    onClick={() => toggleBlockUser(user)}
                  >
                    {user.blocked ? "פתח חשבון" : "חסום חשבון"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Volunteers;
