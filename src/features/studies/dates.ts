const ZONE = "Europe/Moscow";
export function moscowDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00+03:00`);
  date.setUTCDate(date.getUTCDate() + amount);
  return moscowDay(date);
}
export function weekStart(day: string) {
  const weekday = new Date(`${day}T12:00:00+03:00`).getUTCDay();
  return addDays(day, -(weekday === 0 ? 6 : weekday - 1));
}
export function scheduleRange(day: string, mode: "day" | "week") {
  const start = mode === "week" ? weekStart(day) : day;
  return {
    start,
    from: new Date(`${start}T00:00:00+03:00`).toISOString(),
    to: new Date(
      `${addDays(start, mode === "week" ? 7 : 1)}T00:00:00+03:00`,
    ).toISOString(),
  };
}
export function dateLabel(
  day: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) {
  return new Intl.DateTimeFormat("ru-RU", {
    ...options,
    timeZone: ZONE,
  }).format(new Date(`${day}T12:00:00+03:00`));
}
export function timeLabel(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
