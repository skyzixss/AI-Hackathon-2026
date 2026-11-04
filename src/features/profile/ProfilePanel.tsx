import type { Profile } from "../../api/portal.ts";
import { Icon } from "../../app/Icon.tsx";

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
}
export function ProfilePanel({ profile }: { profile: Profile }) {
  return (
    <section className="panel profile-panel" aria-labelledby="profile-title">
      <div className="profile-identity">
        <div className="avatar large">{initials(profile.full_name)}</div>
        <span className="eyebrow">ПРОФИЛЬ СТУДЕНТА</span>
        <h2 id="profile-title">{profile.full_name}</h2>
        <span className="pill">
          <Icon name="check" size={15} /> Учётная запись студента
        </span>
      </div>
      <dl className="profile-details">
        {[
          ["Факультет", profile.faculty],
          ["Направление", profile.program],
          ["Курс", String(profile.course)],
          ["Группа", profile.group_name],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="small muted">
        Данные предоставлены учебной системой. В этом концепте используются
        только вымышленные сведения.
      </p>
    </section>
  );
}
