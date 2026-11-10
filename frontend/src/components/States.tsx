import { Component, type ErrorInfo, type ReactNode } from "react";
import { CircleAlert, RotateCw } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { Button } from "./Button";

/** An empty screen is an invitation to act: one sentence, one action. */
export function EmptyState({ icon, text, action }: { icon: ReactNode; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty__icon" aria-hidden>
        {icon}
      </span>
      <p className="empty__text">{text}</p>
      {action}
    </div>
  );
}

export function ErrorPanel({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t, errorText } = useI18n();
  return (
    <div className="error-panel" role="alert">
      <CircleAlert size={22} aria-hidden />
      <p>{errorText(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={<RotateCw size={16} aria-hidden />} onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-list" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-row">
          <span className="skeleton skeleton--title" />
          <span className="skeleton skeleton--bar" />
        </div>
      ))}
    </div>
  );
}

function CrashFallback() {
  const { t } = useI18n();
  return (
    <div className="error-panel error-panel--page" role="alert">
      <CircleAlert size={24} aria-hidden />
      <div>
        <h2>{t("crash.title")}</h2>
        <p>{t("crash.body")}</p>
      </div>
      <Button variant="secondary" onClick={() => window.location.reload()}>
        {t("crash.reload")}
      </Button>
    </div>
  );
}

/** A render crash shows a recoverable panel instead of a blank page (PDF §1.5 UI). */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI error", error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    return this.state.failed ? <CrashFallback /> : this.props.children;
  }
}
