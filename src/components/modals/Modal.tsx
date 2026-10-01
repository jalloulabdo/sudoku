import { AnimatePresence, m } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ModalProps {
  open: boolean;
  title: string;
  /** Escape, backdrop click and the close button call this. Omit to make the dialog non-dismissible. */
  onClose?: () => void;
  icon?: ReactNode;
  children: ReactNode;
}

export function Modal({ open, title, onClose, icon, children }: ModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    // Focus the first control (skipping the close button) so keyboard users land inside.
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus], button:not([data-close]), select, input');
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
      }
      if (e.key !== 'Tab' || !panel.current) return;
      // Keep Tab inside the dialog.
      const items = [...panel.current.querySelectorAll<HTMLElement>('button, select, input, a[href]')].filter(
        (el) => !el.hasAttribute('disabled'),
      );
      if (items.length === 0) return;
      const [head, tail] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <m.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-surface p-6 text-fg shadow-2xl"
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            {onClose && (
              <button
                type="button"
                data-close
                onClick={onClose}
                aria-label={t('common.close')}
                className="absolute end-3 top-3 flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-2"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            )}
            {icon && <div className="mb-3 flex justify-center">{icon}</div>}
            <h2 id={titleId} className="pe-10 text-xl font-semibold">
              {title}
            </h2>
            <div className="mt-3">{children}</div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

export function ModalButton(props: {
  onClick: () => void;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const style =
    props.variant === 'primary'
      ? 'bg-accent text-accent-fg'
      : props.variant === 'danger'
        ? 'bg-cell-conflict text-error'
        : 'bg-surface-2 text-fg hover:bg-cell-peer';
  return (
    <button type="button" onClick={props.onClick} className={`min-h-12 w-full rounded-xl px-4 font-medium ${style}`}>
      {props.children}
    </button>
  );
}
