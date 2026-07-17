export const getWeekId = () => {
  const today = new Date();

  const day = today.getDay();

  const sunday = new Date(today);

  sunday.setDate(
    today.getDate() - day
  );

  return `week_${sunday.getFullYear()}_${sunday.getMonth() + 1}_${sunday.getDate()}`;
};

export const getWeekIdFromDate = (dateInput) => {
  let sourceDate = null;

  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split("-").map(Number);
    sourceDate = new Date(year, month - 1, day);
  } else {
    sourceDate = new Date(dateInput);
  }

  if (Number.isNaN(sourceDate.getTime())) {
    return "";
  }

  const day = sourceDate.getDay();
  const sunday = new Date(sourceDate);
  sunday.setDate(sourceDate.getDate() - day);

  return `week_${sunday.getFullYear()}_${sunday.getMonth() + 1}_${sunday.getDate()}`;
};

export const parseWeekIdToDate = (weekId) => {
  if (!weekId || typeof weekId !== "string" || !weekId.startsWith("week_")) {
    return null;
  }

  const [, year, month, day] = weekId.split("_");
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};