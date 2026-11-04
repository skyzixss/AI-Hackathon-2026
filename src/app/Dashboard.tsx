import { useCallback, useEffect, useState } from "react";
import type { Profile } from "../api/portal.ts";
import type { Api } from "./client.ts";
import { ResourceState, useResource, type Resource } from "./resource.tsx";
import { Icon } from "./Icon.tsx";
import { featuredLesson } from "./dashboard-model.ts";
import { numericAverage, gradeTone } from "../features/studies/Grades.tsx";
import { LessonList } from "../features/studies/Schedule.tsx";
import { addDays, dateLabel, moscowDay, scheduleRange, timeLabel } from "../features/studies/dates.ts";

const requestStatus = { submitted: "Подана", in_review: "На рассмотрении", ready: "Готово", rejected: "Отклонена" };
const assessment = { exam: "Экзамен", credit: "Зачёт", coursework: "Курсовая" };
function More({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="text-link" href={href}>{children}<Icon name="arrow" size={18} /></a>;
}
export function Dashboard({ api, sessionKey, profileState, retryProfile }: {
  api: Api; sessionKey: string; profileState: Resource<Profile>; retryProfile: () => void;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const today = moscowDay(new Date(now));
  const [selected, setSelected] = useState<string | null>(null);
  const range = scheduleRange(today, "week");
  const day = selected && selected >= range.start && selected < addDays(range.start, 7) ? selected : today;
  const loadSchedule = useCallback(() => api.schedule(range.from, range.to), [api, range.from, range.to]);
  const loadGrades = useCallback(() => api.grades(), [api]);
  const loadRequests = useCallback(() => api.requests(), [api]);
  const loadNotifications = useCallback(() => api.notifications(), [api]);
  const schedule = useResource(`${sessionKey}:dashboard:${range.from}`, loadSchedule);
  const grades = useResource(`${sessionKey}:dashboard:grades`, loadGrades);
  const requests = useResource(`${sessionKey}:dashboard:requests`, loadRequests);
  const notifications = useResource(`${sessionKey}:dashboard:notifications`, loadNotifications);
  const lessons = schedule.state.status === "ready" ? schedule.state.data : [];
  const featured = featuredLesson(lessons.filter(item => moscowDay(new Date(item.starts_at)) === today), now);
  const profile = profileState.status === "ready" ? profileState.data : null;
  return <div className="dashboard-grid">
    <section className="lesson-hero" aria-label="Занятие на сегодня">
      <ResourceState {...schedule} />
      {schedule.state.status === "ready" && (featured ? <>
        <div className="hero-meta"><span className="hero-label">{{ current: "Сейчас", next: "Следующая пара", finished: "Сегодня · завершено" }[featured.phase]}</span>
          <span>{timeLabel(featured.lesson.starts_at)}–{timeLabel(featured.lesson.ends_at)} · МСК</span></div>
        <h2>{featured.lesson.subject}</h2>
        <p className="hero-location">{featured.lesson.room} · {featured.lesson.teacher}</p>
        <div className="hero-actions"><a className="button hero-button" href="#schedule">Открыть расписание<Icon name="arrow" size={18} /></a>
          {featured.lesson.change_note && <span className="hero-change"><Icon name="bell" size={16} />{featured.lesson.change_note}</span>}
        </div>
      </> : <>
        <span className="hero-label">Сегодня</span><h2>День без занятий</h2>
        <p className="hero-location">На сегодня в расписании нет пар</p>
        <a className="button hero-button" href="#schedule">Посмотреть неделю<Icon name="arrow" size={18} /></a>
      </>)}
    </section>
    <section className="panel academic-card" aria-labelledby="academic-heading">
      <h2 id="academic-heading">Успеваемость</h2><ResourceState {...grades} />
      {grades.state.status === "ready" && <>
        <strong className="academic-average">{numericAverage(grades.state.data)}</strong>
        <span>Средний балл</span>
        <p className="muted small">{grades.state.data.length ? `Результатов: ${grades.state.data.length} · все семестры` : "Оценок пока нет"}</p>
        <More href="#grades">Все результаты</More>
      </>}
    </section>
    <section className="panel day-card" aria-labelledby="day-heading">
      <div className="section-heading"><h2 id="day-heading">{day === today ? "Сегодня" : dateLabel(day)}</h2><More href="#schedule">Вся неделя</More></div>
      <div className="week-strip" aria-label="День недели">
        {Array.from({ length: 7 }, (_, index) => {
          const value = addDays(range.start, index);
          return <button key={value} aria-pressed={day === value} aria-current={today === value ? "date" : undefined}
            aria-label={dateLabel(value, { weekday: "long", day: "numeric", month: "long" })}
            onClick={() => setSelected(value)}><span>{dateLabel(value, { weekday: "short" })}</span><strong>{dateLabel(value, { day: "numeric" })}</strong></button>;
        })}
      </div>
      <ResourceState {...schedule} />
      {schedule.state.status === "ready" && <div className="day-content" key={day}><LessonList compact lessons={lessons.filter(item => moscowDay(new Date(item.starts_at)) === day)} /></div>}
    </section>
    <section className="panel requests-card" aria-labelledby="requests-heading">
      <h2 id="requests-heading">Справки и заявки</h2><ResourceState {...requests} />
      {requests.state.status === "ready" && <>
        {requests.state.data.length ? <ul className="request-preview">{requests.state.data.slice(0, 2).map(item => <li key={item.id}>
          <span>{item.kind === "certificate" ? "Справка" : "Заявление"}</span><span className={`status-text status-${item.status}`}>{requestStatus[item.status]}</span>
        </li>)}</ul> : <div className="dashboard-empty"><Icon name="document" size={32} /><h3>Заявок пока нет</h3><p>Закажи справку онлайн</p></div>}
        <a className="button secondary" href="#requests">Подать заявку<Icon name="arrow" size={18} /></a>
      </>}
    </section>
    <section className="panel profile-card" aria-labelledby="profile-heading">
      <h2 id="profile-heading">Мой профиль</h2><ResourceState state={profileState} retry={retryProfile} />
      {profile && <><ul className="profile-preview">
        <li><Icon name="group" size={24} /><span><small className="sr-only">Группа</small>{profile.group_name}</span></li>
        <li><Icon name="school" size={24} /><span><small className="sr-only">Курс</small>{profile.course} курс</span></li>
        <li><Icon name="laptop" size={24} /><span><small className="sr-only">Направление</small>{profile.program}</span></li>
      </ul><More href="#profile">Открыть профиль</More></>}
    </section>
    <section className="panel results-card" aria-labelledby="results-heading">
      <h2 id="results-heading">Зачёты и экзамены</h2><ResourceState {...grades} />
      {grades.state.status === "ready" && (grades.state.data.length ? <ul className="results-preview">{grades.state.data.slice(-3).reverse().map(item => <li key={item.id}>
        <span>{item.subject}<small>{assessment[item.assessment]} · {item.semester} семестр</small></span><strong className={gradeTone(item.result)}>{item.result}</strong>
      </li>)}</ul> : <p className="muted card-empty">Результаты появятся после публикации</p>)}
    </section>
    <section className="panel news-card" aria-labelledby="news-heading">
      <h2 id="news-heading">Уведомления</h2><ResourceState {...notifications} />
      {notifications.state.status === "ready" && <>
        {notifications.state.data.length ? <ul className="news-preview">{notifications.state.data.slice(0, 2).map(item => <li key={item.id} className={item.read_at ? "news-read" : "news-unread"}>
          <span className="news-dot" aria-label={item.read_at ? "Прочитано" : "Не прочитано"} /><div><h3>{item.title}</h3><p>{item.body}</p></div>
        </li>)}</ul> : <p className="muted card-empty">Новых уведомлений пока нет</p>}
        <More href="#notifications">Все уведомления</More>
      </>}
    </section>
  </div>;
}
