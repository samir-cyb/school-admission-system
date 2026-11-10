import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowUpRight, LayoutList, Plus } from "lucide-react";
import { useApply, useClasses, useMyHolds } from "../hooks/queries";
import { ApiError, type ClassSummary, type MyHold } from "../lib/api";
import { useStudent } from "../lib/student";
import { useI18n } from "../i18n/I18nProvider";
import { useToast } from "../components/Toasts";
import { Button } from "../components/Button";
import { SeatLedger } from "../components/SeatLedger";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { LiveIndicator } from "../components/LiveIndicator";
import { EmptyState, ErrorPanel, SkeletonRows } from "../components/States";

export function ClassListPage() {
  const { t } = useI18n();
  const classes = useClasses();
  const { studentId } = useStudent();
  const mine = useMyHolds(studentId);

  // classId → my active (HELD/CONFIRMED) application there, if any
  const activeByClass = new Map<string, MyHold>();
  for (const h of mine.data ?? []) {
    if (h.status === "HELD" || h.status === "CONFIRMED") activeByClass.set(h.classId, h);
  }

  return (
    <div className="container">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t("classes.title")}</h1>
          <p className="page-lead">{t("classes.lead")}</p>
        </div>
        {classes.data && <LiveIndicator updatedAt={classes.dataUpdatedAt} stale={classes.isError} />}
      </header>

      {classes.isPending ? (
        <SkeletonRows />
      ) : classes.isError && !classes.data ? (
        <ErrorPanel error={classes.error} onRetry={() => classes.refetch()} />
      ) : classes.data.length === 0 ? (
        <EmptyState
          icon={<LayoutList size={28} />}
          text={t("classes.empty")}
          action={
            <Link to="/admin/classes/new" className="btn btn--primary">
              <Plus size={18} aria-hidden />
              <span>{t("classes.emptyAction")}</span>
            </Link>
          }
        />
      ) : (
        <ul className="class-list">
          {classes.data.map((c, i) => (
            <ClassRow key={c.id} cls={c} index={i} mine={activeByClass.get(c.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ClassRow({ cls, index, mine }: { cls: ClassSummary; index: number; mine?: MyHold }) {
  const { t, errorText } = useI18n();
  const { studentId, focusIdentity } = useStudent();
  const toast = useToast();
  const navigate = useNavigate();
  const apply = useApply();
  const pending = apply.isPending;
  const full = cls.availableSeats <= 0;

  const onApply = () => {
    if (!studentId) {
      toast.show("error", t("id.required"));
      focusIdentity();
      return;
    }
    apply.mutate(
      { classId: cls.id, studentId },
      {
        onSuccess: (hold) => {
          toast.show("success", t("toast.held"));
          navigate(`/holds/${hold.holdId}`);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === "ACTIVE_HOLD_EXISTS" && err.holdId) {
            toast.show("info", t("error.ACTIVE_HOLD_EXISTS"), { to: `/holds/${err.holdId}`, label: t("classes.viewMine") });
            return;
          }
          if (err instanceof ApiError && err.code === "INVALID_STUDENT_ID") focusIdentity();
          toast.show("error", errorText(err));
        },
      },
    );
  };

  return (
    <motion.li
      className={["class-row", full && "class-row--full", mine && "class-row--mine"].filter(Boolean).join(" ")}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="class-row__main">
        <h2 className="class-row__name">{cls.name}</h2>
        <SeatLedger
          name={cls.name}
          total={cls.totalSeats}
          confirmed={cls.confirmedSeats}
          held={cls.heldSeats}
          available={cls.availableSeats}
          index={index}
        />
        <dl className="counts">
          <div className="counts__item counts__item--confirmed">
            <dt>{t("classes.confirmed")}</dt>
            <dd><AnimatedNumber value={cls.confirmedSeats} /></dd>
          </div>
          <div className="counts__item counts__item--held">
            <dt>{t("classes.held")}</dt>
            <dd><AnimatedNumber value={cls.heldSeats} /></dd>
          </div>
          <div className="counts__item counts__item--total">
            <dt>{t("classes.total")}</dt>
            <dd><AnimatedNumber value={cls.totalSeats} /></dd>
          </div>
        </dl>
      </div>

      <div className="class-row__side">
        <p className="free">
          <AnimatedNumber value={cls.availableSeats} className="free__num" />
          <span className="free__label">{t("classes.available")}</span>
        </p>
        {mine ? (
          <Link to={`/holds/${mine.holdId}`} className="btn btn--secondary">
            <span>{t("classes.viewMine")}</span>
            <ArrowUpRight size={18} aria-hidden />
          </Link>
        ) : (
          <Button onClick={onApply} loading={pending} disabled={full}>
            {full ? t("classes.full") : t("classes.apply")}
          </Button>
        )}
      </div>
    </motion.li>
  );
}
