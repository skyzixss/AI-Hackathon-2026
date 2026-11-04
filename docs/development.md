# Разработка и проверки серверной основы

Node.js 24 (см. .nvmrc). После клонирования: `npm ci`.

- `npm run check` — TypeScript.
- `npm test` — проверка конфигурации клиента и валидации записи.
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
5. Выполнить реальный signIn для A/B, проверить прямой REST доступ в обе стороны,
   выход, смену аккаунта и сохранение заявки. Пока этот этап не выполнен.

## Сайт

Интерфейс и Vite entry создаёт Artem545111 (#6). React/Vite зависимости
уже установлены. Рабочих команд dev/build пока нет — добавить в той же задаче,
обычно `vite` и `vite build`. После появления dist/ проверить
`npx wrangler deploy --dry-run`, затем отдельно разместить сайт.
Хостинг подготовлен конфигурацией wrangler.jsonc, но публичной ссылки пока нет.
