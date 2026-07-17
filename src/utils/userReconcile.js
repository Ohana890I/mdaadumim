import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../services/firebase";

const normalizeText = (value) => {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/["'׳״`]/g, "")
    .replace(/\s+/g, " ");
};

const normalizeNoSpaces = (value) => normalizeText(value).replace(/\s+/g, "");

const buildAliases = (fullName, username) => {
  const rawAliases = [fullName, username].filter(Boolean);

  const normalized = new Set();
  const normalizedNoSpaces = new Set();

  rawAliases.forEach((alias) => {
    const norm = normalizeText(alias);
    if (norm) {
      normalized.add(norm);
      normalizedNoSpaces.add(normalizeNoSpaces(alias));
    }
  });

  return {
    normalized,
    normalizedNoSpaces,
  };
};

const matchesAlias = (value, aliases) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }

  if (aliases.normalized.has(normalized)) {
    return true;
  }

  const withoutSpaces = normalizeNoSpaces(value);
  if (aliases.normalizedNoSpaces.has(withoutSpaces)) {
    return true;
  }

  return false;
};

const reconcileScheduleCollection = async (collectionName, aliases, canonicalFullName) => {
  const snapshot = await getDocs(collection(db, collectionName));

  let updatedDocs = 0;

  for (const docItem of snapshot.docs) {
    const data = docItem.data();
    const schedule = data.schedule || {};

    let changed = false;
    const nextSchedule = {};

    Object.entries(schedule).forEach(([shiftKey, shiftValue]) => {
      const shift = shiftValue || {};
      const nextShift = { ...shift };

      Object.keys(nextShift).forEach((fieldKey) => {
        const value = nextShift[fieldKey];
        if (matchesAlias(value, aliases)) {
          nextShift[fieldKey] = canonicalFullName;
          changed = true;
        }
      });

      nextSchedule[shiftKey] = nextShift;
    });

    if (changed) {
      await setDoc(
        doc(db, collectionName, docItem.id),
        {
          ...data,
          schedule: nextSchedule,
        },
        { merge: true }
      );
      updatedDocs++;
    }
  }

  return updatedDocs;
};

const reconcileAvailabilities = async (aliases, canonicalFullName, userId, username) => {
  const snapshot = await getDocs(collection(db, "availabilities"));

  let updatedDocs = 0;

  for (const docItem of snapshot.docs) {
    const data = docItem.data();
    const shouldMatchByName = matchesAlias(data.fullName, aliases);

    if (!shouldMatchByName) {
      continue;
    }

    const payload = {};

    if (data.fullName !== canonicalFullName) {
      payload.fullName = canonicalFullName;
    }

    if (!data.userId) {
      payload.userId = userId;
    }

    if (!data.username && username) {
      payload.username = username;
    }

    if (Object.keys(payload).length > 0) {
      await updateDoc(doc(db, "availabilities", docItem.id), payload);
      updatedDocs++;
    }
  }

  return updatedDocs;
};

export const reconcileNewUserReferences = async ({
  userId,
  fullName,
  username,
}) => {
  const canonicalFullName = (fullName || "").trim();
  const canonicalUsername = (username || "").trim();

  if (!userId || !canonicalFullName) {
    return {
      publishedSchedulesUpdated: 0,
      draftSchedulesUpdated: 0,
      availabilitiesUpdated: 0,
    };
  }

  const aliases = buildAliases(canonicalFullName, canonicalUsername);

  const publishedSchedulesUpdated = await reconcileScheduleCollection(
    "publishedSchedules",
    aliases,
    canonicalFullName
  );

  const draftSchedulesUpdated = await reconcileScheduleCollection(
    "draftSchedules",
    aliases,
    canonicalFullName
  );

  const availabilitiesUpdated = await reconcileAvailabilities(
    aliases,
    canonicalFullName,
    userId,
    canonicalUsername
  );

  return {
    publishedSchedulesUpdated,
    draftSchedulesUpdated,
    availabilitiesUpdated,
  };
};
