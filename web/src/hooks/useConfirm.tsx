import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "default";
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

interface DialogState extends ConfirmOptions {
  open: boolean;
  loading: boolean;
  resolve?: (value: boolean) => void;
}

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

const initialState: DialogState = {
  title: "Confirm",
  message: "Are you sure?",
  confirmText: "Confirm",
  cancelText: "Cancel",
  variant: "default",
  open: false,
  loading: false,
};

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [dialog, setDialog] = useState<DialogState>(initialState);
  const triggerRef = useRef<HTMLElement | null>(null);

  const closeDialog = useCallback((result: boolean) => {
    setDialog((prev) => {
      prev.resolve?.(result);
      return { ...initialState };
    });
    if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    triggerRef.current = document.activeElement as HTMLElement;
    return new Promise<boolean>((resolve) => {
      setDialog({
        ...initialState,
        ...options,
        confirmText: options.confirmText ?? (options.variant === "danger" ? "Delete" : "Confirm"),
        cancelText: options.cancelText ?? "Cancel",
        open: true,
        loading: false,
        resolve,
      });
    });
  }, []);

  const handleCancel = useCallback(() => {
    closeDialog(false);
  }, [closeDialog]);

  const handleConfirm = useCallback(() => {
    closeDialog(true);
  }, [closeDialog]);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={dialog.open}
        title={dialog.title}
        message={dialog.message}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        variant={dialog.variant}
        loading={dialog.loading}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context.confirm;
};
