import { useState, type FormEvent } from "react";
import type { Api } from "../../app/client.ts";
import { Icon } from "../../app/Icon.tsx";

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
      <section className="login-story">
        <a className="brand" href="#">
          <span className="brand-mark">к.</span>кампус
          <span className="brand-dot" />
        </a>
        <div className="login-copy">
          <span className="eyebrow light">ТВОЯ УЧЁБА. ТВОЙ РИТМ.</span>
          <h1>
            Меньше суеты.
            <br />
            Больше студенческой
            <br />
            <em>жизни.</em>
          </h1>
          <p>
            Расписание, оценки и дела с деканатом —<br />
            теперь в одном месте.
          </p>
        </div>
        <div className="campus-illustration" aria-hidden="true">
          <div className="orbit" />
          <div className="orbit second" />
          <div className="illustration-card">
            <Icon name="calendar" size={32} />
            <span>Всё складывается</span>
            <strong>в твою пользу.</strong>
            <div className="illustration-lines">
              <i />
              <i />
              <i />
            </div>
          </div>
          <span className="floating-spark">
            <Icon name="spark" size={40} />
          </span>
          <span className="floating-note">
            <Icon name="check" /> Дела под контролем
          </span>
        </div>
        <p className="login-disclaimer">
          Конкурсный концепт · Не официальный сервис вуза
        </p>
      </section>
      <section className="login-form-area">
        <div className="login-form-wrap">
          <span className="eyebrow">ЛИЧНЫЙ КАБИНЕТ СТУДЕНТА</span>
          <h2>
            С возвращением<span className="accent">.</span>
          </h2>
          <p className="muted">Войди, чтобы продолжить свой день.</p>
          {expired && (
            <div className="notice" role="status">
              Сессия завершена. Войдите снова, чтобы открыть свои данные.
            </div>
          )}
          {!api && (
            <div className="notice" role="alert">
              Вход пока недоступен: сервис готовится к подключению. Попробуйте
              позже.
            </div>
          )}
          <form onSubmit={submit} className="login-form">
            <label htmlFor="email">Электронная почта</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="student@example.test"
              autoComplete="username"
              required
              disabled={pending || !api}
            />
            <label htmlFor="password">Пароль</label>
            <div className="password-field">
              <input
                id="password"
                name="password"
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                required
                disabled={pending || !api}
              />
              <button
                type="button"
                aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
                aria-pressed={visible}
                onClick={() => setVisible((v) => !v)}
              >
                {visible ? "Скрыть" : "Показать"}
              </button>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button primary login-submit"
              disabled={pending || !api}
              aria-busy={pending}
            >
              {pending ? "Входим…" : "Войти в кабинет"}
              <Icon name="arrow" />
            </button>
          </form>
          <div className="login-help">
            <Icon name="user" />
            <p>
              Для знакомства с концептом используй тестовый аккаунт, выданный
              командой конкурса. Регистрация закрыта.
            </p>
          </div>
          <p className="data-note">
            Все данные студентов и преподавателей вымышлены.
          </p>
        </div>
      </section>
    </main>
  );
}
