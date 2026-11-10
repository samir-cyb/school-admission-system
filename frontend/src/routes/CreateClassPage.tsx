import { useId, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { CircleCheck } from "lucide-react";
import { useCreateClass } from "../hooks/queries";
import { useI18n } from "../i18n/I18nProvider";
import { useToast } from "../components/Toasts";
import { Button } from "../components/Button";
import { ApiError, type ClassCreated } from "../lib/api";
import type { MessageKey } from "../i18n/messages";

const MAX_NAME = 100;
const MAX_SEATS = 10_000;

function validateName(name: string): MessageKey | null {
  const v = name.trim();
  if (!v) return "create.nameRequired";
  if (v.length > MAX_NAME) return "create.nameTooLong";
  return null;
}

function parseSeats(raw: string): number | null {
  // Accept Bangla digits too.
  const ascii = raw.trim().replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));
  if (!/^\d+$/.test(ascii)) return null;
  const n = Number(ascii);
  return Number.isSafeInteger(n) && n >= 1 && n <= MAX_SEATS ? n : null;
}

export function CreateClassPage() {
  const { t, errorText } = useI18n();
  const toast = useToast();
  const create = useCreateClass();
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("");
  const [touched, setTouched] = useState({ name: false, seats: false });
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<ClassCreated | null>(null);
  const nameId = useId();
  const seatsId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const seatsRef = useRef<HTMLInputElement>(null);

  const nameError = validateName(name);
  const seatsValue = parseSeats(seats);
  const seatsError = seatsValue === null ? "create.seatsInvalid" : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (create.isPending) return;
    // The button is never silently disabled: a click with a mistake shows every message
    // and puts the cursor on the first field to fix.
    setTouched({ name: true, seats: true });
    if (nameError) return nameRef.current?.focus();
    if (seatsValue === null) return seatsRef.current?.focus();

    setServerError(null);
    create.mutate(
      { name: name.trim(), totalSeats: seatsValue },
      {
        onSuccess: (cls) => {
          setCreated(cls);
          // Ready for the next shift: clear the name, keep the seat count, cursor back in the name box.
          setName("");
          setTouched({ name: false, seats: false });
          toast.show("success", t("toast.created"));
          requestAnimationFrame(() => nameRef.current?.focus());
        },
        onError: (err) => {
          const msg = errorText(err);
          if (err instanceof ApiError && err.status === 400) setServerError(msg);
          else toast.show("error", msg);
        },
      },
    );
  };

  return (
    <div className="container container--form">
      <header className="page-head page-head--stack">
        <p className="page-kicker">{t("nav.adminHint")}</p>
        <h1 className="page-title">{t("create.title")}</h1>
        <p className="page-lead">{t("create.lead")}</p>
      </header>

      <form className="panel form" onSubmit={submit} noValidate>
        {serverError && (
          <p className="form__error" role="alert">
            {serverError}
          </p>
        )}

        <div className="field">
          <label htmlFor={nameId}>{t("create.name")}</label>
          <input
            id={nameId}
            className="input"
            value={name}
            maxLength={MAX_NAME + 20}
            placeholder={t("create.namePlaceholder")}
            autoComplete="off"
            aria-invalid={(touched.name && !!nameError) || undefined}
            aria-describedby={`${nameId}-msg`}
            ref={nameRef}
            onChange={(e) => {
              setName(e.target.value);
              setServerError(null);
            }}
            onBlur={() => setTouched((s) => ({ ...s, name: true }))}
          />
          <p id={`${nameId}-msg`} className={touched.name && nameError ? "field-msg field-msg--error" : "field-msg"}>
            {touched.name && nameError ? t(nameError) : `${name.trim().length}/${MAX_NAME}`}
          </p>
        </div>

        <div className="field">
          <label htmlFor={seatsId}>{t("create.seats")}</label>
          <input
            id={seatsId}
            className="input input--num"
            value={seats}
            inputMode="numeric"
            autoComplete="off"
            placeholder="120"
            aria-invalid={(touched.seats && !!seatsError) || undefined}
            aria-describedby={`${seatsId}-msg`}
            ref={seatsRef}
            onChange={(e) => {
              setSeats(e.target.value);
              setServerError(null);
            }}
            onBlur={() => setTouched((s) => ({ ...s, seats: true }))}
          />
          <p id={`${seatsId}-msg`} className={touched.seats && seatsError ? "field-msg field-msg--error" : "field-msg"}>
            {touched.seats && seatsError ? t(seatsError) : t("create.seatsHint")}
          </p>
        </div>

        <div className="form__actions">
          <Button type="submit" loading={create.isPending}>
            {t("create.submit")}
          </Button>
        </div>
      </form>

      <AnimatePresence>
        {created && (
          <motion.div
            className="created"
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <CircleCheck size={20} aria-hidden />
            <span>{t("create.success", { name: created.name, seats: created.totalSeats })}</span>
            <Link to="/classes">{t("create.seeList")}</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
