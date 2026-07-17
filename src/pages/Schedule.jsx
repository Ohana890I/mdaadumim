import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import "../styles/Schedule.css";

import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { getWeekId } from "../utils/weekUtils";

function Schedule() {
  const [schedule, setSchedule] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    try {

    const weekId = getWeekId();

      const scheduleRef = doc(
        db,
        "publishedSchedules",
        weekId
      );

      const scheduleSnap =
        await getDoc(scheduleRef);

      if (scheduleSnap.exists()) {
        const data =
          scheduleSnap.data();

        setSchedule(
          data.schedule
        );
      }

    } catch (error) {

      console.error(error);

    } finally {

      setLoading(false);

    }
  };

  const dayOrder = [
    "ראשון-בוקר",
    "ראשון-ערב",
    "שני-בוקר",
    "שני-ערב",
    "שלישי-בוקר",
    "שלישי-ערב",
    "רביעי-בוקר",
    "רביעי-ערב",
    "חמישי-בוקר",
    "חמישי-ערב",
    "שישי-בוקר",
    "שישי-ערב",
    "שבת-בוקר",
    "שבת-ערב",
  ];

  const getShiftStatus = (value) => {
    if (!value) return "❌ חסר";
    if (value === "❌ חסר אחמ״ש" || value === "❌ חסר") return "❌ חסר";
    return value;
  };

  if (loading) {
    return (
      <>
        <Navbar />

        <div className="schedule-container">
          <div className="schedule-card">

            <h1>טוען...</h1>

          </div>
        </div>
      </>
    );
  }

  if (!schedule) {
    return (
      <>
        <Navbar />

        <div className="schedule-container">
          <div className="schedule-card">

            <h1>
              📅 השיבוץ השבועי
            </h1>

            <p className="no-schedule">
              טרם פורסם שיבוץ לשבוע זה
            </p>

          </div>
        </div>
      </>
    );
  }

  const sortedSchedule = dayOrder.filter(
    (day) => schedule[day]
  );

  return (
    <>
      <Navbar />

      <div className="schedule-container">

        <h1>
          📅 השיבוץ השבועי
        </h1>

        <div className="schedule-grid">
          {sortedSchedule.map(
            (shift) => (
              <div
                key={shift}
                className="day-card"
              >
                <h2>{shift}</h2>

                <div className="shift-card">

                  <div className="shift-row">
                    <span className="shift-label">אחמ״ש:</span>
                    <span className="shift-value">{getShiftStatus(schedule[shift].ahmash)}</span>
                  </div>

                  <div className="shift-row">
                    <span className="shift-label">לבן 1:</span>
                    <span className="shift-value">{getShiftStatus(schedule[shift].ben1)}</span>
                  </div>

                  <div className="shift-row">
                    <span className="shift-label">לבן 2:</span>
                    <span className="shift-value">{getShiftStatus(schedule[shift].ben2)}</span>
                  </div>

                </div>
              </div>
            )
          )}
        </div>

      </div>
    </>
  );
}

export default Schedule;