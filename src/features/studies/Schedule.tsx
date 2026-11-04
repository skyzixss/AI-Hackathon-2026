import { useCallback, useState } from "react";
import type { Lesson } from "../../api/portal.ts";
import type { Api } from "../../app/client.ts";
import { Icon } from "../../app/Icon.tsx";
import { ResourceState, useResource } from "../../app/resource.tsx";
import {
  addDays,
  dateLabel,
  moscowDay,
  scheduleRange,
  timeLabel,
} from "./dates.ts";

export function LessonList({
  lessons,
  compact = false,
}: {
  lessons: Lesson[];
  compact?: boolean;
}) {
  if (!lessons.length)
    return (
      <div className="empty-state">
        <span className="empty-icon">
          <Icon name="calendar" size={28} />
        </span>
        <h3>На этот день занятий нет</h3>
        <p>Можно выдохнуть или выбрать другой день.</p>
      </div>
    );
  return (
    <ol className={`lesson-list ${compact ? "compact" : ""}`}>
      {lessons.map((lesson, index) => (
        <li
          key={lesson.id}
          className={lesson.change_note ? "lesson changed" : "lesson"}
        >
          <div className="lesson-time">
            <strong>{timeLabel(lesson.starts_at)}</strong>
            <span>{timeLabel(lesson.ends_at)}</span>
          </div>
          <div className="lesson-line">
            <i />
          </div>
          <div className="lesson-info">
            <span className="lesson-number">ЗАНЯТИЕ {index + 1}</span>
            <h3>{lesson.subject}</h3>
            <p>
              <span>
                <Icon name="pin" size={15} />
                {lesson.room}
              </span>
              <span>
                <Icon name="user" size={15} />
                {lesson.teacher}
              </span>
            </p>
            {lesson.change_note && (
              <div className="change-note">
                <span />
                {lesson.change_note}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Schedule({
  api,
  sessionKey,
  compact = false,
}: {
  api: Api;
  sessionKey: string;
  compact?: boolean;
}) {
  const today = moscowDay();
  const [day, setDay] = useState(today);
  const [mode, setMode] = useState<"day" | "week">("day");
  const range = scheduleRange(day, compact ? "day" : mode);
  const load = useCallback(
    () => api.schedule(range.from, range.to),
    [api, range.from, range.to],
  );
  const { state, retry } = useResource(
    `${sessionKey}:schedule:${range.from}:${range.to}`,
    load,
  );
  const days = Array.from(
    { length: compact || mode === "day" ? 1 : 7 },
    (_, i) => addDays(range.start, i),
  );
  return (
    <section className="panel schedule-panel" aria-labelledby="schedule-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ТВОЙ УЧЕБНЫЙ РИТМ</span>
          <h2 id="schedule-title">
            {compact ? "Сегодня в расписании" : "Расписание"}
          </h2>
        </div>
        <span className="time-zone">МСК · UTC+3</span>
      </div>
      {!compact && (
        <div className="schedule-toolbar">
          <div className="segmented" aria-label="Период расписания">
            <button
              aria-pressed={mode === "day"}
              onClick={() => {
                setMode("day");
                setDay(today);
              }}
            >
              Сегодня
            </button>
            <button
              aria-pressed={mode === "week"}
              onClick={() => setMode("week")}
            >
              Неделя
            </button>
          </div>
          <div className="date-controls">
            <button
              className="icon-button previous"
              aria-label={
                mode === "day" ? "Предыдущий день" : "Предыдущая неделя"
              }
              onClick={() => setDay(addDays(day, mode === "day" ? -1 : -7))}
            >
              <Icon name="chevron" size={18} />
            </button>
            <label className="date-picker">
              <span className="sr-only">Выбрать дату</span>
              <input
                type="date"
                value={day}
                onChange={(event) => {
                  if (event.target.value) setDay(event.target.value);
                }}
              />
            </label>
            <button
              className="icon-button"
              aria-label={
                mode === "day" ? "Следующий день" : "Следующая неделя"
              }
              onClick={() => setDay(addDays(day, mode === "day" ? 1 : 7))}
            >
              <Icon name="chevron" size={18} />
            </button>
          </div>
        </div>
      )}
      <ResourceState state={state} retry={retry} />
      {state.status === "ready" && (
        <div>
          {days.map((date) => (
            <div className="schedule-day" key={date}>
              <div className="day-heading">
                <h3>
                  {dateLabel(date, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </h3>
                {date === today && <span className="pill">Сегодня</span>}
              </div>
              <LessonList
                compact={compact}
                lessons={state.data.filter(
                  (lesson) => moscowDay(new Date(lesson.starts_at)) === date,
                )}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
