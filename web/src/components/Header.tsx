interface HeaderProps {
  roleLabel?: string | null;
  currentUserEmail?: string | null;
  navItems: { key: string; label: string }[];
  activeNav: string;
  onNavSelect: (key: string) => void;
  onLogout: () => void;
  isAuthenticated: boolean;
}

const Header = ({
  roleLabel,
  currentUserEmail,
  navItems,
  activeNav,
  onNavSelect,
  onLogout,
  isAuthenticated,
}: HeaderProps) => {
  return (
    <header className="bg-gradient-to-r from-grad-left to-grad-right shadow-soft">
      <div className="flex items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-center gap-3">
          <img src="/sentinelauth_logo.png" alt="SentinelAuth" className="h-8 w-auto" />
          {roleLabel && (
            <span className="ml-2 inline-flex items-center rounded-md border border-border-gold bg-brand-200 px-2 py-0.5 text-xs font-medium text-text-ink">
              {roleLabel}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {isAuthenticated && (
            <nav className="flex flex-wrap items-center gap-3">
              {navItems.map((item) => {
                const isActive = item.key === activeNav;
                const baseClasses =
                  "relative px-3 py-1.5 text-sm font-medium text-text-ink/80 transition-colors hover:text-text-ink focus:outline-none";
                const activeClasses = isActive
                  ? "text-text-ink after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:bg-brand after:content-['']"
                  : "";
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`${baseClasses} ${activeClasses}`}
                    onClick={() => onNavSelect(item.key)}
                  >
                    {item.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={onLogout}
                className="relative px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:text-red-700 focus:outline-none"
              >
                Logout
              </button>
            </nav>
          )}
          {currentUserEmail && (
            <span className="text-sm text-text-ink/70">Signed in as {currentUserEmail}</span>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
