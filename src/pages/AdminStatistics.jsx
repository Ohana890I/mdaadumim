import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { getWeekId, parseWeekIdToDate } from "../utils/weekUtils";
import "../styles/Admin.css";
import "../styles/AdminStatistics.css";

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

const normalizePersonName = (value) =>
  (value || "")
    .toString()
    .trim()
    .replace(/["'׳״`]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();

const toRoleBucket = (role) => {
  const normalized = (role || "").trim();
  if (normalized.includes("אחמ")) {
    return "ahmash";
  }
  if (normalized.includes("ותיק")) {
    return "veteran";
  }
  return "new";
};

const isMissing = (value) => {
  if (!value || typeof value !== "string") {
    return true;
  }

  const trimmed = value.trim();
  return trimmed === "" || trimmed.includes("❌");
};

const parsePublishedWeekDate = (weekId) => {
  const parsedFromWeekId = parseWeekIdToDate(weekId);
  if (parsedFromWeekId) {
    return parsedFromWeekId;
  }

  const parsed = new Date(weekId);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const shiftMatchesType = (shiftName, shiftFilter) => {
  if (shiftFilter === "morning") {
    return shiftName.endsWith("-בוקר");
  }
  if (shiftFilter === "evening") {
    return shiftName.endsWith("-ערב");
  }
  return true;
};

function AdminStatistics() {
  const navigate = useNavigate();
  const [publishedSchedules, setPublishedSchedules] = useState([]);
  const [availabilityCount, setAvailabilityCount] = useState(0);
  const [pendingActivations, setPendingActivations] = useState(0);
  const [activeUsers, setActiveUsers] = useState([]);
  const [userRoleByName, setUserRoleByName] = useState({});
  const [selectedWeekId, setSelectedWeekId] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadStats = async () => {
    setLoading(true);
    setMessage("");

    try {
      const [publishedSnapshot, pendingSnapshot, usersSnapshot, availabilitySnapshot] = await Promise.all([
        getDocs(collection(db, "publishedSchedules")),
        getDocs(query(collection(db, "pendingUsers"), where("activated", "==", false))),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "availabilities")),
      ]);

      const published = publishedSnapshot.docs
        .map((docItem) => {
          const data = docItem.data() || {};
          const weekId = data.weekId || docItem.id;
          return {
            weekId,
            weekDate: parsePublishedWeekDate(weekId),
            schedule: data.schedule || {},
          };
        })
        .sort((a, b) => {
          const aMs = a.weekDate ? a.weekDate.getTime() : 0;
          const bMs = b.weekDate ? b.weekDate.getTime() : 0;
          return bMs - aMs;
        });

      setPublishedSchedules(published);
      setPendingActivations(pendingSnapshot.size);

      const approvedActiveUsers = usersSnapshot.docs
        .map((docItem) => ({ id: docItem.id, ...(docItem.data() || {}) }))
        .filter((user) => user.approved && !user.blocked);

      setActiveUsers(approvedActiveUsers);

      const roleByName = {};
      approvedActiveUsers.forEach((user) => {
        const key = normalizePersonName(user.fullName || "");
        if (!key) {
          return;
        }
        roleByName[key] = toRoleBucket(user.role || "");
      });
      setUserRoleByName(roleByName);

      const availabilityDocs = availabilitySnapshot.docs.map((docItem) => docItem.data() || {});
      const latestAvailabilityWeekId = availabilityDocs
        .map((item) => item.weekId)
        .filter(Boolean)
        .sort()
        .slice(-1)[0];

      const weeklyAvailabilityCount = latestAvailabilityWeekId
        ? availabilityDocs.filter((item) => item.weekId === latestAvailabilityWeekId).length
        : availabilityDocs.length;

      setAvailabilityCount(weeklyAvailabilityCount);
    } catch (error) {
      console.error(error);
      setMessage("שגיאה בטעינת הסטטיסטיקות");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (localStorage.getItem("adminAuth") !== "true") {
      navigate("/admin/login", { replace: true });
      return;
    }

    loadStats();
  }, [navigate]);

  useEffect(() => {
    if (!publishedSchedules.length || selectedWeekId) {
      return;
    }

    const currentWeekId = getWeekId();
    const currentWeek = publishedSchedules.find((item) => item.weekId === currentWeekId);
    setSelectedWeekId(currentWeek?.weekId || publishedSchedules[0].weekId);
  }, [publishedSchedules, selectedWeekId]);

  const selectedWeek = useMemo(() => {
    if (!publishedSchedules.length) {
      return null;
    }

    const selected = publishedSchedules.find((item) => item.weekId === selectedWeekId);
    if (selected) {
      return selected;
    }

    const currentWeekId = getWeekId();
    const currentWeek = publishedSchedules.find((item) => item.weekId === currentWeekId);
    return currentWeek || publishedSchedules[0];
  }, [publishedSchedules, selectedWeekId]);

  const roleMatchesFilter = (personName) => {
    if (roleFilter === "all") {
      return true;
    }

    const normalized = normalizePersonName(personName);
    const personRoleBucket = userRoleByName[normalized];
    return personRoleBucket === roleFilter;
  };

  const weekMetrics = useMemo(() => {
    const shiftsToMeasure = SHIFTS.filter((shift) => shiftMatchesType(shift, shiftFilter));
    const totalShifts = shiftsToMeasure.length;

    if (!selectedWeek || !totalShifts) {
      return {
        totalShifts,
        fullCoveredShifts: 0,
        coveragePercent: 0,
        missingAhmash: 0,
        underThree: 0,
        assignedVolunteers: 0,
        warnings: [],
      };
    }

    let fullCoveredShifts = 0;
    let missingAhmash = 0;
    let underThree = 0;
    const warnings = [];
    const peopleSet = new Set();

    shiftsToMeasure.forEach((shiftName) => {
      const shift = selectedWeek.schedule?.[shiftName] || {};
      const ahmash = shift.ahmash || "";
      const ben1 = shift.ben1 || "";
      const ben2 = shift.ben2 || "";

      const present = [ahmash, ben1, ben2].filter((value) => !isMissing(value));
      present
        .filter((person) => roleMatchesFilter(person))
        .forEach((person) => peopleSet.add(person.trim()));

      if (isMissing(ahmash)) {
        missingAhmash += 1;
        warnings.push(`⚠️ ${shiftName}: חסר אחמ"ש`);
      }

      if (present.length < 3) {
        underThree += 1;
        warnings.push(`⚠️ ${shiftName}: פחות מ-3 משובצים`);
      }

      if (present.length === 3) {
        fullCoveredShifts += 1;
      }
    });

    const coveragePercent = Math.round((fullCoveredShifts / totalShifts) * 100);

    return {
      totalShifts,
      fullCoveredShifts,
      coveragePercent,
      missingAhmash,
      underThree,
      assignedVolunteers: peopleSet.size,
      warnings,
    };
  }, [selectedWeek, roleFilter, shiftFilter, userRoleByName]);

  const fairnessMetrics = useMemo(() => {
    if (!selectedWeek?.weekDate) {
      return {
        average: 0,
        gap: 0,
        topLoaded: [],
        topUnderAssigned: [],
      };
    }

    const anchorMs = selectedWeek.weekDate.getTime();
    const measuredWeeks = publishedSchedules
      .filter((week) => week.weekDate && week.weekDate.getTime() <= anchorMs)
      .slice(0, 4);

    const counts = {};

    activeUsers.forEach((user) => {
      if (roleFilter !== "all" && toRoleBucket(user.role || "") !== roleFilter) {
        return;
      }
      const key = normalizePersonName(user.fullName || "");
      if (key) {
        counts[key] = {
          name: user.fullName,
          count: 0,
        };
      }
    });

    measuredWeeks.forEach((week) => {
      SHIFTS.filter((shift) => shiftMatchesType(shift, shiftFilter)).forEach((shiftName) => {
        const shift = week.schedule?.[shiftName] || {};
        [shift.ahmash, shift.ben1, shift.ben2]
          .filter((person) => !isMissing(person))
          .forEach((person) => {
            if (!roleMatchesFilter(person)) {
              return;
            }

            const key = normalizePersonName(person);
            if (!key) {
              return;
            }

            if (!counts[key]) {
              counts[key] = {
                name: person,
                count: 0,
              };
            }

            counts[key].count += 1;
          });
      });
    });

    const entries = Object.values(counts).sort((a, b) => b.count - a.count);
    if (!entries.length) {
      return {
        average: 0,
        gap: 0,
        topLoaded: [],
        topUnderAssigned: [],
      };
    }

    const countsOnly = entries.map((item) => item.count);
    const maxCount = Math.max(...countsOnly);
    const minCount = Math.min(...countsOnly);
    const totalCount = countsOnly.reduce((sum, current) => sum + current, 0);
    const average = Number((totalCount / entries.length).toFixed(1));

    const topLoaded = [...entries]
      .filter((item) => item.count > 0)
      .slice(0, 5)
      .map((item) => ({
        ...item,
        percent: maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0,
      }));

    const topUnderAssigned = [...entries]
      .sort((a, b) => a.count - b.count)
      .slice(0, 5)
      .map((item) => ({
        ...item,
        percent: maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0,
      }));

    return {
      average,
      gap: maxCount - minCount,
      topLoaded,
      topUnderAssigned,
    };
  }, [selectedWeek, publishedSchedules, activeUsers, roleFilter, shiftFilter, userRoleByName]);

  const formatWeekLabel = (weekData) => {
    if (!weekData?.weekDate) {
      return "שבוע לא ידוע";
    }

    const start = new Date(weekData.weekDate);
    const end = new Date(weekData.weekDate);
    end.setDate(end.getDate() + 6);

    return `${start.toLocaleDateString("he-IL")} - ${end.toLocaleDateString("he-IL")}`;
  };

  return (
    <div className="admin-container">
      <div className="admin-card admin-stats-page">
        <div className="admin-header">
          <div>
            <h1>📊 סטטיסטיקות</h1>
            <p>מדדי כיסוי, פילטרים והוגנות ל-4 שבועות.</p>
          </div>

          <div className="header-actions">
            <button className="action-btn secondary" onClick={loadStats}>
              🔄 רענן נתונים
            </button>
            <button className="action-btn" onClick={() => navigate("/admin")}>
              חזרה לאדמין
            </button>
          </div>
        </div>

        {loading ? (
          <section className="panel">
            <p>טוען סטטיסטיקות...</p>
          </section>
        ) : (
          <>
            {message && <div className="admin-feedback error">{message}</div>}

            <section className="panel">
              <div className="panel-header">
                <h2>פילטרים</h2>
                <span>סינון שבוע, תפקיד וסוג משמרת</span>
              </div>

              <div className="stats-filters-grid">
                <div className="stats-filter-item">
                  <label>שבוע</label>
                  <select
                    value={selectedWeek?.weekId || ""}
                    onChange={(e) => setSelectedWeekId(e.target.value)}
                  >
                    {publishedSchedules.map((week) => (
                      <option key={week.weekId} value={week.weekId}>
                        {formatWeekLabel(week)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="stats-filter-item">
                  <label>תפקיד</label>
                  <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                    <option value="all">הכול</option>
                    <option value="ahmash">אחמ"ש</option>
                    <option value="veteran">ותיקים</option>
                    <option value="new">חדשים</option>
                  </select>
                </div>

                <div className="stats-filter-item">
                  <label>סוג משמרת</label>
                  <select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)}>
                    <option value="all">בוקר + ערב</option>
                    <option value="morning">בוקר בלבד</option>
                    <option value="evening">ערב בלבד</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>שבוע נמדד</h2>
                <span>{selectedWeek ? formatWeekLabel(selectedWeek) : "אין שיבוץ זמין"}</span>
              </div>

              <div className="stats-grid">
                <div className="stats-card kpi-main">
                  <span>אחוז כיסוי מלא</span>
                  <strong>{weekMetrics.coveragePercent}%</strong>
                  <small>{weekMetrics.fullCoveredShifts}/{weekMetrics.totalShifts} משמרות מלאות</small>
                </div>

                <div className="stats-card">
                  <span>משמרות ללא אחמ"ש</span>
                  <strong>{weekMetrics.missingAhmash}</strong>
                </div>

                <div className="stats-card">
                  <span>משמרות עם פחות מ-3</span>
                  <strong>{weekMetrics.underThree}</strong>
                </div>

                <div className="stats-card">
                  <span>מתנדבים ששובצו</span>
                  <strong>{weekMetrics.assignedVolunteers}</strong>
                  <small>בהתאם לפילטר התפקיד</small>
                </div>

                <div className="stats-card">
                  <span>הזמנות ממתינות להפעלה</span>
                  <strong>{pendingActivations}</strong>
                </div>

                <div className="stats-card">
                  <span>הגשות זמינות השבוע</span>
                  <strong>{availabilityCount}</strong>
                  <small>מתוך {activeUsers.length} מתנדבים פעילים</small>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>הוגנות ב-4 שבועות אחרונים</h2>
                <span>בהתאם לפילטרים שנבחרו</span>
              </div>

              <div className="stats-grid fairness-kpi-grid">
                <div className="stats-card">
                  <span>ממוצע משמרות למתנדב</span>
                  <strong>{fairnessMetrics.average}</strong>
                </div>
                <div className="stats-card">
                  <span>פער עומס (מקסימום-מינימום)</span>
                  <strong>{fairnessMetrics.gap}</strong>
                </div>
              </div>

              <div className="fairness-columns">
                <div className="fairness-column">
                  <h3>Top עומס גבוה</h3>
                  {fairnessMetrics.topLoaded.length === 0 ? (
                    <p>אין נתונים להצגה.</p>
                  ) : (
                    fairnessMetrics.topLoaded.map((item) => (
                      <div className="fairness-row" key={`loaded_${item.name}`}>
                        <div className="fairness-meta">
                          <span>{item.name}</span>
                          <strong>{item.count}</strong>
                        </div>
                        <div className="fairness-bar-track">
                          <div
                            className="fairness-bar-fill"
                            style={{ width: `${item.percent}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="fairness-column">
                  <h3>Top תת-שיבוץ</h3>
                  {fairnessMetrics.topUnderAssigned.length === 0 ? (
                    <p>אין נתונים להצגה.</p>
                  ) : (
                    fairnessMetrics.topUnderAssigned.map((item) => (
                      <div className="fairness-row" key={`under_${item.name}`}>
                        <div className="fairness-meta">
                          <span>{item.name}</span>
                          <strong>{item.count}</strong>
                        </div>
                        <div className="fairness-bar-track under">
                          <div
                            className="fairness-bar-fill under"
                            style={{ width: `${item.percent}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>התראות כיסוי</h2>
                <span>{weekMetrics.warnings.length} התראות</span>
              </div>

              {weekMetrics.warnings.length === 0 ? (
                <p className="stats-ok">אין התראות. השיבוץ מלא ותקין לפי הכללים.</p>
              ) : (
                <div className="stats-warnings-list">
                  {weekMetrics.warnings.map((warning, index) => (
                    <div className="stats-warning-item" key={`${warning}_${index}`}>
                      {warning}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default AdminStatistics;
