const Footer = () => {
  return (
    <footer className="border-t border-border-gold/40 bg-white/90 px-6 py-3 text-xs text-text-ink/70 shadow-inner">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
        <span>SentinelAuth - Designed for resilient role-based security</span>
        <span>
          Developed by <strong className="font-semibold text-text-ink">Jason Conklin</strong> © 2025 
        </span>
      </div>
    </footer>
  );
};

export default Footer;
