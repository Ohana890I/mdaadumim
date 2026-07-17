import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import {
  collection,
  getDocs,
  doc,
  setDoc
} from "firebase/firestore";
import { db } from "../services/firebase";
import "../styles/DraftSchedule.css";

import { getWeekId, parseWeekIdToDate }
from "../utils/weekUtils";

import {
  getUserStats
}
from "../utils/scheduleStats";

function DraftSchedule() {
  const SCORE_WEIGHTS = {
    historyShiftPenalty: 1,
    currentWeekPenalty: 1,
    fridayEveningBonus: 1,
    availableNotAssignedBonus: 1,
    weeklyAvailabilityBonus: 1,
  };

  const [availabilities, setAvailabilities] =
    useState([]);

  const [generatedSchedule, setGeneratedSchedule] =
    useState({});
  const [editableSchedule, setEditableSchedule] = useState({});
  const [editingShifts, setEditingShifts] = useState({});
  const [notification, setNotification] = useState({
    type: "",
    message: "",
  });
  const [stats, setStats] =
  useState({});

  const normalizeRole = (role) =>
    (role || "").trim();

  const isAhmashRole = (role) =>
    normalizeRole(role).includes("אחמ");

  const isNewRole = (role) =>
    normalizeRole(role).includes("חדש");

  const getAvailabilityCount = (user) =>
    Object.values(user.availability || {}).filter(Boolean).length;

  const normalizePersonName = (value) =>
    (value || "")
      .toString()
      .trim()
      .replace(/["'׳״`]/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();

  const computeBaseScore = (user, userStats) => {
    const shiftsLast4 = userStats.shifts || 0;
    const availabilityCount = getAvailabilityCount(user);
    const fridayBonus = userStats.fridayEvening > 0 ? 1 : 0;
    const availableNotAssignedBonus =
      userStats.availableNotAssignedPrevWeek > 0 ? 1 : 0;

    return {
      shiftsLast4,
      availabilityCount,
      fridayBonus,
      availableNotAssignedBonus,
    };
  };

  const compareCandidates = (a, b, assignedCounts) => {
    const historyA = -(a.shiftsLast4 || 0) * SCORE_WEIGHTS.historyShiftPenalty;
    const historyB = -(b.shiftsLast4 || 0) * SCORE_WEIGHTS.historyShiftPenalty;
    if (historyB !== historyA) {
      return historyB - historyA;
    }

    // Fair distribution inside the currently generated week.
    const currentWeekA = -(assignedCounts[a.id] || 0) * SCORE_WEIGHTS.currentWeekPenalty;
    const currentWeekB = -(assignedCounts[b.id] || 0) * SCORE_WEIGHTS.currentWeekPenalty;
    if (currentWeekB !== currentWeekA) {
      return currentWeekB - currentWeekA;
    }

    const fridayA = (a.fridayBonus || 0) * SCORE_WEIGHTS.fridayEveningBonus;
    const fridayB = (b.fridayBonus || 0) * SCORE_WEIGHTS.fridayEveningBonus;
    if (fridayB !== fridayA) {
      return fridayB - fridayA;
    }

    const availableNotAssignedA =
      (a.availableNotAssignedBonus || 0) * SCORE_WEIGHTS.availableNotAssignedBonus;
    const availableNotAssignedB =
      (b.availableNotAssignedBonus || 0) * SCORE_WEIGHTS.availableNotAssignedBonus;
    if (availableNotAssignedB !== availableNotAssignedA) {
      return availableNotAssignedB - availableNotAssignedA;
    }

    const availabilityA = (a.availabilityCount || 0) * SCORE_WEIGHTS.weeklyAvailabilityBonus;
    const availabilityB = (b.availabilityCount || 0) * SCORE_WEIGHTS.weeklyAvailabilityBonus;
    if (availabilityB !== availabilityA) {
      return availabilityB - availabilityA;
    }

    return 0;
  };

  const rankByEffectiveScore = (users, assignedCounts) =>
    users
      .map((user) => ({
        ...user,
        tieBreaker: Math.random(),
      }))
      .sort((a, b) => {
        const result = compareCandidates(a, b, assignedCounts);
        if (result !== 0) {
          return result;
        }
        return a.tieBreaker - b.tieBreaker;
      });

  const loadAvailabilities = async () => {
    try {
      const snapshot = await getDocs(
        collection(db, "availabilities")
      );

      const data = snapshot.docs.map(
        (doc) => ({
          id: doc.id,
          ...doc.data(),
        })
      );

      setAvailabilities(data);

    } catch (error) {
      console.error(error);
    }
  };

  const loadStats = async () => {
    try {
      const userStats = await getUserStats(getWeekId());
      setStats(userStats);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (localStorage.getItem("adminAuth") !== "true") {
      window.location.href = "/admin/login";
      return;
    }
    loadAvailabilities();
    loadStats();


  }, []);

  const getCurrentWeekAvailabilities = () => {
    const availabilitiesWithWeek = availabilities.filter((user) => !!user.weekId);
    if (!availabilitiesWithWeek.length) {
      return availabilities;
    }

    const latestWeekId = availabilitiesWithWeek
      .map((user) => user.weekId)
      .sort((a, b) => {
        const aDate = parseWeekIdToDate(a);
        const bDate = parseWeekIdToDate(b);
        const aMs = aDate ? aDate.getTime() : 0;
        const bMs = bDate ? bDate.getTime() : 0;
        return bMs - aMs;
      })[0];

    return availabilitiesWithWeek.filter((user) => user.weekId === latestWeekId);
  };

  const getManualAvailabilityWarnings = (scheduleToCheck) => {
    const warnings = [];
    const weekAvailabilities = getCurrentWeekAvailabilities();
    const availabilityByName = {};

    weekAvailabilities.forEach((user) => {
      const normalizedName = normalizePersonName(user.fullName || "");
      if (!normalizedName) {
        return;
      }
      availabilityByName[normalizedName] = user.availability || {};
    });

    Object.entries(scheduleToCheck || {}).forEach(([shift, shiftData]) => {
      ["ahmash", "ben1", "ben2"].forEach((field) => {
        const person = (shiftData?.[field] || "").trim();
        if (!person || person.includes("❌")) {
          return;
        }

        const normalizedName = normalizePersonName(person);
        const isAvailable = !!availabilityByName[normalizedName]?.[shift];
        if (!isAvailable) {
          warnings.push(`⚠ המתנדב לא סימן זמינות למשמרת זו (${person} - ${shift})`);
        }
      });
    });

    return warnings;
  };

  const generateSchedule = () => {
    const shifts = [
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

    const schedule = {};
    const warnings = [];
    const assignedCounts = {};

    const currentWeekAvailabilities = getCurrentWeekAvailabilities();

    const scoredUsers = currentWeekAvailabilities.map((user) => {
      const name = normalizePersonName(user.fullName || "");
      const userStats = stats[name] || {
        shifts: 0,
        fridayEvening: 0,
        availableNotAssignedPrevWeek: 0,
      };

      const scoreData = computeBaseScore(user, userStats);

      return {
        ...user,
        ...scoreData,
      };
    });

    shifts.forEach((shift) => {
      const availableUsers = scoredUsers.filter(
        (user) => user.availability?.[shift]
      );

      const rankedUsers = rankByEffectiveScore(availableUsers, assignedCounts);
      const ahmashCandidates = rankedUsers.filter((user) =>
        isAhmashRole(user.role)
      );

      const selectedAhmash = ahmashCandidates[0] || null;

      const selectedPeople = [];
      if (selectedAhmash) {
        selectedPeople.push(selectedAhmash);
      }

      const remaining = rankedUsers.filter(
        (user) => user.id !== selectedAhmash?.id
      );

      for (const user of remaining) {
        if (selectedPeople.length >= 3) {
          break;
        }

        if (selectedPeople.length === 2) {
          const projected = [...selectedPeople, user];
          const allNew = projected.every((item) =>
            isNewRole(item.role)
          );

          if (allNew) {
            const hasNonNewAlternative = remaining.some(
              (candidate) =>
                candidate.id !== user.id &&
                !selectedPeople.some((picked) => picked.id === candidate.id) &&
                !isNewRole(candidate.role)
            );

            if (hasNonNewAlternative) {
              continue;
            }
          }
        }

        selectedPeople.push(user);
      }

      selectedPeople.forEach((user) => {
        assignedCounts[user.id] = (assignedCounts[user.id] || 0) + 1;
      });

      const benCandidates = selectedPeople.filter(
        (user) => user.id !== selectedAhmash?.id
      );

      const ahmashName = selectedAhmash?.fullName || "❌ חסר אחמ״ש";
      const ben1Name = benCandidates[0]?.fullName || "❌ חסר";
      const ben2Name = benCandidates[1]?.fullName || "❌ חסר";

      const assignedCount =
        (selectedAhmash ? 1 : 0) +
        (benCandidates[0] ? 1 : 0) +
        (benCandidates[1] ? 1 : 0);

      if (!selectedAhmash) {
        warnings.push(`⚠️ ${shift}: חסר אחמ״ש`);
      }

      if (assignedCount < 3) {
        warnings.push(`⚠️ ${shift}: פחות מ-3 אנשים`);
      }

      const assignedPeople = [
        selectedAhmash,
        benCandidates[0],
        benCandidates[1],
      ].filter(Boolean);

      if (
        assignedPeople.length === 3 &&
        assignedPeople.every((user) => isNewRole(user.role))
      ) {
        warnings.push(`⚠️ ${shift}: 3 חדשים באותה משמרת`);
      }

      schedule[shift] = {
        ahmash: ahmashName,
        ben1: ben1Name,
        ben2: ben2Name,
      };
    });

    setGeneratedSchedule(schedule);
    setEditableSchedule(schedule);
    setEditingShifts({});

    if (warnings.length > 0) {
      setNotification({
        type: "error",
        message: warnings.join(" | "),
      });
    } else {
      setNotification({
        type: "success",
        message: "השיבוץ נוצר בהצלחה לפי כללי האיזון והעדיפויות.",
      });
    }
  };

  const toggleEditShift = (shift) => {
    setEditingShifts((prev) => ({
      ...prev,
      [shift]: !prev[shift],
    }));
  };

  const handleShiftChange = (shift, field, value) => {
    setEditableSchedule((prev) => ({
      ...prev,
      [shift]: {
        ...prev[shift],
        [field]: value,
      },
    }));
  };

  const cancelShift = (shift) => {
    setEditableSchedule((prev) => ({
      ...prev,
      [shift]: generatedSchedule[shift],
    }));
    setEditingShifts((prev) => ({
      ...prev,
      [shift]: false,
    }));
  };

  const saveDraftToFirebase = async (schedule, extraWarnings = []) => {
    try {
      const weekId = getWeekId();
      await setDoc(doc(db, "draftSchedules", weekId), {
        weekId,
        schedule,
        createdAt: new Date(),
      });

      if (extraWarnings.length > 0) {
        setNotification({
          type: "error",
          message: extraWarnings.join(" | "),
        });
      } else {
        setNotification({
          type: "success",
          message: "העדכון נשמר בהצלחה ועבר לאלגוריתם-",
        });
      }
    } catch (error) {
      console.error(error);
      setNotification({
        type: "error",
        message: "שגיאה בשמירה ב-אלגוריתם-. נסה שוב.",
      });
    }
  };

  const saveShift = async (shift) => {
    const updatedSchedule = {
      ...generatedSchedule,
      [shift]: editableSchedule[shift],
    };
    setGeneratedSchedule(updatedSchedule);
    setEditingShifts((prev) => ({
      ...prev,
      [shift]: false,
    }));

    const warnings = getManualAvailabilityWarnings(updatedSchedule);
    await saveDraftToFirebase(updatedSchedule, warnings);
  };

  const saveDraftSchedule = async () => {
    const warnings = getManualAvailabilityWarnings(editableSchedule);
    await saveDraftToFirebase(editableSchedule, warnings);
    setGeneratedSchedule(editableSchedule);
  };

const publishSchedule = async () => {
  try {

    const weekId = getWeekId();
    const scheduleToPublish =
      Object.keys(editableSchedule || {}).length > 0
        ? editableSchedule
        : generatedSchedule;

    if (!scheduleToPublish || Object.keys(scheduleToPublish).length === 0) {
      setNotification({
        type: "error",
        message: "לא נמצאה טיוטה לפרסום",
      });
      return;
    }

    const payload = {
      weekId,
      schedule: scheduleToPublish,
      createdAt: new Date(),
    };

    await setDoc(doc(db, "draftSchedules", weekId), payload);

    await setDoc(
      doc(db, "publishedSchedules", weekId),
      payload
    );

    setNotification({
      type: "success",
      message: "השיבוץ פורסם בהצלחה",
    });

  } catch (error) {

    console.error(error);
    setNotification({
      type: "error",
      message: "אירעה שגיאה בפרסום השיבוץ",
    });

  }
};

  return (
    <>
      <Navbar />

      <div className="draft-schedule-page">
        {notification.message && (
          <div className={`notification ${notification.type}`}>
            {notification.message}
            <button
              className="notification-close"
              onClick={() => setNotification({ type: "", message: "" })}
            >
              ×
            </button>
          </div>
        )}
        <div className="schedule-header">
          <div>
            <h1>🤖 טיוטת שיבוץ</h1>
            <p className="summary">נמצאו {availabilities.length} הגשות</p>
          </div>

{
  availabilities.some(
    (user) => user.notes
  ) && (
    <div
      style={{
        background: "#fff3cd",
        padding: "15px",
        borderRadius: "12px",
        marginBottom: "20px",
      }}
    >
      ⚠️ נמצאו הערות מיוחדות.
      מומלץ לעבור עליהן לפני יצירת השיבוץ.
    </div>
  )
}

          <button className="submit-btn" onClick={generateSchedule}>
            🤖 צור שיבוץ אוטומטי
          </button>
<button
  className="submit-btn"
  onClick={saveDraftSchedule}
>
  💾 שמור טיוטה
</button>

<button
  className="submit-btn"
  onClick={publishSchedule}
>
  ✅ אשר ופרסם
</button>


        </div>

        {availabilities.map((user) => (
          <div key={user.id} className="user-card">
            <div>
              <h3>{user.fullName}</h3>
          <p>{user.role}</p>
          <p>
  משמרות ב-4 שבועות:
  {" "}
  {stats[normalizePersonName(user.fullName)]?.shifts || 0}
</p>

{user.notes && (
  <div
    style={{
      marginTop: "10px",
      padding: "10px",
      background: "#fff3cd",
      borderRadius: "10px",
    }}
  >
    ⚠️ {user.notes}
  </div>
)}
            </div>
          </div>
        ))}

        {Object.keys(generatedSchedule).length > 0 && (
          <>
            <h2 className="section-title">📅 טיוטת שיבוץ</h2>
            <div className="shift-list">
              {Object.entries(editableSchedule).map(([shift, data]) => {
                const isEditing = editingShifts[shift];
                return (
                  <div key={shift} className="user-card shift">
                    <div className="shift-header">
                      <h3>{shift}</h3>
                      <button
                        className="edit-btn"
                        onClick={() =>
                          isEditing
                            ? cancelShift(shift)
                            : toggleEditShift(shift)
                        }
                      >
                        {isEditing ? "בטל" : "ערוך"}
                      </button>
                    </div>

                    <div className="field-row">
                      <span className="field-label">אחמ״ש:</span>
                      {isEditing ? (
                        <input
                          value={data.ahmash}
                          onChange={(e) =>
                            handleShiftChange(
                              shift,
                              "ahmash",
                              e.target.value
                            )
                          }
                        />
                      ) : (
                        <span className="field-value">{data.ahmash}</span>
                      )}
                    </div>

                    <div className="field-row">
                      <span className="field-label">לבן 1:</span>
                      {isEditing ? (
                        <input
                          value={data.ben1}
                          onChange={(e) =>
                            handleShiftChange(
                              shift,
                              "ben1",
                              e.target.value
                            )
                          }
                        />
                      ) : (
                        <span className="field-value">{data.ben1}</span>
                      )}
                    </div>

                    <div className="field-row">
                      <span className="field-label">לבן 2:</span>
                      {isEditing ? (
                        <input
                          value={data.ben2}
                          onChange={(e) =>
                            handleShiftChange(
                              shift,
                              "ben2",
                              e.target.value
                            )
                          }
                        />
                      ) : (
                        <span className="field-value">{data.ben2}</span>
                      )}
                    </div>

                    {isEditing && (
                      <button
                        className="edit-btn save"
                        onClick={() => saveShift(shift)}
                      >
                        שמור
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default DraftSchedule;