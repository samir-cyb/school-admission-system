import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { bn, en, type MessageKey } from "./messages";
import { KEYS, storage } from "../lib/storage";
import { ApiError, NetworkError } from "../lib/api";

export type Lang = "bn" | "en";

type Vars = Record<string, string | number>;

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translate; numeric vars are rendered with the language's digits (০-৯ in Bangla). */
  t: (key: MessageKey, vars?: Vars) => string;
  num: (n: number) => string;
  /** Digits only, no grouping — for ids and countdowns. */
  digits: (s: string) => string;
  time: (iso: string | number) => string;
  dateTime: (iso: string | number) => string;
  /** Human message for any error thrown by the API client. */
  errorText: (err: unknown) => string;
}

const I18nContext = createContext<I18n | null>(null);

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

export function initialLang(): Lang {
  return storage.get(KEYS.lang) === "en" ? "en" : "bn";
}

export function I18nProvider({ children, lang: forced }: { children: ReactNode; lang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(forced ?? initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    storage.set(KEYS.lang, next);
  }, []);

  const value = useMemo<I18n>(() => {
    const dict = lang === "bn" ? bn : en;
    const locale = lang === "bn" ? "bn-BD" : "en-GB";
    const numberFmt = new Intl.NumberFormat(locale);
    const timeFmt = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", second: "2-digit" });
    const dateTimeFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

    const digits = (s: string) => (lang === "bn" ? s.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]!) : s);
    const num = (n: number) => numberFmt.format(n);

    const t = (key: MessageKey, vars?: Vars) => {
      let text: string = dict[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replaceAll(`{${k}}`, typeof v === "number" ? num(v) : v);
        }
      }
      return text;
    };

    const errorText = (err: unknown): string => {
      if (err instanceof NetworkError) return t("error.network");
      if (err instanceof ApiError) {
        const key = `error.${err.code}` as MessageKey;
        if (key in dict) return t(key, { message: err.message });
        if (err.status >= 500) return t("error.server");
        if (err.status === 404) return t("error.NOT_FOUND");
        return err.message || t("error.unknown");
      }
      return t("error.unknown");
    };

    return {
      lang,
      setLang,
      t,
      num,
      digits,
      time: (iso) => timeFmt.format(new Date(iso)),
      dateTime: (iso) => dateTimeFmt.format(new Date(iso)),
      errorText,
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
