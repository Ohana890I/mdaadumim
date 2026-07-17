import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import "../styles/Home.css";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";
import { db } from "../services/firebase";

function Home() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState([]);

  const currentUser = JSON.parse(
    localStorage.getItem("currentUser")
  );

  const now = new Date();

  const day = now.getDay();
  const hour = now.getHours();

  let submissionOpen = false;

  if (day === 3 && hour >= 12) {
    submissionOpen = true;
  }

  if (day === 4 && hour < 21) {
    submissionOpen = true;
  }

  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
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
      } catch (error) {
        console.error(error);
      }
    };

    loadAnnouncements();
  }, []);

  const formatDate = (value) => {
    if (!value?.toDate) return "";
    const date = value.toDate();
    return date.toLocaleString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <Navbar />

      <div className="home-container">

        <div className="welcome-card">
          <h1>
            שלום {currentUser?.fullName} 👋
          </h1>

          <p>{currentUser?.role}</p>
        </div>

        <div className="status-card">

          <h2>מצב הגשת שיבוץ</h2>

          {submissionOpen ? (
            <div className="open-status">
              🟢 פתוח להגשה
            </div>
          ) : (
            <div className="closed-status">
              🔴 סגור להגשה
            </div>
          )}

          <p className="schedule-text">
            הגשת שיבוץ פתוחה בכל יום רביעי
            בשעה 12:00 ונסגרת ביום חמישי
            בשעה 21:00.
          </p>

        </div>

        <div className="cards-grid">

          <div
            className="action-card"
            onClick={() => navigate("/availability")}
          >
            <h2>⏳ הגשת שיבוץ שבועי</h2>

            <p>
              שליחת שיבוץ לשבוע הבא
            </p>
          </div>

          <div
            className="action-card"
            onClick={() => navigate("/schedule")}
          >
            <h2>📅 השיבוץ השבועי</h2>

            <p>
              צפייה בשיבוץ המלא של הנה״ז
            </p>
          </div>

          <div
            className="action-card"
            onClick={() => navigate("/settings")}
          >
            <h2>⚙️ הגדרות חשבון</h2>

            <p>
              ניהול פרטים אישיים והתנתקות
            </p>
          </div>

        </div>

        <div className="announcement-card">

          <h2>📢 הודעות</h2>

          {announcements.length === 0 ? (
            <p>כרגע אין הודעות חדשות.</p>
          ) : (
            <div className="announcement-list">
              {announcements.map((item) => (
                <div
                  className="announcement-item"
                  key={item.id}
                >
                  <p>{item.message}</p>
                  {item.createdAt && (
                    <span className="announcement-date">
                      {formatDate(item.createdAt)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>

      </div>
    </>
  );
}

export default Home;