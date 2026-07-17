import {
  collection,
  getDocs
} from "firebase/firestore";

import { db } from "../services/firebase";
import { getWeekId } from "./weekUtils";

const parseWeekDate = (weekId) => {
  if (!weekId || typeof weekId !== "string") {
    return null;
  }

  if (weekId.startsWith("week_")) {
    const parts = weekId.split("_");
    if (parts.length !== 4) {
      return null;
    }

    const year = Number(parts[1]);
    const month = Number(parts[2]);
    const day = Number(parts[3]);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }

    return new Date(year, month - 1, day);
  }

  const parsed = new Date(weekId);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const getPeopleFromShift = (shift) => {
  if (!shift || typeof shift !== "object") {
    return [];
  }

  return Object.values(shift).filter(
    (person) =>
      typeof person === "string" &&
      person.trim() !== "" &&
      !person.includes("❌")
  );
};

const normalizePersonName = (value) =>
  (value || "")
    .toString()
    .trim()
    .replace(/["'׳״`]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();

export const getUserStats =
  async (currentWeekId = getWeekId()) => {

    const stats = {};

    const publishedSnapshot =
      await getDocs(
        collection(
          db,
          "publishedSchedules"
        )
      );

    const availabilitySnapshot =
      await getDocs(
        collection(
          db,
          "availabilities"
        )
      );

    const currentWeekDate = parseWeekDate(currentWeekId) || new Date();

    const publishedWeeks = publishedSnapshot.docs
      .map((docItem) => {
        const data = docItem.data();
        const weekId = data.weekId || docItem.id;
        const weekDate = parseWeekDate(weekId);

        return {
          weekId,
          weekDate,
          schedule: data.schedule || {},
        };
      })
      .filter((item) => item.weekDate)
      .sort((a, b) => b.weekDate - a.weekDate);

    const weeksUpToCurrent = publishedWeeks
      .filter((item) => item.weekDate <= currentWeekDate);

    const previousWeeks = publishedWeeks
      .filter((item) => item.weekDate < currentWeekDate);

    // Count assignments from the latest 4 weeks (including current week if already published).
    const last4Weeks = weeksUpToCurrent.slice(0, 4);
    const previousWeek = previousWeeks[0] || null;

    const ensureUserStat = (person) => {
      const normalizedPerson = normalizePersonName(person);
      if (!normalizedPerson) {
        return;
      }

      if (!stats[normalizedPerson]) {
        stats[normalizedPerson] = {
          shifts: 0,
          fridayEvening: 0,
        };
      }
    };

    last4Weeks.forEach((weekItem) => {
      Object.values(weekItem.schedule).forEach((shift) => {
        getPeopleFromShift(shift).forEach((person) => {
          const normalizedPerson = normalizePersonName(person);
          if (!normalizedPerson) {
            return;
          }
          ensureUserStat(person);
          stats[normalizedPerson].shifts++;
        });
      });
    });

    if (previousWeek) {
      const fridayEveningShift = previousWeek.schedule["שישי-ערב"];
      getPeopleFromShift(fridayEveningShift).forEach((person) => {
        const normalizedPerson = normalizePersonName(person);
        if (!normalizedPerson) {
          return;
        }
        ensureUserStat(person);
        stats[normalizedPerson].fridayEvening++;
      });

      const previousWeekAssigned = new Set();
      Object.values(previousWeek.schedule).forEach((shift) => {
        getPeopleFromShift(shift).forEach((person) => {
          const normalizedPerson = normalizePersonName(person);
          if (!normalizedPerson) {
            return;
          }
          previousWeekAssigned.add(normalizedPerson);
        });
      });

      availabilitySnapshot.docs.forEach((docItem) => {
        const data = docItem.data() || {};
        if (data.weekId !== previousWeek.weekId) {
          return;
        }

        const normalizedPerson = normalizePersonName(data.fullName || "");
        if (!normalizedPerson) {
          return;
        }

        const hasAnyAvailability = Object.values(data.availability || {}).some(Boolean);
        if (!hasAnyAvailability || previousWeekAssigned.has(normalizedPerson)) {
          return;
        }

        ensureUserStat(normalizedPerson);
        stats[normalizedPerson].availableNotAssignedPrevWeek =
          (stats[normalizedPerson].availableNotAssignedPrevWeek || 0) + 1;
      });
    }

    return stats;
};