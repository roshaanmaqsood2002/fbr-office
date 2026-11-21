import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalSize = "md" | "lg" | "xl";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  size?: ModalSize;
  onClose: () => void;
  children: ReactNode;
}

const sizes: Record<ModalSize, string> = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export default function Modal({
  open,
  title,
  description,
  size = "md",
  onClose,
  children,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const dialog = dialogRef.current;
    const focusable = () =>
      dialog?.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
    (focusable()?.[0] ?? dialog)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusable();
      if (!items?.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`my-auto flex max-h-[calc(100vh-1.5rem)] w-full ${sizes[size]} flex-col overflow-hidden rounded-2xl border border-fbr-border bg-white shadow-2xl outline-none sm:max-h-[calc(100vh-3rem)]`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-fbr-border px-5 py-4 sm:px-7 sm:py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="font-serif text-xl text-fbr-text sm:text-2xl">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-fbr-text-light">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-fbr-text-light hover:bg-fbr-bg hover:text-fbr-text"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto p-5 sm:p-7">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
