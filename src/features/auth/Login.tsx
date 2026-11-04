import { useState, type FormEvent } from "react";
import type { Api } from "../../app/client.ts";
import { Icon } from "../../app/Icon.tsx";
import { ThemeToggle } from "../../app/ThemeToggle.tsx";

export function Login({ api, expired }: { api: Api | null; expired: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!api || pending) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setPending(true);
    setError("");
    try {
      await api.signIn(
        String(fields.get("email")).trim(),
        String(fields.get("password")),
      );
      form.reset();
    } catch {
      setError("Не удалось войти. Проверьте почту, пароль и соединение.");
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="login-layout">
      <header className="login-header"><a className="brand" href="#home"><span className="brand-mark">К</span>кампус</a><ThemeToggle /></header>
      <section className="login-story">
        <span className="eyebrow">Личный кабинет студента</span>
        <h1>Твоя учёба —<br />в одном месте</h1>
        <p>Расписание, результаты и связь с деканатом.<br />Открой кабинет и посмотри, что на сегодня.</p>
        <ul className="login-features">
          <li><Icon name="calendar" /><span>Пары и изменения в расписании</span></li>
          <li><Icon name="grades" /><span>Зачёты, экзамены и оценки</span></li>
          <li><Icon name="document" /><span>Справки и заявления онлайн</span></li>
        </ul>
        <p className="login-disclaimer">Конкурсный концепт · Не официальный сервис вуза</p>
      </section>
      <section className="login-form-area" aria-labelledby="login-heading">
        <div className="login-form-wrap">
          <span className="eyebrow">Кампус</span>
          <h2 id="login-heading">Вход в кабинет</h2>
          <p className="muted">Используй свой тестовый аккаунт</p>
          {expired && <div className="notice" role="status">Сессия завершена. Войдите снова, чтобы открыть свои данные.</div>}
          {!api && <div className="notice" role="alert">Вход пока недоступен: сервис готовится к подключению. Попробуйте позже.</div>}
          <form onSubmit={submit} className="login-form">
            <label htmlFor="email">Электронная почта</label>
            <input id="email" name="email" type="email" placeholder="student@example.test" autoComplete="username" required disabled={pending || !api} />
            <label htmlFor="password">Пароль</label>
            <div className="password-field">
              <input id="password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" required disabled={pending || !api} />
              <button type="button" aria-label={visible ? "Скрыть пароль" : "Показать пароль"} aria-pressed={visible} onClick={() => setVisible(v => !v)}>{visible ? "Скрыть" : "Показать"}</button>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button primary login-submit" disabled={pending || !api} aria-busy={pending}>{pending ? "Входим…" : "Войти в кабинет"}<Icon name="arrow" /></button>
          </form>
          <div className="login-help"><Icon name="user" /><p>Тестовые аккаунты выдаёт команда конкурса. Регистрация закрыта.</p></div>
          <p className="data-note">Все данные студентов и преподавателей вымышлены</p>
        </div>
      </section>
    </main>
  );
}
