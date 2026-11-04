import { useCallback, useState } from "react";
import type { Api } from "../../app/client.ts";
import type { Grade } from "../../api/portal.ts";
import { Icon } from "../../app/Icon.tsx";
import { ResourceState, useResource } from "../../app/resource.tsx";
import { dateLabel, moscowDay } from "./dates.ts";

const assessment = {
  exam: "Экзамен",
  credit: "Зачёт",
  coursework: "Курсовая работа",
};
export function gradeTone(result: string) {
  if (/^(5|4|отлично|хорошо|зачтено|зачёт|зачет)$/i.test(result.trim()))
    return "positive";
  if (
    /^(2|неудовлетворительно|не зачтено|незачёт|незачет)$/i.test(result.trim())
  )
    return "negative";
  return "neutral";
}
export function numericAverage(grades: Grade[]) {
  const values = grades
    .map((grade) => grade.result.trim())
    .filter((value) => /^[2-5]$/.test(value))
    .map(Number);
  return values.length
    ? (
        values.reduce((sum, value) => sum + value, 0) / values.length
      ).toLocaleString("ru-RU", {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
      })
    : "—";
}
export function Grades({
  api,
  sessionKey,
  compact = false,
}: {
  api: Api;
  sessionKey: string;
  compact?: boolean;
}) {
  const load = useCallback(() => api.grades(), [api]);
  const { state, retry } = useResource(`${sessionKey}:grades`, load);
  const [semester, setSemester] = useState("all");
  const grades = state.status === "ready" ? state.data : [];
  const filtered = grades.filter(
    (grade) => semester === "all" || String(grade.semester) === semester,
  );
  return (
    <section className="panel grades-panel" aria-labelledby="grades-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ШАГ ЗА ШАГОМ</span>
          <h2 id="grades-title">
            {compact ? "Учёба в цифрах" : "Успеваемость"}
          </h2>
        </div>
        <span className="section-icon">
          <Icon name="grades" />
        </span>
      </div>
      <ResourceState state={state} retry={retry} />
      {state.status === "ready" && (
        <>
          {!grades.length ? (
            <div className="empty-state">
              <Icon name="grades" size={28} />
              <h3>Оценок пока нет</h3>
              <p>Результаты появятся после публикации учебной системой.</p>
            </div>
          ) : (
            <>
              <div className="grade-summary">
                <div>
                  <span>Средний балл</span>
                  <strong>{numericAverage(filtered)}</strong>
                  <small>по оценкам от 2 до 5</small>
                </div>
                <div>
                  <span>Результатов</span>
                  <strong>{filtered.length}</strong>
                  <small>
                    {semester === "all"
                      ? "за все семестры"
                      : `за ${semester} семестр`}
                  </small>
                </div>
              </div>
              {!compact && (
                <>
                  <label className="semester-select">
                    Период
                    <select
                      aria-label="Период"
                      value={semester}
                      onChange={(event) => setSemester(event.target.value)}
                    >
                      <option value="all">Все семестры</option>
                      {[...new Set(grades.map((grade) => grade.semester))]
                        .sort((a, b) => b - a)
                        .map((value) => (
                          <option key={value} value={value}>
                            {value} семестр
                          </option>
                        ))}
                    </select>
                  </label>
                  <ul className="grade-list">
                    {filtered.map((grade) => (
                      <li key={grade.id}>
                        <div>
                          <span className="lesson-number">
                            {assessment[grade.assessment]} · {grade.semester}{" "}
                            СЕМЕСТР
                          </span>
                          <h3>{grade.subject}</h3>
                          {grade.exam_at && (
                            <p className="muted small">
                              Сессия:{" "}
                              {dateLabel(moscowDay(new Date(grade.exam_at)))} ·
                              МСК
                            </p>
                          )}
                        </div>
                        <span
                          className={`grade-result ${gradeTone(grade.result)}`}
                        >
                          {grade.result}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
