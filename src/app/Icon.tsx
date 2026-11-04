import type { CSSProperties } from "react";

// Tabler SVGs (MIT) plus the project's original tuition-card in styles/icons.
const icons = import.meta.glob<string>("../styles/icons/*.svg", {
  eager: true, query: "?url", import: "default",
});
const names = {
  home: "home", calendar: "calendar", grades: "chart-bar",
  document: "file-description", bell: "bell", user: "user", payment: "tuition-card",
  arrow: "arrow-right", logout: "logout", check: "check", clock: "clock",
  pin: "map-pin", chevron: "chevron-right", sun: "sun", moon: "moon",
  menu: "menu-2", close: "x", school: "school", group: "stack-2", laptop: "device-laptop",
} as const;
export function Icon({ name, size = 20 }: { name: keyof typeof names; size?: number }) {
  return <span className="icon" aria-hidden="true" style={{
    width: size, height: size,
    "--icon-url": `url("${icons[`../styles/icons/${names[name]}.svg`]}")`,
  } as CSSProperties} />;
}
