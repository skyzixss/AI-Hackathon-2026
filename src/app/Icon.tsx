type Name =
  | "home"
  | "calendar"
  | "grades"
  | "document"
  | "bell"
  | "user"
  | "arrow"
  | "logout"
  | "check"
  | "clock"
  | "pin"
  | "chevron"
  | "spark";
const paths: Record<Name, string> = {
  home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
  calendar:
    "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2M7 14h2m6 0h2m-10 4h2",
  grades: "M4 20h16M6 16v-4m6 4V5m6 11V9",
  document: "M14 3H5v18h14V8zm0 0v5h5M8 12h8m-8 4h6",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  user: "M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  logout: "M10 4H4v16h6m5-12 4 4-4 4m-7-4h12",
  check: "m5 12 4 4L19 6",
  clock: "M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  chevron: "m9 5 7 7-7 7",
  spark: "m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8z",
};
export function Icon({ name, size = 22 }: { name: Name; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
