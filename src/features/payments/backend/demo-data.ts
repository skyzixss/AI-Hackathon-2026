// Admin seed / isolated UI server only. Never imported by the browser bundle.
import { createHash } from "node:crypto";
import { moscowDay } from "../../studies/dates.ts";
import type { TuitionCharge } from "../model.ts";

export function demoTuition(studentId: string, variant: 0 | 1, now = new Date()): TuitionCharge[] {
  const [year, month] = moscowDay(now).split("-").map(Number);
  const day = (offset: number) => new Date(Date.UTC(year, month - 1 + offset, 15, 9)).toISOString().slice(0, 10);
  return [-1, 0, 1].map((offset, index) => {
    const hash = createHash("sha256").update(`campus-tuition-v1:${studentId}:${index}`).digest("hex");
    const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    const paid = variant === 1 || index === 0;
    return {
      id, student_id: studentId, title: `Обучение · платёж ${index + 1} из 3`,
      contract_number: variant ? "ДЕМО-Б-2026" : "ДЕМО-А-2026",
      amount_kopecks: variant ? 3800000 : 4500000,
      due_on: day(offset), paid_at: paid ? `${day(-1)}T09:00:00.000Z` : null,
      payment_reference: paid ? `DEMO-${variant ? "B" : "A"}-${index + 1}` : null,
      demo_only: true,
    };
  });
}
