// The front door greeting follows the hour in Harare, whatever the server's
// own clock zone is.
export type DayPart = "morning" | "afternoon" | "evening";

export function harareHour(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Africa/Harare",
    }).format(now),
  );
}

export function dayPart(hour: number): DayPart {
  if (hour >= 4 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
}

/** Well known places the index resolves exactly; chips plan straight to them. */
export const QUICK_PLACES = [
  "Avondale",
  "University of Zimbabwe",
  "Borrowdale",
  "Market Square",
];
