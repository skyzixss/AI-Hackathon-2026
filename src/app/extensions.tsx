import type { ComponentType } from "react";
import type { Api } from "./client.ts";
import type { StudentRequest } from "../api/portal.ts";

// Optional modules owned by #5. Vite discovers them after that task is merged;
// this branch neither copies nor overwrites the other participant's components.
type RequestProps = {
  api: Api;
  sessionKey: string;
  onSubmitted?: (request: StudentRequest) => void;
};
type NotificationProps = {
  api: Api;
  sessionKey: string;
  refreshKey?: number;
  onUnreadChange?: (n: number) => void;
};
const modules = import.meta.glob<{
  RequestsPanel?: ComponentType<RequestProps>;
  NotificationsPanel?: ComponentType<NotificationProps>;
}>("../features/{requests,notifications}/*Panel.tsx", { eager: true });
export const RequestsPanel =
  modules["../features/requests/RequestsPanel.tsx"]?.RequestsPanel;
export const NotificationsPanel =
  modules["../features/notifications/NotificationsPanel.tsx"]
    ?.NotificationsPanel;
