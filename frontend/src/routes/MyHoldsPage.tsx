import { Link } from "react-router";
import { motion } from "motion/react";
import { ChevronRight, ClipboardList, IdCard } from "lucide-react";
import { useMyHolds } from "../hooks/queries";
import { splitDuration, useCountdown } from "../hooks/useCountdown";
import type { HoldStatus, MyHold } from "../lib/api";
import { useStudent } from "../lib/student";
import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/messages";
import { Button } from "../components/Button";
import { StatusChip } from "../components/StatusChip";
import { LiveIndicator } from "../components/LiveIndicator";
import { EmptyState, ErrorPanel, SkeletonRows } from "../components/States";

const GROUPS: { key: MessageKey; statuses: HoldStatus[] }[] = [
  { key: "mine.active", statuses: ["HELD"] },
  { key: "mine.confirmed", statuses: ["CONFIRMED"] },
  { key: "mine.closed", statuses: ["EXPIRED", "CANCELLED"] },
];

export function MyHoldsPage() {
  const { t } = useI18n();
  const { studentId, focusIdentity } = useStudent();
  const mine = useMyHolds(studentId);

  return (
    <div className="container">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t("mine.title")}</h1>
          <p className="page-lead">{t("mine.lead")}</p>
        </div>
        {mine.data && <LiveIndicator updatedAt={mine.dataUpdatedAt} stale={mine.isError} />}
      </header>

      {!studentId ? (
        <EmptyState
          icon={<IdCard size={28} />}
          text={t("mine.needId")}
          action={<Button onClick={focusIdentity}>{t("mine.needIdAction")}</Button>}
        />
      ) : mine.isPending ? (
        <SkeletonRows count={2} />
      ) : mine.isError && !mine.data ? (
        <ErrorPanel error={mine.error} onRetry={() => mine.refetch()} />
      ) : mine.data.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={28} />}
          text={t("mine.empty")}
          action={
            <Link to="/classes" className="btn btn--primary">
              {t("mine.emptyAction")}
            </Link>
          }
        />
      ) : (
        GROUPS.map((group) => {
          const items = mine.data.filter((h) => group.statuses.includes(h.status));
          if (items.length === 0) return null;
          return (
            <section key={group.key} className="group" aria-labelledby={`g-${group.key}`}>
              <h2 id={`g-${group.key}`} className="group__title">
                {t(group.key)}
              </h2>
              <ul className="hold-list">
                {items.map((h, i) => (
                  <HoldRow key={h.holdId} hold={h} index={i} />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

function HoldRow({ hold, index }: { hold: MyHold; index: number }) {
  const { t, digits, dateTime } = useI18n();
  const remaining = useCountdown(hold.expiresAt, hold.status === "HELD");
  const status: HoldStatus = hold.status === "HELD" && remaining <= 0 ? "EXPIRED" : hold.status;
  const { minutes, seconds } = splitDuration(remaining);

  return (
    <motion.li
      className="hold-row"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
    >
      <Link to={`/holds/${hold.holdId}`} className="hold-row__link">
        <div className="hold-row__main">
          <span className="hold-row__name">{hold.className}</span>
          <span className="hold-row__meta">
            {hold.createdAt ? t("mine.appliedAt", { time: dateTime(hold.createdAt) }) : hold.holdId}
          </span>
        </div>
        {status === "HELD" && (
          <span className="hold-row__timer" aria-label={t("hold.minutesLeft", { n: minutes })}>
            {digits(`${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`)}
          </span>
        )}
        <StatusChip status={status} />
        <ChevronRight size={18} className="hold-row__chev" aria-hidden />
        <span className="sr-only">{t("mine.open")}</span>
      </Link>
    </motion.li>
  );
}
