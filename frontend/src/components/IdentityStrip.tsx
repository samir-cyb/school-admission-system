import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, IdCard } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { useStudent } from "../lib/student";
import { groupStudentId, isValidStudentId, normalizeStudentId, STUDENT_ID_LENGTH } from "../lib/studentId";
import { Button } from "./Button";
import { useToast } from "./Toasts";

/**
 * PDF §1.3: "a box at the top of the page where the student's birth registration number is written;
 * the UI uses it as the student's identity". Persisted, so it survives refresh and browser restart.
 */
export function IdentityStrip() {
  const { t, digits } = useI18n();
  const { studentId, setStudentId, identityInputRef, attention } = useStudent();
  const toast = useToast();
  const [editing, setEditing] = useState(!studentId);
  const [draft, setDraft] = useState(studentId ?? "");
  const [showError, setShowError] = useState(false);
  const inputId = useId();
  // The edit form mounts after the saved view animates out, so focus it when it actually appears.
  const focusOnMount = useRef(false);
  const inputRef = useCallback(
    (el: HTMLInputElement | null) => {
      identityInputRef.current = el;
      if (el && focusOnMount.current) {
        focusOnMount.current = false;
        el.focus();
      }
    },
    [identityInputRef],
  );
  const hintId = useId();

  // Something asked for the id (e.g. "Apply" without one): open the editor.
  useEffect(() => {
    if (attention > 0) {
      focusOnMount.current = true;
      setEditing(true);
      setShowError(!isValidStudentId(draft));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attention]);

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidStudentId(draft)) {
      setShowError(true);
      identityInputRef.current?.focus();
      return;
    }
    const changed = draft !== studentId;
    setStudentId(draft);
    setEditing(false);
    setShowError(false);
    if (changed) toast.show("success", t("toast.idSaved"));
  };

  const invalid = showError && !isValidStudentId(draft);

  return (
    <section className="identity" aria-label={t("id.label")}>
      {attention > 0 && <span key={attention} className="identity__flash" aria-hidden />}
      <div className="identity__inner">
        <IdCard className="identity__icon" size={22} aria-hidden />
        <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.form
            key="edit"
            className="identity__form"
            onSubmit={save}
            noValidate
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          >
            <label htmlFor={inputId} className="identity__label">
              {t("id.label")}
            </label>
            <div className="identity__row">
              <input
                id={inputId}
                ref={inputRef}
                className="input input--id"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                placeholder={t("id.placeholder")}
                value={draft}
                maxLength={STUDENT_ID_LENGTH + 8}
                aria-invalid={invalid || undefined}
                aria-describedby={hintId}
                onChange={(e) => setDraft(normalizeStudentId(e.target.value))}
              />
              <Button type="submit" size="sm">
                {t("id.save")}
              </Button>
              {studentId && (
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={() => {
                    setDraft(studentId);
                    setEditing(false);
                    setShowError(false);
                  }}
                >
                  {t("hold.cancelNo")}
                </Button>
              )}
            </div>
            <p id={hintId} className={invalid ? "field-msg field-msg--error" : "field-msg"}>
              {invalid ? t("id.invalid") : `${t("id.counter", { n: draft.length })} · ${t("id.hint")}`}
            </p>
          </motion.form>
        ) : (
          <motion.div
            key="saved"
            className="identity__saved"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          >
            <span className="identity__label">{t("id.label")}</span>
            <span className="identity__value" translate="no">
              {digits(groupStudentId(studentId!))}
            </span>
            <span className="identity__ok">
              <BadgeCheck size={16} aria-hidden /> {t("id.saved")}
            </span>
            <Button
              variant="quiet"
              size="sm"
              onClick={() => {
                setDraft(studentId ?? "");
                focusOnMount.current = true;
                setEditing(true);
              }}
            >
              {t("id.change")}
            </Button>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </section>
  );
}
