import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";

/** "● Live · updated 2s ago" — shows the guardian that the counts are fresh without a reload. */
export function LiveIndicator({ updatedAt, stale }: { updatedAt: number; stale?: boolean }) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!updatedAt) return null;
  const secs = Math.max(0, Math.round((now - updatedAt) / 1000));
  const when = secs < 2 ? t("live.justNow") : t("live.secondsAgo", { n: secs });

  return (
    <p className={stale ? "live live--stale" : "live"}>
      <span className="live__dot" aria-hidden />
      <span>{t("live.label")}</span>
      <span className="live__sep" aria-hidden />
      <span>{t("live.updated", { time: when })}</span>
    </p>
  );
}
