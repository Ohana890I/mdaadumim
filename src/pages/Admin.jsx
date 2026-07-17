import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { useNavigate } from "react-router-dom";

import { db } from "../services/firebase";
import "../styles/Admin.css";

function Admin() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [pendingActivations, setPendingActivations] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [volunteerName, setVolunteerName] = useState("");
  const [volunteerRole, setVolunteerRole] = useState("מתנדב חדש");
  const [userSearch, setUserSearch] = useState("");
  const [adminFeedback, setAdminFeedback] = useState({
    type: "",
    message: "",
  });
  const pendingUsers = users.filter((user) => !user.approved);
  const deletionRequests = users.filter((user) => user.deletionRequested);
  const filteredUsers = users.filter((user) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    const fullName = (user.fullName || "").toLowerCase();
    const username = (user.username || "").toLowerCase();
    const role = (user.role || "").toLowerCase();
    return (
      fullName.includes(q) || username.includes(q) || role.includes(q)
    );
  });

  const loadUsers = () => {
    return onSnapshot(collection(db, "users"), (snapshot) => {
      const usersData = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      setUsers(usersData);
    });
  };

  const loadPendingActivations = () => {
    const q = query(collection(db, "pendingUsers"), where("activated", "==", false));

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }))
        .sort((a, b) => {
          const aMs = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const bMs = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return bMs - aMs;
        });

      setPendingActivations(data);
    });
  };

  const loadAnnouncements = async () => {
    const q = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    setAnnouncements(
      snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }))
    );
  };

  const publishAnnouncement = async () => {
    if (!newAnnouncement.trim()) return;

    await addDoc(collection(db, "announcements"), {
      message: newAnnouncement.trim(),
      createdAt: serverTimestamp(),
    });

    setNewAnnouncement("");
    loadAnnouncements();
  };

  const deleteAnnouncement = async (id) => {
    await deleteDoc(doc(db, "announcements", id));
    loadAnnouncements();
  };

  const formatDate = (value) => {
    if (!value?.toDate) return "";
    return value.toDate().toLocaleString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const loadAvailabilities = async () => {
    const snapshot = await getDocs(
      collection(db, "availabilities")
    );

    const data = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }));

    setAvailabilities(data);
  };

  useEffect(() => {
    if (localStorage.getItem("adminAuth") !== "true") {
      navigate("/admin/login", { replace: true });
      return;
    }
    const unsubscribeUsers = loadUsers();
    const unsubscribePending = loadPendingActivations();
    loadAvailabilities();
    loadAnnouncements();

    return () => {
      if (unsubscribeUsers) {
        unsubscribeUsers();
      }
      if (unsubscribePending) {
        unsubscribePending();
      }
    };
  }, []);

  const normalizeName = (value) =>
    value
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  const generateActivationCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";

    for (let i = 0; i < 8; i += 1) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return code;
  };

  const generateUniqueActivationCode = async () => {
    for (let tries = 0; tries < 12; tries += 1) {
      const candidate = generateActivationCode();
      const q = query(
        collection(db, "pendingUsers"),
        where("activationCode", "==", candidate)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return candidate;
      }
    }

    throw new Error("לא ניתן לייצר קוד ייחודי כרגע");
  };

  const clearFeedbackLater = () => {
    setTimeout(() => {
      setAdminFeedback((prev) => (prev.message ? { type: "", message: "" } : prev));
    }, 3000);
  };

  const createPendingVolunteer = async () => {
    setAdminFeedback({ type: "", message: "" });

    const cleanedName = volunteerName.trim().replace(/\s+/g, " ");

    if (!cleanedName) {
      setAdminFeedback({ type: "error", message: "יש להזין שם מלא" });
      clearFeedbackLater();
      return;
    }

    const normalized = normalizeName(cleanedName);
    const nameExistsInUsers = users.some(
      (user) => normalizeName(user.fullName || "") === normalized
    );
    const nameExistsInPending = pendingActivations.some(
      (item) => normalizeName(item.fullName || "") === normalized
    );

    if (nameExistsInUsers || nameExistsInPending) {
      setAdminFeedback({
        type: "error",
        message: "כבר קיים משתמש עם אותו שם מלא",
      });
      clearFeedbackLater();
      return;
    }

    try {
      const activationCode = await generateUniqueActivationCode();

      await addDoc(collection(db, "pendingUsers"), {
        fullName: cleanedName,
        role: volunteerRole,
        activationCode,
        activated: false,
        createdAt: serverTimestamp(),
      });

      setVolunteerName("");
      setVolunteerRole("מתנדב חדש");
      setAdminFeedback({ type: "success", message: "מתנדב נוצר בהצלחה" });
      clearFeedbackLater();
    } catch (error) {
      console.error(error);
      setAdminFeedback({ type: "error", message: "יצירת מתנדב נכשלה" });
      clearFeedbackLater();
    }
  };

  const copyActivationCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setAdminFeedback({ type: "success", message: "קוד ההפעלה הועתק" });
      clearFeedbackLater();
    } catch (error) {
      console.error(error);
      setAdminFeedback({ type: "error", message: "לא ניתן להעתיק קוד כרגע" });
      clearFeedbackLater();
    }
  };

  const regenerateActivationCode = async (pendingUserId) => {
    try {
      const activationCode = await generateUniqueActivationCode();
      await updateDoc(doc(db, "pendingUsers", pendingUserId), {
        activationCode,
      });
      setAdminFeedback({ type: "success", message: "קוד חדש נוצר" });
      clearFeedbackLater();
    } catch (error) {
      console.error(error);
      setAdminFeedback({ type: "error", message: "יצירת קוד חדש נכשלה" });
      clearFeedbackLater();
    }
  };

  const toggleUserBlock = async (user) => {
    try {
      const isBlocked = !!user.blocked;
      await updateDoc(doc(db, "users", user.id), {
        blocked: !isBlocked,
        blockedAt: !isBlocked ? serverTimestamp() : null,
      });
      setAdminFeedback({
        type: "success",
        message: !isBlocked ? "המשתמש הושבת" : "המשתמש הופעל מחדש",
      });
      clearFeedbackLater();
    } catch (error) {
      console.error(error);
      setAdminFeedback({ type: "error", message: "פעולת ההשבתה נכשלה" });
      clearFeedbackLater();
    }
  };

  const removeUser = async (userId) => {
    try {
      await deleteDoc(doc(db, "users", userId));
      setAdminFeedback({ type: "success", message: "המשתמש נמחק" });
      clearFeedbackLater();
    } catch (error) {
      console.error(error);
      setAdminFeedback({ type: "error", message: "מחיקת המשתמש נכשלה" });
      clearFeedbackLater();
    }
  };

  const approveUser = async (id) => {
    await updateDoc(doc(db, "users", id), {
      approved: true,
    });
  };

  const rejectUser = async (id) => {
    await deleteDoc(doc(db, "users", id));
  };

  const approveDeletionRequest = async (id) => {
    await deleteDoc(doc(db, "users", id));
  };

  const cancelDeletionRequest = async (id) => {
    await updateDoc(doc(db, "users", id), {
      deletionRequested: false,
      deletionRequestedAt: null,
    });
  };

  return (
    <div className="admin-container">
      <div className="admin-card">
        <div className="admin-header">
          <div>
            <h1>פאנל מנהל</h1>
            <p>ניהול משתמשים, הודעות וזמינות מרכזית.</p>
          </div>

          <div className="header-actions">
            <button
              className="action-btn"
              onClick={() =>
                window.location.href =
                "/admin/draft"
              }
            >
               טיוטת שיבוץ
            </button>
            <button
              className="action-btn"
              onClick={() => navigate("/admin/volunteers")}
            >
              👥 מתנדבים
            </button>
            <button
              className="action-btn"
              onClick={() => navigate("/admin/recent-schedules")}
            >
               שיבוצים אחרונים
            </button>
            <button
              className="action-btn"
              onClick={() => navigate("/admin/statistics")}
            >
              📊 סטטיסטיקות
            </button>
            <button
              className="action-btn secondary"
              onClick={loadAnnouncements}
            >
               רענן הודעות
            </button>
            <button
              className="action-btn logout-btn"
              onClick={() => {
                localStorage.removeItem("adminAuth");
                navigate("/", { replace: true });
              }}
            >
               התנתק
            </button>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <span>הודעות פעולות</span>
            <strong>{announcements.length}</strong>
          </div>
          <div className="dashboard-card">
            <span>הזמנות ממתינות להפעלה</span>
            <strong>{pendingActivations.length}</strong>
          </div>
          <div className="dashboard-card">
            <span>הגשות זמינות</span>
            <strong>{availabilities.length}</strong>
          </div>
        </div>

        {adminFeedback.message && (
          <div className={`admin-feedback ${adminFeedback.type}`}>
            {adminFeedback.message}
          </div>
        )}

        <div className="admin-sections">
          <section className="panel volunteer-management-panel">
            <div className="panel-header">
              <h2>ניהול מתנדבים</h2>
              <span>יצירת הזמנות, השבתה ומחיקה</span>
            </div>

            <div className="invite-form-card">
              <h3>➕ צור מתנדב</h3>
              <div className="invite-form-grid">
                <input
                  type="text"
                  placeholder="שם מלא"
                  value={volunteerName}
                  onChange={(e) => setVolunteerName(e.target.value)}
                />
                <select
                  value={volunteerRole}
                  onChange={(e) => setVolunteerRole(e.target.value)}
                >
                  <option value="אחמ״ש">אחמ״ש</option>
                  <option value="מתנדב ותיק">ותיק</option>
                  <option value="מתנדב חדש">חדש</option>
                </select>
                <button className="action-btn" onClick={createPendingVolunteer}>
                  צור מתנדב
                </button>
              </div>
            </div>

            <div className="pending-list">
              <h3>מתנדבים שטרם הופעלו</h3>
              {pendingActivations.length === 0 ? (
                <p>אין כרגע משתמשים ממתינים להפעלה.</p>
              ) : (
                pendingActivations.map((item) => (
                  <div className="user-card" key={item.id}>
                    <div className="user-details">
                      <h3>{item.fullName}</h3>
                      <p>{item.role}</p>
                      <p>קוד הפעלה: {item.activationCode}</p>
                    </div>

                    <div className="actions">
                      <button
                        className="approve-btn"
                        onClick={() => copyActivationCode(item.activationCode)}
                      >
                        📋 העתק קוד
                      </button>
                      <button
                        className="cancel-delete-btn"
                        onClick={() => regenerateActivationCode(item.id)}
                      >
                        🔄 צור קוד חדש
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="users-search-row">
              <input
                type="text"
                placeholder="חיפוש לפי שם, שם משתמש או תפקיד"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>

            <div className="pending-list">
              <h3>משתמשים פעילים במערכת</h3>
              {filteredUsers.length === 0 ? (
                <p>לא נמצאו משתמשים.</p>
              ) : (
                filteredUsers.map((user) => (
                  <div className="user-card" key={user.id}>
                    <div className="user-details">
                      <h3>{user.fullName || "ללא שם"}</h3>
                      <p>{user.username || "ללא שם משתמש"}</p>
                      <p>{user.role || "ללא תפקיד"}</p>
                    </div>

                    <div className="actions">
                      <button
                        className={user.blocked ? "cancel-delete-btn" : "reject-btn"}
                        onClick={() => toggleUserBlock(user)}
                      >
                        {user.blocked ? "הפעל משתמש" : "השבת משתמש"}
                      </button>
                      <button
                        className="reject-btn"
                        onClick={() => removeUser(user.id)}
                      >
                        מחק משתמש
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="panel announcement-panel">
            <div className="panel-header">
              <h2>פרסום הודעה</h2>
              <span>שלח הודעות ישירות לדף הבית</span>
            </div>
            <textarea
              value={newAnnouncement}
              onChange={(e) =>
                setNewAnnouncement(e.target.value)
              }
              placeholder="כתוב כאן הודעה חדשה..."
            />
            <button
              className="publish-btn"
              onClick={publishAnnouncement}
            >
              פרסם הודעה
            </button>

            <div className="announcement-list-admin">
              <h3>הודעות שפורסמו</h3>
              {announcements.length === 0 ? (
                <p>עדיין לא פורסמו הודעות.</p>
              ) : (
                announcements.map((item) => (
                  <div
                    className="announcement-card-admin"
                    key={item.id}
                  >
                    <div>
                      <p>{item.message}</p>
                      {item.createdAt && (
                        <span>
                          {formatDate(item.createdAt)}
                        </span>
                      )}
                    </div>
                    <button
                      className="delete-announcement-btn"
                      onClick={() =>
                        deleteAnnouncement(item.id)
                      }
                    >
                      מחק
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="panel approval-panel">
            <div className="panel-header">
              <h2>אישור משתמשים</h2>
              <span>משתמשים שממתינים לאישור</span>
            </div>
            {pendingUsers.length === 0 ? (
              <p>אין משתמשים ממתינים כרגע.</p>
            ) : (
              pendingUsers.map((user) => (
                  <div
                    className="user-card"
                    key={user.id}
                  >
                    <div>
                      <h3>{user.fullName}</h3>
                      <p>{user.role}</p>
                    </div>

                    <div className="actions">
                      <button
                        className="approve-btn"
                        onClick={() =>
                          approveUser(user.id)
                        }
                      >
                        אשר
                      </button>
                      <button
                        className="reject-btn"
                        onClick={() =>
                          rejectUser(user.id)
                        }
                      >
                        דחה
                      </button>
                    </div>
                  </div>
                ))
            )}
          </section>

          <section className="panel approval-panel">
            <div className="panel-header">
              <h2>בקשות מחיקת חשבון</h2>
              <span>משתמשים שביקשו למחוק חשבון</span>
            </div>

            {deletionRequests.length === 0 ? (
              <p>אין בקשות מחיקה כרגע.</p>
            ) : (
              deletionRequests.map((user) => (
                <div className="user-card" key={user.id}>
                  <div>
                    <h3>{user.fullName}</h3>
                    <p>{user.username}</p>
                  </div>

                  <div className="actions">
                    <button
                      className="reject-btn"
                      onClick={() => approveDeletionRequest(user.id)}
                    >
                      אשר מחיקה
                    </button>

                    <button
                      className="cancel-delete-btn"
                      onClick={() => cancelDeletionRequest(user.id)}
                    >
                      בטל בקשה
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        </div>

        <section className="panel availability-panel">
          <div className="panel-header">
            <h2>זמינות שהוגשו</h2>
            <span>צפו בכל ההגשות לשיבוץ השבוע הבא</span>
          </div>
          <p className="section-summary">
            סה״כ הגישו: {availabilities.length}
          </p>
          <div className="availability-list">
            {availabilities.map((item) => (
              <div
                className="user-card"
                key={item.id}
              >
                <div>
                  <h3>{item.fullName}</h3>
                  <p>{item.role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Admin;