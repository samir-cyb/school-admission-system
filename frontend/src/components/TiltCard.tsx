import { useRef, type ReactNode, type PointerEvent } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";

/**
 * A glass card that leans a few degrees toward the pointer and catches a soft highlight,
 * like a sheet of frosted glass under a desk lamp. Mouse/pen only; still on touch and for
 * people who prefer reduced motion.
 */
export function TiltCard({ children, className, maxTilt = 4, ...rest }: {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
  "aria-labelledby"?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { stiffness: 160, damping: 18, mass: 0.6 };
  const rotateX = useSpring(useTransform(py, [0, 1], [maxTilt, -maxTilt]), spring);
  const rotateY = useSpring(useTransform(px, [0, 1], [-maxTilt, maxTilt]), spring);
  const glareX = useTransform(px, (v) => `${v * 100}%`);
  const glareY = useTransform(py, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(520px circle at ${glareX} ${glareY}, var(--glare), transparent 60%)`;

  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType === "touch" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <div className="tilt-stage">
      <motion.article
        ref={ref}
        className={["tilt", className].filter(Boolean).join(" ")}
        style={reduce ? undefined : { rotateX, rotateY }}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
        {...rest}
      >
        {!reduce && <motion.span className="tilt__glare" style={{ background: glare }} aria-hidden />}
        {children}
      </motion.article>
    </div>
  );
}
