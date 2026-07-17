import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, getDocs, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import {
  getWeekIdFromDate,
  parseWeekIdToDate,
} from "../utils/weekUtils";
import "../styles/Schedule.css";
import "../styles/RecentSchedules.css";

const SHIFTS = [
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

const createEmptySchedule = () => {
  const schedule = {};

  SHIFTS.forEach((shift) => {
    schedule[shift] = {
      ahmash: "",
      ben1: "",
      ben2: "",
    };
  });

  return schedule;
};

function RecentSchedules() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showOpenByDate, setShowOpenByDate] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedWeekId, setSelectedWeekId] = useState("");
  const [formWeekDate, setFormWeekDate] = useState("");
  const [copySourceWeekId, setCopySourceWeekId] = useState("");
  const [formSchedule, setFormSchedule] = useState(createEmptySchedule());
  const [activeInput, setActiveInput] = useState(null);
  const [message, setMessage] = useState("");

  const loadPublishedSchedules = async () => {
    try {
      const snapshot = await getDocs(collection(db, "publishedSchedules"));

      const data = snapshot.docs
        .map((docItem) => {
          const payload = docItem.data();
          const weekId = payload.weekId || docItem.id;
          const weekDate = parseWeekIdToDate(weekId);

          return {
            id: docItem.id,
            weekId,
            weekDate,
            schedule: payload.schedule || {},
          };
        })
        .filter((item) => item.weekDate)
        .sort((a, b) => b.weekDate - a.weekDate);

      setSchedules(data);
    } catch (error) {
      console.error(error);
      setMessage("שגיאה בטעינת השיבוצים האחרונים");
    }
  };

  useEffect(() => {
    if (localStorage.getItem("adminAuth") !== "true") {
      navigate("/admin/login", { replace: true });
      return;
    }

    const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const byKey = new Map();

      snapshot.docs.forEach((docItem) => {
        const user = docItem.data();
        if (!user?.approved || user?.blocked) {
          return;
        }

        const displayName = (user.fullName || user.username || "").trim();
        const username = (user.username || "").trim();
        if (!displayName) {
          return;
        }

        const key = displayName.toLowerCase();
        if (!byKey.has(key)) {
          byKey.set(key, {
            displayName,
            username,
            searchText: `${displayName} ${username}`.toLowerCase(),
          });
        }
      });

      setVolunteers(Array.from(byKey.values()));
    });

    loadPublishedSchedules();

    return () => {
      unsubscribeUsers();
    };
  }, [navigate]);

  const latestFour = useMemo(() => schedules.slice(0, 4), [schedules]);
  const selectedSchedule = useMemo(
    () => schedules.find((item) => item.weekId === selectedWeekId) || null,
    [schedules, selectedWeekId]
  );

  const formatWeekRange = (weekDate) => {
    if (!weekDate) return "";

    const start = new Date(weekDate);
    const end = new Date(weekDate);
    end.setDate(end.getDate() + 6);

    return `${start.toLocaleDateString("he-IL")} - ${end.toLocaleDateString("he-IL")}`;
  };

  const getFieldValue = (shift, field) => formSchedule[shift]?.[field] || "";

  const getVolunteerMatches = (value) => {
    const query = value.trim().toLowerCase();
    if (!query) {
      return [];
    }

    const startsWith = [];
    const includes = [];

    volunteers.forEach((volunteer) => {
      if (!volunteer.searchText.includes(query)) {
        return;
      }

      if (volunteer.displayName.toLowerCase().startsWith(query)) {
        startsWith.push(volunteer);
      } else {
        includes.push(volunteer);
      }
    });

    return [...startsWith, ...includes].slice(0, 6);
  };

  const handleScheduleFieldChange = (shift, field, value) => {
    setFormSchedule((prev) => ({
      ...prev,
      [shift]: {
        ...prev[shift],
        [field]: value,
      },
    }));
  };

  const cloneFromExisting = (weekId) => {
    setCopySourceWeekId(weekId);

    if (!weekId) {
      setFormSchedule(createEmptySchedule());
      return;
    }

    const source = schedules.find((item) => item.weekId === weekId);
    if (!source) {
      return;
    }

    const cloned = createEmptySchedule();
    SHIFTS.forEach((shift) => {
      const sourceShift = source.schedule?.[shift] || {};
      cloned[shift] = {
        ahmash: sourceShift.ahmash || "",
        ben1: sourceShift.ben1 || "",
        ben2: sourceShift.ben2 || "",
      };
    });

    setFormSchedule(cloned);
  };

  const openScheduleByDate = (dateValue) => {
    setSelectedDate(dateValue);

    if (!dateValue) {
      setSelectedWeekId("");
      return;
    }

    const weekId = getWeekIdFromDate(dateValue);
    setSelectedWeekId(weekId);
  };

  const saveHistoricSchedule = async () => {
    setMessage("");

    if (!formWeekDate) {
      setMessage("יש לבחור תאריך שבוע לשיבוץ");
      return;
    }

    const weekId = getWeekIdFromDate(formWeekDate);
    if (!weekId) {
      setMessage("תאריך שבוע לא תקין");
      return;
    }

    try {
      await setDoc(doc(db, "publishedSchedules", weekId), {
        weekId,
        schedule: formSchedule,
        createdAt: new Date(),
      });

      setMessage("השיבוץ נשמר בהצלחה");
      await loadPublishedSchedules();
    } catch (error) {
      console.error(error);
      setMessage("שגיאה בשמירת השיבוץ");
    }
  };

  const getShiftStatus = (value) => {
    if (!value) return "❌ חסר";
    if (value === "❌ חסר אחמ״ש" || value === "❌ חסר") return "❌ חסר";
    return value;
  };

  const renderVolunteerInput = (shift, field, placeholder) => {
    const value = getFieldValue(shift, field);
    const isActive =
      activeInput?.shift === shift && activeInput?.field === field;
    const matches = isActive ? getVolunteerMatches(value) : [];
    const noResults = isActive && value.trim().length > 0 && matches.length === 0;

    return (
      <div className="volunteer-autocomplete" key={`${shift}_${field}`}>
        <input
          placeholder={placeholder}
          value={value}
          onFocus={() => setActiveInput({ shift, field })}
          onChange={(e) =>
            handleScheduleFieldChange(shift, field, e.target.value)
          }
        />

        {isActive && matches.length > 0 && (
          <div className="autocomplete-list">
            {matches.map((volunteer) => (
              <button
                type="button"
                className="autocomplete-item"
                key={`${shift}_${field}_${volunteer.displayName}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => {
                  handleScheduleFieldChange(shift, field, volunteer.displayName);
                  setActiveInput(null);
                }}
              >
                <span>{volunteer.displayName}</span>
                {volunteer.username && volunteer.username !== volunteer.displayName && (
                  <small>@{volunteer.username}</small>
                )}
              </button>
            ))}
          </div>
        )}

        {noResults && <div className="autocomplete-empty">לא נמצא משתמש</div>}
      </div>
    );
  };

  return (
    <div className="recent-schedules-page">
      <div className="recent-header-actions">
        <button className="recent-action-btn" onClick={() => navigate("/admin")}>חזרה לאדמין</button>
      </div>

      <h1 className="recent-title">🗂️ שיבוצים אחרונים</h1>

      <div className="recent-controls">
        <button
          className="recent-toggle-btn"
          onClick={() => setShowAddForm((prev) => !prev)}
        >
          {showAddForm ? "סגור הוספת שיבוץ" : "➕ הוספת שיבוץ קיים"}
        </button>

        <button
          className="recent-toggle-btn secondary"
          onClick={() => setShowOpenByDate((prev) => !prev)}
        >
          {showOpenByDate ? "סגור פתיחת שיבוץ" : "📅 פתח שיבוץ"}
        </button>
      </div>

      {showOpenByDate && (
        <div className="recent-open-card">
          <label>בחר תאריך ביומן</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => openScheduleByDate(e.target.value)}
          />

          {selectedDate && !selectedSchedule && (
            <p className="recent-message">לא נמצא שיבוץ לתאריך שנבחר.</p>
          )}
        </div>
      )}

      {showAddForm && (
        <div className="recent-form-card">
          <h2>➕ הוספת שיבוץ עבר</h2>

          <div className="recent-form-row">
            <label>בחר שבוע (כל תאריך בתוך השבוע)</label>
            <input
              type="date"
              value={formWeekDate}
              onChange={(e) => setFormWeekDate(e.target.value)}
            />
          </div>

          <div className="recent-form-row">
            <label>שכפל שיבוץ קיים (אופציונלי)</label>
            <select
              value={copySourceWeekId}
              onChange={(e) => cloneFromExisting(e.target.value)}
            >
              <option value="">בחר שיבוץ קיים</option>
              {schedules.map((item) => (
                <option key={item.weekId} value={item.weekId}>
                  {item.weekId} ({formatWeekRange(item.weekDate)})
                </option>
              ))}
            </select>
          </div>

          <div className="manual-schedule-grid">
            {SHIFTS.map((shift) => (
              <div className="manual-shift-card" key={shift}>
                <h3>{shift}</h3>
                {renderVolunteerInput(shift, "ahmash", "אחמ״ש")}
                {renderVolunteerInput(shift, "ben1", "לבן 1")}
                {renderVolunteerInput(shift, "ben2", "לבן 2")}
              </div>
            ))}
          </div>

          <button className="recent-save-btn" onClick={saveHistoricSchedule}>
            שמור שיבוץ
          </button>

          {message && <p className="recent-message">{message}</p>}
        </div>
      )}

      {selectedSchedule && (
        <div className="schedule-container recent-schedule-block">
          <h2 className="recent-week-title">
            שבוע נבחר: {formatWeekRange(selectedSchedule.weekDate)}
          </h2>
          <p className="recent-week-id">{selectedSchedule.weekId}</p>

          <div className="schedule-grid">
            {SHIFTS.filter((shift) => selectedSchedule.schedule[shift]).map((shift) => (
              <div key={`selected_${selectedSchedule.weekId}_${shift}`} className="day-card">
                <h2>{shift}</h2>
                <div className="shift-card">
                  <div className="shift-row">
                    <span className="shift-label">אחמ״ש:</span>
                    <span className="shift-value">{getShiftStatus(selectedSchedule.schedule[shift].ahmash)}</span>
                  </div>
                  <div className="shift-row">
                    <span className="shift-label">לבן 1:</span>
                    <span className="shift-value">{getShiftStatus(selectedSchedule.schedule[shift].ben1)}</span>
                  </div>
                  <div className="shift-row">
                    <span className="shift-label">לבן 2:</span>
                    <span className="shift-value">{getShiftStatus(selectedSchedule.schedule[shift].ben2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {latestFour.map((item) => {
        const sortedSchedule = SHIFTS.filter((shift) => item.schedule[shift]);

        return (
          <div className="schedule-container recent-schedule-block" key={item.weekId}>
            <h2 className="recent-week-title">שבוע: {formatWeekRange(item.weekDate)}</h2>
            <p className="recent-week-id">{item.weekId}</p>

            <div className="schedule-grid">
              {sortedSchedule.map((shift) => (
                <div key={`${item.weekId}_${shift}`} className="day-card">
                  <h2>{shift}</h2>
                  <div className="shift-card">
                    <div className="shift-row">
                      <span className="shift-label">אחמ״ש:</span>
                      <span className="shift-value">{getShiftStatus(item.schedule[shift].ahmash)}</span>
                    </div>
                    <div className="shift-row">
                      <span className="shift-label">לבן 1:</span>
                      <span className="shift-value">{getShiftStatus(item.schedule[shift].ben1)}</span>
                    </div>
                    <div className="shift-row">
                      <span className="shift-label">לבן 2:</span>
                      <span className="shift-value">{getShiftStatus(item.schedule[shift].ben2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default RecentSchedules;
