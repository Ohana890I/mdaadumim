import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import "../styles/Availability.css";

import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";

function Availability() {
  const [availability, setAvailability] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
const [notes, setNotes] = useState("");
  const currentUser = JSON.parse(
    localStorage.getItem("currentUser")
  );

  const days = [
    "ראשון",
    "שני",
    "שלישי",
    "רביעי",
    "חמישי",
    "שישי",
    "שבת",
  ];

  const getNextWeekRange = () => {
    const today = new Date();

    const nextSunday = new Date(today);

    const daysUntilSunday =
      (7 - today.getDay()) % 7;

    nextSunday.setDate(
      today.getDate() + daysUntilSunday
    );

    const nextSaturday = new Date(nextSunday);

    nextSaturday.setDate(
      nextSunday.getDate() + 6
    );

    return {
      start: nextSunday.toLocaleDateString("he-IL"),
      end: nextSaturday.toLocaleDateString("he-IL"),
      id: nextSunday
        .toISOString()
        .split("T")[0],
    };
  };

  const weekInfo = getNextWeekRange();

  useEffect(() => {
    loadAvailability();
  }, []);

  const loadAvailability = async () => {
    try {
      const docRef = doc(
        db,
        "availabilities",
        `${currentUser.id}_${weekInfo.id}`
      );

      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        setAvailability(
          data.availability || {}
        );
        setNotes(
  data.notes || ""
);

        setSubmitted(true);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();

  const currentDay = now.getDay();
  const currentHour = now.getHours();

let submissionOpen = false;

if (
  currentDay === 3 &&
  currentHour >= 12
) {
  submissionOpen = true;
}

if (
  currentDay === 4 &&
  currentHour < 21
) {
  submissionOpen = true;
}


  const handleChange = (day, shift) => {
    const key = `${day}-${shift}`;

    setAvailability((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = async () => {
    try {
      await setDoc(
        doc(
          db,
          "availabilities",
          `${currentUser.id}_${weekInfo.id}`
        ),
        {
          userId: currentUser.id,
          fullName: currentUser.fullName,
          role: currentUser.role,
          availability,
          notes,
          weekId: weekInfo.id,
          submittedAt: new Date(),
        }
      );

      setSubmitted(true);

    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="availability-container">
            <div className="notes-section">

  <h3>הערות מיוחדות</h3>



</div>
          <div className="availability-card">
            <h1>טוען...</h1>
          </div>
        </div>
      </>
    );
  }

  if (!submissionOpen) {
    return (
      <>
        <Navbar />

        <div className="availability-container">
          <div className="availability-card">

            <h1>
              🔒 הגשת זמינויות סגורה
            </h1>

            <p>
              הגשת זמינויות פתוחה
              מיום רביעי בשעה 12:00
              ועד יום חמישי בשעה 21:00
            </p>

          </div>
        </div>
      </>
    );
  }

  if (submitted) {
    return (
      <>
        <Navbar />

        <div className="availability-container">
          <div className="availability-card">

            <h1>
              ✅ הזמינויות נשמרו
            </h1>

            <p>
              הגשת בהצלחה עבור השבוע:
            </p>

            <p>
              {weekInfo.start} - {weekInfo.end}
            </p>

            <button
              className="submit-btn"
              onClick={() =>
                setSubmitted(false)
              }
            >
              ערוך זמינויות
            </button>

          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="availability-container">

        <div className="availability-card">

          <h1>
            הגשת זמינויות לשבוע הבא
          </h1>

  <p className="subtitle">
           כל מתנדב מחויב להגיש לפחות 2  משמרות אם לא
            ניתן באפשרותכם להגיש נא לכתוב בהערות תחתית הדף.
          </p>

          <div className="week-banner">
            📅 שבוע יעד:
            {" "}
            {weekInfo.start}
            {" - "}
            {weekInfo.end}
          </div>

        

          <div className="status-badge">
            🟢 פתוח להגשה
          </div>

          <div className="availability-table-wrapper">
          <table className="availability-table">

            <thead>
              <tr>
                <th>יום</th>
                <th>בוקר</th>
                <th>ערב</th>
              </tr>
            </thead>

            <tbody>

              {days.map((day) => (
                <tr key={day}>

                  <td>{day}</td>

                  <td>
                    <input
                      type="checkbox"
                      checked={
                        availability[
                          `${day}-בוקר`
                        ] || false
                      }
                      onChange={() =>
                        handleChange(
                          day,
                          "בוקר"
                        )
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="checkbox"
                      checked={
                        availability[
                          `${day}-ערב`
                        ] || false
                      }
                      onChange={() =>
                        handleChange(
                          day,
                          "ערב"
                        )
                      }
                    />
                  </td>

                </tr>
              ))}

            </tbody>

          </table>
          </div>

<div className="notes-section">

  <h3>הערות </h3>

    <textarea
    value={notes}
    onChange={(e) =>
      setNotes(e.target.value)
    }
  />

</div>


          <button
            className="submit-btn"
            onClick={handleSubmit}
          >
            שלח זמינויות
          </button>

        </div>

      </div>
    </>
  );
}

export default Availability;
