// Synthetic seed data only. This module is not imported by the browser app.
import { createHash } from "node:crypto";
import type { Grade, Lesson, Notification, StudentRequest } from "../src/api/portal.ts";
import { addDays, moscowDay, weekStart } from "../src/features/studies/dates.ts";

export function createDemoData(studentId: string, variant: 0 | 1, now = new Date()) {
  const today = moscowDay(now);
  const monday = weekStart(today);
  const at = (day: string, time: string) => new Date(`${day}T${time}:00+03:00`).toISOString();
  // Stable IDs make refresh safe to repeat. Account IDs scope every entity.
  const id = (name: string) => {
    const bytes = createHash("sha256").update(`campus-demo-v1:${studentId}:${name}`).digest().subarray(0, 16);
    bytes[6] = (bytes[6] & 15) | 128;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = bytes.toString("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
  const subjects = variant ? ["Микроэкономика", "Статистика", "Бухгалтерский учёт", "Деловой английский", "Финансовый анализ", "Учебный проект"] :
    ["Математический анализ", "Алгоритмы и структуры данных", "Базы данных", "Иностранный язык", "Компьютерные сети", "Учебный проект"];
  const slots: [number, string, string, number, string?][] = [
    [0, "09:00", "10:30", 0], [0, "10:40", "12:10", 1],
    [1, "10:40", "12:10", 2], [1, "12:40", "14:10", 3],
    [2, "09:00", "10:30", 0], [2, "10:40", "12:10", 1, "Аудитория изменена: Демо-214 вместо Демо-101"],
    [2, "12:40", "14:10", 2], [2, "14:20", "15:50", 3],
    [3, "10:40", "12:10", 4], [3, "12:40", "14:10", 5],
    [4, "09:00", "10:30", 1], [4, "12:40", "14:10", 2, "Начало перенесено с 10:40 на 12:40"],
    [4, "14:20", "15:50", 5], [5, "10:40", "12:10", 5],
  ];
  const schedule: Lesson[] = slots.map(([offset, start, end, subject, change], index) => ({
    id: id(`lesson:${index}`), student_id: studentId, subject: subjects[subject],
    starts_at: at(addDays(monday, offset), start), ends_at: at(addDays(monday, offset), end),
    room: change?.startsWith("Аудитория") ? "Демо-214" : `Демо-${(variant ? 200 : 100) + subject + 1}`,
    teacher: `Вымышленный преподаватель ${variant ? "Б" : "А"}${subject + 1}`, change_note: change ?? null,
  }));
  const semester = variant ? 5 : 3;
  const records: [string, Grade["assessment"], string, number][] = [
    [variant ? "Экономическая история" : "История", "exam", "4", semester - 1],
    [variant ? "Прикладная математика" : "Линейная алгебра", "exam", "5", semester - 1],
    [subjects[1], "exam", "5", semester], [subjects[2], "exam", "4", semester],
    [subjects[0], "exam", variant ? "4" : "2", semester],
    ["Физическая культура", "credit", variant ? "Зачтено" : "Не зачтено", semester],
    [subjects[3], "credit", "Зачтено", semester], [subjects[5], "coursework", "5", semester],
    [subjects[4], "exam", "3", semester],
  ];
  const grades: Grade[] = records.map(([subject, assessment, result, period], index) => ({
    id: id(`grade:${index}`), student_id: studentId, subject, assessment, result, semester: period,
    exam_at: at(addDays(today, period < semester ? -140 - index : -14 + index), "10:00"),
  }));
  const requestData: [StudentRequest["kind"], string, StudentRequest["status"]][] = variant ? [
    ["application", "Прошу разрешить выбор места учебной практики. Данные вымышлены.", "submitted"],
  ] : [
    ["certificate", "Прошу выдать справку об обучении для предоставления по месту требования.", "ready"],
    ["application", "Прошу рассмотреть заявление о выборе темы учебного проекта.", "in_review"],
    ["certificate", "Прошу выдать справку за прошлый учебный год. Заявка возвращена: нужно указать период.", "rejected"],
  ];
  const requests: StudentRequest[] = requestData.map(([kind, body, status], index) => ({
    id: id(`request:${index}`), student_id: studentId, kind, body, status,
    created_at: at(addDays(today, -1 - index), "12:00"),
  }));
  const notifications: Notification[] = [
    { id: id("news:room"), student_id: studentId, title: "Изменение аудитории", body: `${subjects[1]} в среду пройдёт в Демо-214. Изменение отмечено в расписании.`, created_at: at(today, "08:00"), read_at: null },
    { id: id("news:results"), student_id: studentId, title: variant ? "Результаты опубликованы" : "Есть незакрытые дисциплины", body: variant ? "В успеваемости доступны экзамены, зачёты и курсовая работа." : "Математический анализ и физическая культура требуют внимания. Открой успеваемость и включи «Только долги».", created_at: at(addDays(today, -1), "16:00"), read_at: null },
    { id: id("news:requests"), student_id: studentId, title: variant ? "Заявление принято" : "Справка об обучении готова", body: "Статусы и история доступны в разделе «Справки и заявки». Это вымышленный пример для демонстрации.", created_at: at(addDays(today, -2), "12:00"), read_at: at(addDays(today, -1), "09:00") },
  ];
  return { schedule, grades, requests, notifications };
}
