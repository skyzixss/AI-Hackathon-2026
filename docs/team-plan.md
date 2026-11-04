# Задачи команды

Распределено пользователем через поручение ассистенту 04.11.2026.
Общие решения: React + TypeScript + Vite, Supabase Auth/PostgreSQL Free,
Cloudflare Workers Static Assets Free. Только вымышленные данные.

| Участник | Задача | Проверяющий | Issue |
| --- | --- | --- | --- |
| skyzixss (Антон) | Сервер, Auth, схема/RLS, SDK, демо-аккаунты, инфраструктура и проверки доступа | Artem545111 | [#4](https://github.com/skyzixss/AI-Hackathon-2026/issues/4) |
| Artem545111 | Shell/навигация, вход/выход, профиль, расписание, успеваемость, общие стили | PUPSIK359 | [#6](https://github.com/skyzixss/AI-Hackathon-2026/issues/6) |
| PUPSIK359 | Формы/список заявок, уведомления, сценарий демонстрации | skyzixss | [#5](https://github.com/skyzixss/AI-Hackathon-2026/issues/5) |

## Файлы и ветки

- skyzixss: `feat/skyzixss-auth-data`; supabase/, src/api/, src/lib/, scripts/,
  tests/, общие package.json/lock, tsconfig, wrangler.jsonc и документация стека.
- Artem545111: `feat/artem-student-ui`; src/app/, src/features/auth/,
  src/features/profile/, src/features/studies/, src/styles/, index.html, vite.config.ts.
- PUPSIK359: `feat/pupsik-requests`; src/features/requests/,
  src/features/notifications/, docs/demo.md. Точки в навигации согласует с Артёмом.

Корневые зависимости меняет skyzixss после согласования потребностей.
Не менять общие API/SQL параллельно без согласования в Issue.

## Порядок старта

1. Прочитать свой Issue, [architecture.md](architecture.md),
   [api-contract.md](api-contract.md), [agent-setup.md](agent-setup.md).
2. Просмотреть PR основы `feat/skyzixss-auth-data`, согласовать контракт.
   До его merge использовать эту базу только по согласованию; не копировать
   SDK и миграции вручную в конкурирующие реализации.
3. После объединения основы обновить main и создать свою ветку.
4. Делать UI через portalApi; без подмены серверных данных моками в итоговом демо.
5. Один небольшой PR на задачу, проверки и передача в Issue; не включать auto-merge.

На старте серверная основа реализуется, остальные задачи ждут review контракта.
Текущий статус работ вести в Issues, а не в постоянно устаревающей таблице файлов.
