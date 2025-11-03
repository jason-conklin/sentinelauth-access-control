interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal = ({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg border border-border-gold/70 bg-white p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-text-ink">{title}</h3>
        <p className="mt-3 text-sm text-text-ink/70">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center rounded-md border border-border-gold bg-white px-3 py-1.5 text-sm font-medium text-text-ink transition hover:bg-brand-200/40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center rounded-md border border-border-gold bg-brand-300 px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-brand-400"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
