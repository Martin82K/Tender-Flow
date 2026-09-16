export const TRIAL_DURATION_DAYS = 14;

export const getCalendarDaysRemaining = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const end = Date.parse(iso);
  if (!Number.isFinite(end)) return null;
  const days = Math.ceil((end - Date.now()) / 86_400_000);
  return days === 0 ? 0 : days;
};

const czechDayWord = (days: number): "den" | "dny" | "dní" => {
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) return "den";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "dny";
  return "dní";
};

export const formatTrialRemainingCopy = (days: number): string => {
  if (days < 0) return "Zkušební období skončilo";
  if (days === 0) return "Zkušební období končí dnes";
  const word = czechDayWord(days);
  const verb = word === "dny" ? "zbývají" : "zbývá";
  return `Zkušební období: ${verb} ${days} ${word}`;
};
