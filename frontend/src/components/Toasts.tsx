import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { Link } from "react-router";
import { useI18n } from "../i18n/I18nProvider";

type Kind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: Kind;
  text: string;
  link?: { to: string; label: string };
}

interface ToastApi {
  show: (kind: Kind, text: string, link?: Toast["link"]) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const TTL_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const show = useCallback<ToastApi["show"]>((kind, text, link) => {
    seq.current += 1;
    const id = seq.current;
    // Same message twice in a row (e.g. double click) replaces instead of stacking.
    setToasts((all) => [...all.filter((t) => t.text !== text), { id, kind, text, link }].slice(-3));
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const { t } = useI18n();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), TTL_MS);
    return () => window.clearTimeout(timer);
  }, [paused, toast.id, onDismiss]);

  const Icon = toast.kind === "success" ? CircleCheck : toast.kind === "error" ? CircleAlert : Info;

  return (
    <motion.div
      layout
      className={`toast toast--${toast.kind}`}
      role={toast.kind === "error" ? "alert" : "status"}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon size={20} aria-hidden className="toast__icon" />
      <div className="toast__body">
        <p>{toast.text}</p>
        {toast.link && (
          <Link className="toast__link" to={toast.link.to} onClick={() => onDismiss(toast.id)}>
            {toast.link.label}
          </Link>
        )}
      </div>
      <button type="button" className="toast__close" onClick={() => onDismiss(toast.id)} aria-label={t("common.close")}>
        <X size={16} aria-hidden />
      </button>
    </motion.div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
