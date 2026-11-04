import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { connection, type Api } from "./client.ts";
import { Login } from "../features/auth/Login.tsx";
import { ProfilePanel, initials } from "../features/profile/ProfilePanel.tsx";
import { Schedule } from "../features/studies/Schedule.tsx";
import { Grades } from "../features/studies/Grades.tsx";
import { dateLabel, moscowDay } from "../features/studies/dates.ts";
import { ResourceState, useResource } from "./resource.tsx";
import { Icon } from "./Icon.tsx";
import { RequestsPanel, NotificationsPanel } from "./extensions.tsx";

const navigation = [
  { id: "home", title: "Главная", icon: "home" },
  { id: "schedule", title: "Расписание", icon: "calendar" },
  { id: "grades", title: "Успеваемость", icon: "grades" },
  { id: "requests", title: "Справки и заявки", icon: "document" },
  { id: "notifications", title: "Уведомления", icon: "bell" },
  { id: "profile", title: "Мой профиль", icon: "user" },
] as const;
type Page = (typeof navigation)[number]["id"];
function currentPage(): Page {
  const hash = window.location.hash.slice(1);
  return navigation.find((item) => item.id === hash)?.id ?? "home";
}
type Auth =
  | { status: "checking" }
  | { status: "error" }
  | { status: "ready"; session: Session | null };

export function App() {
  const [auth, setAuth] = useState<Auth>(
    connection ? { status: "checking" } : { status: "ready", session: null },
  );
  const [expired, setExpired] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const hadSession = useRef(false);
  useEffect(() => {
    if (!connection) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (active)
        setAuth((previous) =>
          previous.status === "checking" ? { status: "error" } : previous,
        );
    }, 15000);
    const {
      data: { subscription },
    } = connection.client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      window.clearTimeout(timer);
      if (!session && hadSession.current) setExpired(true);
      if (session) setExpired(false);
      hadSession.current = !!session;
      setAuth({ status: "ready", session });
    });
    return () => {
      active = false;
      window.clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);
  async function signOut() {
    if (!connection) return;
    // Immediately unmount private screens, even if the network call fails.
    setLeaving(true);
    setLogoutError(false);
    try {
      await connection.api.signOut();
      setAuth({ status: "ready", session: null });
      setExpired(false);
      setLeaving(false);
      window.location.hash = "home";
    } catch {
      setLogoutError(true);
    }
  }
  if (leaving)
    return (
      <main className="full-state" aria-live="polite">
        <span className="brand-mark">к.</span>
        <h1>
          {logoutError ? "Не удалось завершить сессию" : "Выходим из кабинета…"}
        </h1>
        <p>Личные данные скрыты.</p>
        {logoutError ? (
          <button className="button primary" onClick={signOut}>
            Повторить выход
          </button>
        ) : (
          <span
            className="loader"
            role="status"
            aria-label="Завершаем сессию"
          />
        )}
      </main>
    );
  if (auth.status !== "ready")
    return (
      <main className="full-state">
        <span className="brand-mark">к.</span>
        <h1>
          {auth.status === "error"
            ? "Не удалось проверить сессию"
            : "Открываем твой кампус…"}
        </h1>
        {auth.status === "error" ? (
          <button
            className="button primary"
            onClick={() => window.location.reload()}
          >
            Попробовать снова
          </button>
        ) : (
          <span
            className="loader"
            role="status"
            aria-label="Проверяем сессию"
          />
        )}
      </main>
    );
  if (!auth.session || !connection)
    return <Login api={connection?.api ?? null} expired={expired} />;
  return (
    <StudentPortal
      key={auth.session.user.id}
      api={connection.api}
      sessionKey={auth.session.user.id}
      onSignOut={signOut}
    />
  );
}

function StudentPortal({
  api,
  sessionKey,
  onSignOut,
}: {
  api: Api;
  sessionKey: string;
  onSignOut: () => void;
}) {
  const [page, setPage] = useState<Page>(currentPage);
  const [notificationsRevision, setNotificationsRevision] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const load = useCallback(async () => {
    const profile = await api.profile();
    if (profile.student_id !== sessionKey) throw new Error("Profile mismatch");
    return profile;
  }, [api, sessionKey]);
  const { state, retry } = useResource(`${sessionKey}:profile`, load);
  useEffect(() => {
    const change = () => setPage(currentPage());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [page]);
  const active = navigation.find((item) => item.id === page)!;
  const profile = state.status === "ready" ? state.data : null;
  const name = profile?.full_name ?? "Личный кабинет";
  const today = moscowDay();
  return (
    <div className="portal-layout">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        К содержимому
      </a>
      <aside className="sidebar">
        <a className="brand" href="#home">
          <span className="brand-mark">к.</span>кампус
          <span className="brand-dot" />
        </a>
        <span className="sidebar-label">ПРОСТРАНСТВО СТУДЕНТА</span>
        <nav aria-label="Основная навигация">
          {navigation.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={page === item.id ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.title}</span>
              {page === item.id && <i />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Icon name="spark" />
            <strong>
              Твой день.
              <br />
              Без лишней суеты.
            </strong>
            <p>Всё важное — рядом.</p>
          </div>
          <button className="logout" onClick={onSignOut}>
            <Icon name="logout" />
            Выйти из кабинета
          </button>
          <p className="sidebar-legal">
            Конкурсный концепт.
            <br />
            Не официальный сервис вуза.
          </p>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            Личный кабинет <span>/</span> <strong>{active.title}</strong>
          </span>
          <div className="topbar-right">
            <span className="today-label">
              {dateLabel(today, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <a
              className="icon-button"
              href="#notifications"
              aria-label="Открыть уведомления"
            >
              <Icon name="bell" />
            </a>
            <a className="avatar" href="#profile" aria-label="Открыть профиль">
              {profile ? initials(name) : "·"}
            </a>
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {page === "home"
                  ? "ВСЁ ВАЖНОЕ — В ОДНОМ МЕСТЕ"
                  : "ЛИЧНЫЙ КАБИНЕТ"}
              </span>
              <h1 ref={heading} tabIndex={-1}>
                {page === "home" ? (
                  <>
                    Привет{profile ? `, ${name.split(" ")[0]}` : ""}
                    <span className="accent">.</span>
                  </>
                ) : (
                  active.title
                )}
              </h1>
              <p className="muted">
                {page === "home"
                  ? "Хороший день начинается с ясного плана."
                  : (
                      {
                        schedule: "Планируй неделю. Мы собрали всё по порядку.",
                        grades: "Твой прогресс — понятный и без лишних таблиц.",
                        profile: "Всё, что учебная система знает о тебе.",
                        requests: "Решай вопросы с деканатом в своём ритме.",
                        notifications:
                          "Важные новости, изменения и напоминания.",
                      } as const
                    )[page]}
              </p>
            </div>
            {page === "home" && (
              <span className="date-stamp">
                <Icon name="calendar" />
                {dateLabel(today, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </span>
            )}
          </div>
          {page === "home" && (
            <>
              <section className="welcome-banner">
                <div>
                  <span className="eyebrow light">
                    БОЛЬШЕ ВРЕМЕНИ ДЛЯ ГЛАВНОГО
                  </span>
                  <h2>
                    Учёба в порядке.
                    <br />
                    <span>День — в твоих руках.</span>
                  </h2>
                  <p>
                    Посмотри план на неделю и освободи голову
                    <br className="desktop-only" /> для того, что действительно
                    интересно.
                  </p>
                  <a className="button banner-button" href="#schedule">
                    Моё расписание
                    <Icon name="arrow" size={18} />
                  </a>
                </div>
                <div className="banner-art" aria-hidden="true">
                  <div className="art-orbit" />
                  <div className="art-tile">
                    <Icon name="calendar" size={46} />
                    <span>ТВОЙ ПЛАН</span>
                    <b>{new Date(`${today}T12:00:00+03:00`).getUTCDate()}</b>
                  </div>
                  <span className="art-spark">
                    <Icon name="spark" size={48} />
                  </span>
                  <span className="art-check">
                    <Icon name="check" />
                  </span>
                </div>
              </section>
              <div className="quick-links">
                <a href="#schedule">
                  <span className="quick-icon sage">
                    <Icon name="calendar" />
                  </span>
                  <div>
                    <strong>Расписание</strong>
                    <span>Сегодня и на неделю</span>
                  </div>
                  <Icon name="chevron" size={18} />
                </a>
                <a href="#requests">
                  <span className="quick-icon peach">
                    <Icon name="document" />
                  </span>
                  <div>
                    <strong>Справки и заявки</strong>
                    <span>Без очереди в деканат</span>
                  </div>
                  <Icon name="chevron" size={18} />
                </a>
                <a href="#grades">
                  <span className="quick-icon lavender">
                    <Icon name="grades" />
                  </span>
                  <div>
                    <strong>Успеваемость</strong>
                    <span>Всё о твоём прогрессе</span>
                  </div>
                  <Icon name="chevron" size={18} />
                </a>
              </div>
              <div className="dashboard-grid">
                <Schedule api={api} sessionKey={sessionKey} compact />
                <div className="dashboard-side">
                  <Grades api={api} sessionKey={sessionKey} compact />
                  <section className="small-note">
                    <Icon name="spark" />
                    <h3>Ты больше, чем твои оценки.</h3>
                    <p>Оставь в расписании время и для себя.</p>
                    <a href="#grades">
                      Посмотреть результаты <Icon name="arrow" size={17} />
                    </a>
                  </section>
                </div>
              </div>
            </>
          )}
          {page === "schedule" && (
            <Schedule api={api} sessionKey={sessionKey} />
          )}
          {page === "grades" && <Grades api={api} sessionKey={sessionKey} />}
          {page === "profile" && (
            <>
              <ResourceState state={state} retry={retry} />
              {profile && <ProfilePanel profile={profile} />}
            </>
          )}
          {page === "requests" &&
            (RequestsPanel ? (
              <RequestsPanel
                api={api}
                sessionKey={sessionKey}
                onSubmitted={() => setNotificationsRevision((n) => n + 1)}
              />
            ) : (
              <PendingIntegration />
            ))}
          {page === "notifications" &&
            (NotificationsPanel ? (
              <NotificationsPanel
                api={api}
                sessionKey={sessionKey}
                refreshKey={notificationsRevision}
              />
            ) : (
              <PendingIntegration />
            ))}
        </main>
        <footer className="page-footer">
          <span>кампус · создано для студенческой жизни</span>
          <span>Конкурсный концепт · Все данные вымышлены</span>
        </footer>
      </div>
    </div>
  );
}
function PendingIntegration() {
  return (
    <section className="panel empty-state">
      <Icon name="document" size={32} />
      <h2>Раздел готовится к подключению</h2>
      <p>
        Он появится после интеграции модуля. Данные и заявки здесь пока не
        создаются.
      </p>
      <a className="button secondary" href="#home">
        На главную
      </a>
    </section>
  );
}
