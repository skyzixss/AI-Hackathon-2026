import { useCallback, useState } from "react";
import type { Api } from "../../app/client.ts";
import { Icon } from "../../app/Icon.tsx";
import { ResourceState, useResource } from "../../app/resource.tsx";
import { dateLabel, moscowDay } from "./dates.ts";
import { isDebt, gradeTone, numericAverage } from "./grade-model.ts";
export { gradeTone, numericAverage } from "./grade-model.ts";

const assessment = {
  exam: "Экзамен",
  credit: "Зачёт",
  coursework: "Курсовая работа",
};
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
  const [onlyDebts, setOnlyDebts] = useState(false);
  const grades = state.status === "ready" ? state.data : [];
  const filtered = grades.filter(
    (grade) => semester === "all" || String(grade.semester) === semester,
  );
  const debts = filtered.filter(grade => isDebt(grade.result));
  const visible = onlyDebts ? debts : filtered;
  return (
    <section className="panel grades-panel" aria-labelledby="grades-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Результаты по дисциплинам</span>
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
                <div className="debt-summary">
                  <span>Долги за период</span>
                  <strong className={debts.length ? "has-debts" : undefined}>{debts.length}</strong>
                  <small>«2» или «Не зачтено»</small>
                </div>
              </div>
              {!compact && (
                <>
                  <div className="grade-filters">
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
                  <button className="button secondary debt-filter" aria-pressed={onlyDebts} onClick={() => setOnlyDebts(value => !value)}>Только долги</button>
                  </div>
                  {onlyDebts && <p className="debt-explanation" role="status">{debts.length ? "Показаны неудовлетворительные результаты за выбранный период" : "Долгов за выбранный период нет"}</p>}
                  <ul className="grade-list">
                    {visible.map((grade) => (
                      <li key={grade.id} className={isDebt(grade.result) ? "grade-debt" : undefined}>
                        <div>
                          <span className="lesson-number">
                            {assessment[grade.assessment]} · {grade.semester}{" "}
                            семестр
                          </span>
                          <h3>{grade.subject}</h3>
                          {isDebt(grade.result) && <p className="debt-label">Долг · нужно закрыть дисциплину</p>}
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
