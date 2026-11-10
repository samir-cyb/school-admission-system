import { useEffect, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Languages, Monitor, Moon, Sun, WifiOff } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { useTheme, type ThemeChoice } from "../lib/theme";
import { useOffline } from "../lib/connection";
import { useStudent } from "../lib/student";
import { useMyHolds } from "../hooks/queries";
import { IdentityStrip } from "./IdentityStrip";
import { ErrorBoundary } from "./States";
import { Ambient } from "./Ambient";

const NEXT_THEME: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };
const THEME_ICON = { system: Monitor, light: Sun, dark: Moon } as const;

function Brand() {
  const { t } = useI18n();
  return (
    <Link to="/classes" className="brand">
      <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" className="brand__bg" />
        <rect x="7" y="9" width="18" height="4" rx="2" className="brand__line" />
        <rect x="7" y="16" width="11" height="4" rx="2" className="brand__line" />
        <circle cx="23" cy="21" r="4" className="brand__dot" />
      </svg>
      <span className="brand__name">{t("app.name")}</span>
    </Link>
  );
}

function MainNav() {
  const { t, num } = useI18n();
  const { studentId } = useStudent();
  const mine = useMyHolds(studentId);
  const active = mine.data?.filter((h) => h.status === "HELD").length ?? 0;

  const items = [
    { to: "/classes", label: t("nav.classes") },
    { to: "/me", label: t("nav.mine"), badge: active > 0 ? num(active) : undefined },
    { to: "/admin/classes/new", label: t("nav.create"), hint: t("nav.adminHint") },
  ];

  return (
    <nav className="mainnav" aria-label="Main">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} className="mainnav__link" title={item.hint}>
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="nav-pill"
                  className="mainnav__pill"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="mainnav__label">{item.label}</span>
              {item.badge && (
                <motion.span
                  className="mainnav__badge"
                  key={item.badge}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                >
                  {item.badge}
                </motion.span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function Tools() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const ThemeIcon = THEME_ICON[theme];
  return (
    <div className="tools">
      <button
        type="button"
        className="tool"
        onClick={() => setLang(lang === "bn" ? "en" : "bn")}
        aria-label={t("lang.switchAria")}
      >
        <Languages size={18} aria-hidden />
        <span>{t("lang.switch")}</span>
      </button>
      <button
        type="button"
        className="tool tool--icon"
        onClick={() => setTheme(NEXT_THEME[theme])}
        aria-label={`${t("theme.label")}: ${t(`theme.${theme}`)}`}
        title={`${t("theme.label")}: ${t(`theme.${theme}`)}`}
      >
        <ThemeIcon size={18} aria-hidden />
      </button>
    </div>
  );
}

function OfflineBanner() {
  const { t } = useI18n();
  const offline = useOffline();
  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          className="offline"
          role="alert"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
        >
          <div className="offline__inner">
            <WifiOff size={18} aria-hidden />
            <span>{t("offline.banner")}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { t } = useI18n();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <>
      <Ambient />
      <a href="#main" className="skip-link">
        {t("common.skip")}
      </a>
      <div className="sticky-top">
        <header className="topbar">
          <div className="topbar__inner">
            <Brand />
            <MainNav />
            <Tools />
          </div>
        </header>
        <IdentityStrip />
        <OfflineBanner />
      </div>
      <main id="main" className="page" tabIndex={-1}>
        <ErrorBoundary resetKey={location.pathname}>
          {/* Keyed by path: each new screen settles in on a spring. Only opacity/transform animate
              (compositor-only, no blur), and there is no exit animation, so the outgoing view never
              re-renders with the next route's content. */}
          <motion.div
            key={location.pathname}
            className="page__view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28, mass: 0.8 }}
          >
            {children}
          </motion.div>
        </ErrorBoundary>
      </main>
    </>
  );
}
