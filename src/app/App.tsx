import { useMoscowDay } from "../features/studies/useMoscowDay.ts";
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
import { ThemeToggle } from "./ThemeToggle.tsx";
import { Dashboard } from "./Dashboard.tsx";
import { Tuition } from "../features/payments/Tuition.tsx";
import type { TuitionApi } from "../features/payments/api.ts";

const navigation = [
  { id: "home", title: "Главная", icon: "home" },
  { id: "schedule", title: "Расписание", icon: "calendar" },
  { id: "grades", title: "Успеваемость", icon: "grades" },
  { id: "requests", title: "Справки и заявки", icon: "document" },
  { id: "notifications", title: "Уведомления", icon: "bell" },
  { id: "payments", title: "Оплата обучения", icon: "payment" },
] as const;
const pages = [...navigation, { id: "profile", title: "Мой профиль" }] as const;
type Page = (typeof pages)[number]["id"];
function currentPage(): Page {
  const hash = window.location.hash.slice(1);
  return pages.find((item) => item.id === hash)?.id ?? "home";
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
        <span className="brand-mark">К</span>
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
        <span className="brand-mark">К</span>
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
      tuitionApi={connection.tuitionApi}
      sessionKey={auth.session.user.id}
      onSignOut={signOut}
    />
  );
}

function StudentPortal({ api, tuitionApi, sessionKey, onSignOut }: {
  api: Api; tuitionApi: TuitionApi; sessionKey: string; onSignOut: () => void;
}) {
  const [page, setPage] = useState<Page>(currentPage);
  const [notificationsRevision, setNotificationsRevision] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const load = useCallback(async () => {
    const profile = await api.profile();
    if (profile.student_id !== sessionKey) throw new Error("Profile mismatch");
    return profile;
  }, [api, sessionKey]);
  const { state, retry } = useResource(sessionKey + ":profile", load);
  useEffect(() => {
    const change = () => setPage(currentPage());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [page]);
  useEffect(() => {
    if (menuOpen) {
      menu.current?.showModal();
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = previous; };
    }
    menu.current?.close();
  }, [menuOpen]);
  const closeMenu = () => { menu.current?.close(); setMenuOpen(false); };
  const active = pages.find((item) => item.id === page)!;
  const profile = state.status === "ready" ? state.data : null;
  const today = useMoscowDay();
  const firstName = profile?.full_name.trim().split(/\s+/)[0];
  const identity = <>
    <span className="avatar">{profile ? initials(profile.full_name) : "·"}</span>
    <span><strong>{profile?.full_name ?? "Личный кабинет"}</strong>
      <small>{profile ? profile.group_name + " · " + profile.course + " курс" : "Загружаем профиль…"}</small>
    </span>
  </>;
  const nav = (mobile = false) => <nav aria-label={mobile ? "Мобильная навигация" : "Основная навигация"}>
    {navigation.map(item => <a key={item.id} href={"#" + item.id}
      onClick={mobile ? closeMenu : undefined} aria-current={page === item.id ? "page" : undefined}>
      <Icon name={item.icon} /><span>{item.title}</span>
    </a>)}
  </nav>;
  return <div className="portal-layout">
    <a className="skip-link" href="#main-content" onClick={event => {
      event.preventDefault(); document.getElementById("main-content")?.focus();
    }}>К содержимому</a>
    <aside className="sidebar">
      <a className="brand" href="#home"><span className="brand-mark">К</span>кампус</a>
      {nav()}
      <div className="sidebar-bottom">
        <a className="student-identity" href="#profile" aria-label="Мой профиль" aria-current={page === "profile" ? "page" : undefined}>{identity}</a>
        <button className="logout" onClick={onSignOut}><Icon name="logout" />Выйти из кабинета</button>
      </div>
    </aside>
    <dialog ref={menu} className="mobile-dialog" aria-label="Меню кабинета"
      onCancel={event => { event.preventDefault(); closeMenu(); }}
      onClick={event => { if (event.target === event.currentTarget) closeMenu(); }}>
      <div className="mobile-dialog-body">
        <div className="mobile-dialog-heading"><a className="brand" href="#home" onClick={closeMenu}>
          <span className="brand-mark">К</span>кампус</a>
          <button className="icon-button" aria-label="Закрыть меню" onClick={closeMenu}><Icon name="close" /></button>
        </div>
        {nav(true)}
        <a className="student-identity" href="#profile" aria-label="Мой профиль" aria-current={page === "profile" ? "page" : undefined} onClick={closeMenu}>{identity}</a>
        <button className="logout" onClick={() => { closeMenu(); onSignOut(); }}><Icon name="logout" />Выйти из кабинета</button>
        <p className="small muted">Конкурсный концепт · Не официальный сервис вуза</p>
      </div>
    </dialog>
    <div className="workspace">
      <header className="topbar">
        <div className="page-heading">
          <p className="today-label">{dateLabel(today, { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 ref={heading} tabIndex={-1}>{page === "home" ? (firstName ? `Привет, ${firstName}. Твой учебный день` : "Твой учебный день") : active.title}</h1>
        </div>
        <div className="topbar-right">
          <ThemeToggle />
          <a className="icon-button" href="#notifications" aria-label="Открыть уведомления"><Icon name="bell" /></a>
          <a className="avatar topbar-avatar" href="#profile" aria-label="Открыть профиль">{profile ? initials(profile.full_name) : "·"}</a>
          <button className="icon-button menu-button" aria-label="Открыть меню" aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}><Icon name="menu" /></button>
        </div>
      </header>
      <main id="main-content" className="main-content" tabIndex={-1}>
        <div className="route-content" key={page}>
          {page === "home" && <Dashboard api={api} sessionKey={sessionKey} profileState={state} retryProfile={retry} />}
          {page === "schedule" && <Schedule api={api} sessionKey={sessionKey} />}
          {page === "grades" && <Grades api={api} sessionKey={sessionKey} />}
          {page === "payments" && <Tuition api={tuitionApi} sessionKey={sessionKey} />}
          {page === "profile" && <><ResourceState state={state} retry={retry} />{profile && <ProfilePanel profile={profile} />}</>}
          {page === "requests" && (RequestsPanel ? <RequestsPanel api={api} sessionKey={sessionKey}
            onSubmitted={() => setNotificationsRevision(n => n + 1)} /> : <PendingIntegration />)}
          {page === "notifications" && (NotificationsPanel ? <NotificationsPanel api={api} sessionKey={sessionKey}
            refreshKey={notificationsRevision} /> : <PendingIntegration />)}
        </div>
      </main>
      <footer className="page-footer">Конкурсный концепт<span aria-hidden="true">·</span>Не официальный сервис вуза<span aria-hidden="true">·</span>Все данные вымышлены</footer>
    </div>
  </div>;
}
function PendingIntegration() {
  return <section className="panel empty-state"><Icon name="document" size={32} />
    <h2>Раздел готовится к подключению</h2>
    <p>Он появится после интеграции модуля. Данные и заявки здесь пока не создаются.</p>
    <a className="button secondary" href="#home">На главную</a>
  </section>;
}
