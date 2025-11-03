import { useEffect, useMemo, useState } from "react";
import {
  FloatingPortal,
  offset,
  flip,
  shift,
  size,
  useFloating,
  autoUpdate,
} from "@floating-ui/react";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "moderator", label: "Moderator" },
  { value: "user", label: "User" },
];

interface RoleMultiSelectProps {
  value: string[];
  onChange: (roles: string[]) => void;
  disabled?: boolean;
}

const RoleMultiSelect = ({ value, onChange, disabled = false }: RoleMultiSelectProps) => {
  const selectedRoles = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    placement: "bottom-start",
    strategy: "fixed",
    open,
    onOpenChange: setOpen,
    middleware: [
      offset(6),
      flip(),
      shift({ padding: 8 }),
      size({
        apply({ availableHeight, rects, elements }) {
          const floatingEl = elements.floating;
          if (!floatingEl) return;
          Object.assign(floatingEl.style, {
            maxHeight: `${Math.min(availableHeight ?? 280, 280)}px`,
            width: `${rects.reference.width}px`,
          });
        },
      }),
    ],
  });

  const toggleRole = (role: string) => {
    if (disabled) return;
    const current = Array.isArray(value) ? value : [];
    if (role === "user") {
      // user role is required
      onChange(Array.from(new Set([...current, "user"])));
      return;
    }
    if (current.includes(role)) {
      onChange(current.filter((item) => item !== role));
    } else {
      onChange([...current, role]);
    }
  };

  const displayValue =
    selectedRoles.length > 0
      ? ROLE_OPTIONS.filter((option) => selectedRoles.includes(option.value))
          .map((option) => option.label)
          .join(", ")
      : "Select roles";

  useEffect(() => {
    if (!open) return;

    const referenceEl = refs.reference.current;
    const floatingEl = refs.floating.current;
    if (!referenceEl || !floatingEl) {
      return;
    }

    const cleanup = autoUpdate(referenceEl, floatingEl, context.update);

    const handleClick = (event: MouseEvent) => {
      const refEl = refs.reference.current;
      const floatEl = refs.floating.current;
      if (!refEl || !floatEl) return;
      if (!refEl.contains(event.target as Node) && !floatEl.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
      cleanup();
    };
  }, [open, refs.reference, refs.floating, context.update]);

  return (
    <div className="inline-block text-left">
      <button
        type="button"
        disabled={disabled}
        ref={refs.setReference}
        className="inline-flex items-center rounded-md border border-border-gold bg-white px-3 py-1.5 text-xs font-medium text-text-ink/80 shadow-sm transition hover:bg-brand-200/40 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => setOpen((prev) => !prev)}
      >
        {displayValue}
      </button>
      {open && !disabled && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="z-[9999] max-w-[240px] overflow-auto rounded-lg border border-yellow-300 bg-bg-base shadow-lg"
          >
            <div className="p-3">
              <div className="space-y-2">
                {ROLE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 text-xs font-medium text-text-ink/80"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(option.value)}
                      onChange={() => toggleRole(option.value)}
                      disabled={disabled || option.value === "user"}
                      className="accent-brand"
                    />
                    <span>{option.label}</span>
                    {option.value === "user" && (
                      <span className="text-[10px] text-text-ink/50">(required)</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
};

export default RoleMultiSelect;
