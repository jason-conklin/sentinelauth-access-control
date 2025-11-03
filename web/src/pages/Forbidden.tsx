interface ForbiddenProps {
  onNavigateProfile: () => void;
}

const Forbidden = ({ onNavigateProfile }: ForbiddenProps) => {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-border-gold/60 bg-white p-8 text-center shadow-soft">
      <h2 className="text-xl font-semibold text-text-ink">Access restricted</h2>
      <p className="mt-3 text-sm text-text-ink/70">
        You don’t have permission to view this page.
      </p>
      <button
        type="button"
        onClick={onNavigateProfile}
        className="mt-6 inline-flex items-center rounded-md border border-border-gold bg-brand-200 px-4 py-2 text-sm font-medium text-text-ink transition-colors hover:bg-brand-300"
      >
        Go to Profile
      </button>
    </div>
  );
};

export default Forbidden;
