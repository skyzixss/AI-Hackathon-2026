# Разработка и проверки серверной основы

Node.js 24 (см. .nvmrc). После клонирования: `npm ci`.

- `npm run check` — TypeScript.
- `npm test` — проверка конфигурации клиента и валидации записи.
- `npm run test:live` — реальные Auth/REST проверки двух демо-студентов.
  Читает ignored .env и work/demo-credentials.json; создаёт две тестовые заявки
  и уведомления, завершает сессии этих студентов. Только выделенный демо-проект.
  Ключи, пароли и токены в отчёт не выводятся.
- `npm run test:db` — изолированный PostgreSQL-кластер, 66 проверок RLS.
  Нужны Python 3 и PostgreSQL 17+ с initdb/pg_ctl в PATH. Скрипт создаёт
  кластер внутри ignored work/ и останавливает/удаляет его после проверки.
  Он не подключается к существующей БД и не требует Docker.

На Windows этот тест запускайте в WSL с установленными PostgreSQL/Python/Node.
Полный локальный Supabase требует Docker: `npx supabase start`,
затем `npx supabase db reset` (только локальный проект; удаляет его локальные данные).
В этом запуске полный стек Docker не проверен, Docker daemon недоступен.

## Облачный проект

`student-portal-hackathon`, project ref `jbzaqvutbybrhjctrexc`.
Миграция portal_foundation применена. Её версия в Git синхронизирована
с supabase_migrations.schema_migrations: 20261104103450.
Не применять SQL повторно вручную; последующие изменения — отдельные миграции.
RLS smoke-тест в облаке прошёл с откатом всех временных данных.
Security advisor: замечаний нет на момент подготовки основы.

Тесты локально подменяют только auth.uid() и таблицу пользователей:
исполняются настоящие права и политики PostgreSQL. Это не проверка
паролей Supabase Auth или HTTP проверки JWT в PostgREST.

## Демо-аккаунты

1. В отдельном демо-проекте отключить публичную регистрацию в Auth settings,
   установить JWT lifetime 300 секунд. Проверить фактическую конфигурацию.
2. Скопировать .env.example в .env, заполнить SUPABASE_URL и SUPABASE_SECRET_KEY
   из dashboard владельца. Для браузера — VITE_SUPABASE_URL и отдельный
   VITE_SUPABASE_PUBLISHABLE_KEY. Значения не коммитить.
3. Добавить PORTAL_ALLOW_DEMO_SEED=yes в .env и выполнить `npm run seed:demo`.
4. Скрипт создаёт student-a@example.test и student-b@example.test, случайные
   пароли и разные данные. Пароли сохраняются только в work/demo-credentials.json.
   Не публиковать этот файл в Issues/PR. Существующих пользователей не заменяет.
   При частичном сбое сначала проверить созданные аккаунты, не перезапускать вслепую.
5. Выполнить `npm run test:live`: signIn A/B, прямой REST доступ в обе стороны,
   запрет анонимного чтения, owner/status, выход и отзыв refresh-токена,
   повторный вход и сохранение заявки. 04.11.2026 все 55 проверок прошли.
   Браузерную интеграцию с готовым UI ещё нужно проверить.

## Сайт

Интерфейс Artem545111 и модули PUPSIK359 объединены для интеграции.
`npm run dev` — Vite, `npm run build` — production сборка, `npm run preview` —
просмотр сборки. Используются только VITE_SUPABASE_URL и
VITE_SUPABASE_PUBLISHABLE_KEY из локальной .env; не добавлять VITE_ к secret key.

Общий `npm test` запускает 12 unit-тестов, включая даты, ошибки доступа и
модель заявок. Live-браузерные проверки и снимки — [integration.md](integration.md).
`npx wrangler deploy --dry-run` прошёл; реальное размещение не выполнялось.

## Сохранённая облачная конфигурация Auth

В облаке проверены: регистрация запрещена, email/password вход включён,
JWT 300 секунд, пароль минимум 12 символов. В CLI v3 `auth.email.enable_signup`
устарело и означает отключение email-провайдера; используется `auth.email.enabled=true`.
Публичную регистрацию запрещает `auth.enable_signup=false`.

Для точечного повторения настроек без сброса других параметров:

```sh
npx supabase config diff --remote=jbzaqvutbybrhjctrexc --workdir config/cloud-auth --agent no --output-format text
npx supabase config push --remote=jbzaqvutbybrhjctrexc --workdir config/cloud-auth --agent no --output-format text
```

Используйте только этот ограниченный config для облачной настройки;
не отправляйте полный локальный supabase/config.toml вслепую. CLI оставляет
необъявленные параметры неизменными. При проверке осталось 0 update и
11 remote-only различий; это параметры, которые мы намеренно не меняем.
Локальный CLI авторизован владельцем. Отчёт прогона — ignored work/live-auth-results.json.

После настройки Auth Security Advisor сообщает одно предупреждение:
проверка утёкших паролей отключена. Она доступна только на Pro и выше
([документация](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).
В согласованном Free-демо регистрация закрыта, два пароля случайные;
платный тариф не включался. Это ограничение демо, а не заявление о полной
готовности к работе с реальными данными.

Усиление live-проверки после review PR #8: уведомление должно иметь новый ID
относительно снимка перед созданием заявки и принадлежать текущему студенту.
Перед выходом проверяется успешное обновление сессии; затем актуальный
refresh-токен должен получить HTTP 400 и error_code refresh_token_not_found
или session_not_found. Rate limit и ошибки сервера проваливают проверку.
Неуспешный прогон перезаписывает локальный отчёт как passed=false.

## Автоматические проверки GitHub

`.github/workflows/backend-checks.yml` запускает TypeScript, клиентские тесты, сборку
и те же 66 проверок RLS на новом PostgreSQL 17 в изолированной сети задания.
Работает на pull_request и push в main; максимум 10 минут. Секреты Supabase,
локальная .env и облачная база не используются. Docker-сервис удаляется
вместе с заданием; наружу порт не опубликован. Реальный Auth/REST тест
не включён в CI: он меняет демо-данные и завершает сессии.
