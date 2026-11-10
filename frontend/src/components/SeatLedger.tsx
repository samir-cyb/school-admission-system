import { motion } from "motion/react";
import { useI18n } from "../i18n/I18nProvider";

interface Props {
  name: string;
  total: number;
  confirmed: number;
  held: number;
  available: number;
  size?: "sm" | "lg";
  /** Stagger index for the first-load fill (the page's one orchestrated moment). */
  index?: number;
}

const spring = { type: "spring", stiffness: 220, damping: 30 } as const;

/**
 * The seat ledger: confirmed (navy) · held (amber, hatched) · free (teal track).
 * Colour is never the only signal — the bar has an aria-label and the counts sit beside it.
 */
export function SeatLedger({ name, total, confirmed, held, available, size = "sm", index = 0 }: Props) {
  const { t } = useI18n();
  const pct = (n: number) => (total > 0 ? `${Math.min(100, (n / total) * 100)}%` : "0%");
  const delay = 0.15 + index * 0.04;

  return (
    <div
      className={`ledger ledger--${size}`}
      role="img"
      aria-label={t("classes.ledgerAria", { name, total, confirmed, held, available })}
    >
      <motion.span
        className="ledger__seg ledger__seg--confirmed"
        initial={{ width: 0 }}
        animate={{ width: pct(confirmed) }}
        transition={{ ...spring, delay }}
      />
      <motion.span
        className="ledger__seg ledger__seg--held"
        initial={{ width: 0 }}
        animate={{ width: pct(held) }}
        transition={{ ...spring, delay: delay + 0.08 }}
      />
    </div>
  );
}
