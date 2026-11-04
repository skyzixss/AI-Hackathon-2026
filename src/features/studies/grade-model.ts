import type { Grade } from "../../api/portal.ts";

export function isDebt(result: string) {
  return /^(2|неудовлетворительно|не\s*зачтено|незач[её]т)$/i.test(result.trim());
}
export function gradeTone(result: string) {
  if (isDebt(result)) return "negative";
  if (/^(5|4|отлично|хорошо|зачтено|зач[её]т)$/i.test(result.trim())) return "positive";
  return "neutral";
}
export function numericAverage(grades: Grade[]) {
  const values = grades.map(grade => grade.result.trim()).filter(value => /^[2-5]$/.test(value)).map(Number);
  return values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length)
    .toLocaleString("ru-RU", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : "—";
}
