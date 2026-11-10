import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { useI18n } from "../i18n/I18nProvider";

/** Rolls to a new value when a poll changes it, so the eye catches what moved. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const { num } = useI18n();
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reduce || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration: 0.5,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, reduce]);

  return <span className={["num", className].filter(Boolean).join(" ")}>{num(shown)}</span>;
}
