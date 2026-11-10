import { AnimatePresence, motion } from "motion/react";
import { CircleCheck, Clock3, Hourglass, CircleX } from "lucide-react";
import type { HoldStatus } from "../lib/api";
import { useI18n } from "../i18n/I18nProvider";

const ICONS = { HELD: Clock3, CONFIRMED: CircleCheck, EXPIRED: Hourglass, CANCELLED: CircleX } as const;

export function StatusChip({ status }: { status: HoldStatus }) {
  const { t } = useI18n();
  const Icon = ICONS[status];
  return (
    <span className={`chip chip--${status.toLowerCase()}`} data-status={status}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={status}
          className="chip__inner"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
        >
          <Icon size={16} strokeWidth={2} aria-hidden />
          {t(`status.${status}`)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
