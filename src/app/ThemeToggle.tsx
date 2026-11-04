import { useSyncExternalStore } from "react";
import { Icon } from "./Icon.tsx";
import { THEME_KEY, type Theme } from "./theme.ts";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0d1119" : "#f4f6f9");
  window.dispatchEvent(new Event("campus-theme-change"));
}
function subscribe(update: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === THEME_KEY && (event.newValue === "dark" || event.newValue === "light")) applyTheme(event.newValue);
  };
  window.addEventListener("campus-theme-change", update);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener("campus-theme-change", update);
    window.removeEventListener("storage", storage);
  };
}
const snapshot = (): Theme => document.documentElement.dataset.theme === "light" ? "light" : "dark";
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, snapshot);
  const label = theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему";
  return <button className="icon-button theme-toggle" aria-label={label} title={label} onClick={() => {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* The switch works when storage is unavailable. */ }
  }}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>;
}
