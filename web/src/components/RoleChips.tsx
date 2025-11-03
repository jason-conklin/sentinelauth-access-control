interface RoleChipsProps {
  roles: string[];
}

const ROLE_STYLES: Record<string, string> = {
  admin: "border-yellow-300 bg-yellow-200/40 text-yellow-900",
  moderator: "border-amber-300 bg-amber-200/40 text-amber-900",
  user: "border-stone-300 bg-stone-200/40 text-stone-900",
};

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const RoleChips = ({ roles }: RoleChipsProps) => {
  if (!roles || roles.length === 0) {
    return <span className="text-xs text-text-ink/60">{"\u2014"}</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {roles.map((role) => (
        <span
          key={role}
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
            ROLE_STYLES[role] ?? "border-stone-300 bg-stone-200/40 text-stone-900"
          }`}
        >
          {titleCase(role)}
        </span>
      ))}
    </div>
  );
};

export default RoleChips;
