import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CircleCheck, CircleX, Hourglass, ShieldAlert } from "lucide-react";
import { qk, useCancel, useConfirm, useHold, useMyHolds } from "../hooks/queries";
import { splitDuration, useCountdown } from "../hooks/useCountdown";
import { ApiError, type Hold, type HoldStatus } from "../lib/api";
import { useStudent } from "../lib/student";
import { maskStudentId } from "../lib/studentId";
import { useI18n } from "../i18n/I18nProvider";
import { useToast } from "../components/Toasts";
import { Button } from "../components/Button";
import { StatusChip } from "../components/StatusChip";
import { EmptyState, ErrorPanel } from "../components/States";
import { TiltCard } from "../components/TiltCard";

const DEFAULT_DURATION_MS = 600_000;

export function HoldPage() {
  const { holdId = "" } = useParams();
  const { t } = useI18n();
  const hold = useHold(holdId);

  if (hold.isPending) {
    return (
      <div className="container container--ticket">
        <div className="ticket ticket--loading" aria-busy>
          <span className="skeleton skeleton--title" />
          <span className="skeleton skeleton--count" />
        </div>
      </div>
    );
  }

  if (hold.isError && !hold.data) {
    if (hold.error instanceof ApiError && hold.error.status === 404) {
      return (
        <div className="container container--ticket">
          <EmptyState
            icon={<ShieldAlert size={28} />}
            text={t("hold.notFound")}
            action={
              <Link to="/me" className="btn btn--secondary">
                <ArrowLeft size={18} aria-hidden />
                <span>{t("hold.backToMine")}</span>
              </Link>
            }
          />
        </div>
      );
    }
    return (
      <div className="container container--ticket">
        <ErrorPanel error={hold.error} onRetry={() => hold.refetch()} />
      </div>
    );
  }

  return <HoldTicket hold={hold.data} />;
}

function HoldTicket({ hold }: { hold: Hold }) {
  const { t, digits, time } = useI18n();
  const { studentId } = useStudent();
  const mine = useMyHolds(studentId);
  const qc = useQueryClient();

  const serverStatus = hold.status;
  const remaining = useCountdown(hold.expiresAt, serverStatus === "HELD");

  // PDF §1.5 UI: when time is up, show EXPIRED and disable "ভর্তি ফি দিন" without a reload.
  const status: HoldStatus = serverStatus === "HELD" && remaining <= 0 ? "EXPIRED" : serverStatus;

  const isMine = !!studentId && !!mine.data?.some((h) => h.holdId === hold.holdId);
  const ownershipKnown = !studentId || mine.isSuccess;

  // The instant the clock hits zero, ask the server too (seat counts change everywhere).
  const flipped = useRef(false);
  useEffect(() => {
    if (status === "EXPIRED" && serverStatus === "HELD" && !flipped.current) {
      flipped.current = true;
      void qc.invalidateQueries({ queryKey: qk.hold(hold.holdId) });
      void qc.invalidateQueries({ queryKey: ["classes"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
    }
  }, [status, serverStatus, qc, hold.holdId]);

  const className = hold.className ?? mine.data?.find((h) => h.holdId === hold.holdId)?.className ?? "";

  return (
    <div className="container container--ticket">
      <Link to="/me" className="back-link">
        <ArrowLeft size={16} aria-hidden />
        {t("nav.mine")}
      </Link>

      <TiltCard className={`ticket ticket--${status.toLowerCase()}`} aria-labelledby="ticket-title">
        <header className="ticket__head">
          <div>
            <p className="ticket__kicker">{t("hold.title")}</p>
            <h1 id="ticket-title" className="ticket__title">
              {className}
            </h1>
          </div>
          <StatusChip status={status} />
        </header>

        <AnimatePresence mode="wait" initial={false}>
          {status === "HELD" ? (
            <Countdown key="count" hold={hold} remaining={remaining} />
          ) : (
            <Outcome key={status} status={status} />
          )}
        </AnimatePresence>

        <div className="ticket__perforation" aria-hidden />

        {isMine && <Actions hold={hold} status={status} />}
        {!isMine && ownershipKnown && studentId && status === "HELD" && (
          <p className="ticket__note">{t("hold.notMine")}</p>
        )}
        {!isMine && (status === "EXPIRED" || status === "CANCELLED") && (
          <div className="ticket__actions">
            <Link to="/classes" className="btn btn--secondary">
              {t("hold.applyAgain")}
            </Link>
          </div>
        )}

        <dl className="ticket__meta">
          <div>
            <dt>{t("hold.number")}</dt>
            <dd translate="no">{hold.holdId}</dd>
          </div>
          {isMine && studentId && (
            <div>
              <dt>{t("hold.student")}</dt>
              <dd translate="no">{digits(maskStudentId(studentId))}</dd>
            </div>
          )}
          {status === "HELD" && (
            <div>
              <dt>{t("hold.expiryLabel")}</dt>
              <dd>{time(hold.expiresAt)}</dd>
            </div>
          )}
        </dl>
      </TiltCard>
    </div>
  );
}

function Countdown({ hold, remaining }: { hold: Hold; remaining: number }) {
  const { t, digits, time } = useI18n();
  const { minutes, seconds, totalSeconds } = splitDuration(remaining);
  const created = hold.createdAt ? Date.parse(hold.createdAt) : NaN;
  const totalMs = Number.isNaN(created) ? DEFAULT_DURATION_MS : Math.max(1000, Date.parse(hold.expiresAt) - created);
  const fraction = Math.max(0, Math.min(1, remaining / totalMs));
  const warning = totalSeconds <= 60;
  const final = totalSeconds <= 10;

  // Screen readers: announce each new minute and the last ten seconds, not every tick.
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (final) setAnnouncement(t("hold.secondsLeft", { n: totalSeconds }));
    else if (seconds === 0 || announcement === "") setAnnouncement(t("hold.minutesLeft", { n: Math.max(1, minutes) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutes, final ? totalSeconds : 0]);

  const mm = digits(String(minutes).padStart(2, "0"));
  const ss = digits(String(seconds).padStart(2, "0"));

  return (
    <motion.section
      className={["countdown", warning && "countdown--warning", final && "countdown--final"].filter(Boolean).join(" ")}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
    >
      <p className="countdown__label">{warning ? t("hold.warning") : t("hold.timeLeft")}</p>
      <p className="countdown__digits" aria-hidden>
        <span>{mm}</span>
        <span className="countdown__colon">:</span>
        <motion.span
          key={final ? ss : "s"}
          initial={final ? { opacity: 0.35 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {ss}
        </motion.span>
      </p>
      <div className="countdown__track" aria-hidden>
        <span className="countdown__fill" style={{ transform: `scaleX(${fraction})` }} />
      </div>
      <p className="countdown__expires">{t("hold.expiresAt", { time: time(hold.expiresAt) })}</p>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </motion.section>
  );
}

function Outcome({ status }: { status: Exclude<HoldStatus, "HELD"> }) {
  const { t } = useI18n();
  const content = {
    CONFIRMED: { icon: <CheckDraw />, title: t("hold.confirmedTitle"), body: t("hold.confirmedBody") },
    EXPIRED: { icon: <Hourglass size={40} strokeWidth={1.6} />, title: t("hold.expiredTitle"), body: t("hold.expiredBody") },
    CANCELLED: { icon: <CircleX size={40} strokeWidth={1.6} />, title: t("hold.cancelledTitle"), body: t("hold.cancelledBody") },
  }[status];

  return (
    <motion.section
      className={`outcome outcome--${status.toLowerCase()}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      role="status"
    >
      <span className="outcome__icon" aria-hidden>
        {status === "CONFIRMED" && (
          <motion.span
            className="outcome__burst"
            initial={{ scale: 0.4, opacity: 0.7 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1], delay: 0.35 }}
          />
        )}
        {content.icon}
      </span>
      <div>
        <h2 className="outcome__title">{content.title}</h2>
        <p className="outcome__body">{content.body}</p>
      </div>
    </motion.section>
  );
}

/** The confirmed check draws itself once — motion that shows what just changed. */
function CheckDraw() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden>
      <motion.circle
        cx="22" cy="22" r="19" stroke="currentColor" strokeWidth="2.5"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: "easeOut" }}
      />
      <motion.path
        d="M13.5 22.5l6 6 11-12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.4, ease: "easeOut" }}
      />
    </svg>
  );
}

function Actions({ hold, status }: { hold: Hold; status: HoldStatus }) {
  const { t, errorText } = useI18n();
  const { studentId, focusIdentity } = useStudent();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const cancel = useCancel();
  const [askCancel, setAskCancel] = useState(false);

  if (status === "CONFIRMED") return null;
  if (status === "CANCELLED") {
    return (
      <div className="ticket__actions">
        <Link to="/classes" className="btn btn--secondary">
          {t("hold.applyAgain")}
        </Link>
      </div>
    );
  }
  const expired = status === "EXPIRED";

  const setStatus = (next: HoldStatus) =>
    qc.setQueryData<Hold>(qk.hold(hold.holdId), (old) => (old ? { ...old, status: next } : old));

  const handleError = (err: unknown) => {
    if (err instanceof ApiError && err.code === "INVALID_STUDENT_ID") focusIdentity();
    if (err instanceof ApiError && err.code === "HOLD_EXPIRED") setStatus("EXPIRED");
    toast.show("error", errorText(err));
  };

  const pay = () => {
    if (!studentId) return focusIdentity();
    confirm.mutate(
      { holdId: hold.holdId, studentId },
      {
        onSuccess: () => {
          setStatus("CONFIRMED");
          toast.show("success", t("toast.confirmed"));
        },
        onError: handleError,
      },
    );
  };

  const doCancel = () => {
    if (!studentId) return focusIdentity();
    cancel.mutate(
      { holdId: hold.holdId, studentId },
      {
        onSuccess: () => {
          setAskCancel(false);
          setStatus("CANCELLED");
          toast.show("info", t("toast.cancelled"));
        },
        onError: (err) => {
          setAskCancel(false);
          handleError(err);
        },
      },
    );
  };

  return (
    <div className="ticket__actions">
      <Button onClick={pay} loading={confirm.isPending} disabled={expired || cancel.isPending} icon={<CircleCheck size={18} aria-hidden />}>
        {t("hold.pay")}
      </Button>
      {expired && (
        <Link to="/classes" className="btn btn--secondary">
          {t("hold.applyAgain")}
        </Link>
      )}
      {!expired && (
        <div className="cancel-wrap">
          <Button variant="danger" onClick={() => setAskCancel((v) => !v)} disabled={confirm.isPending} aria-expanded={askCancel}>
            {t("hold.cancel")}
          </Button>
          <AnimatePresence>
            {askCancel && (
              <motion.div
                className="cancel-pop"
                role="dialog"
                aria-label={t("hold.cancel")}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
              >
                <p>{t("hold.cancelConfirm")}</p>
                <div className="cancel-pop__row">
                  <Button variant="danger" size="sm" loading={cancel.isPending} onClick={doCancel}>
                    {t("hold.cancelYes")}
                  </Button>
                  <Button variant="quiet" size="sm" onClick={() => setAskCancel(false)}>
                    {t("hold.cancelNo")}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
