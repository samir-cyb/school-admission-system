import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

type Variant = "primary" | "secondary" | "quiet" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
  size?: "md" | "sm";
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", loading = false, icon, size = "md", className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={["btn", `btn--${variant}`, size === "sm" && "btn--sm", className].filter(Boolean).join(" ")}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle className="btn__spin" size={18} aria-hidden /> : icon}
      <span>{children}</span>
    </button>
  );
});
