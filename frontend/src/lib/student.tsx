import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { KEYS, storage } from "./storage";
import { isValidStudentId } from "./studentId";

interface StudentContextValue {
  /** Saved, valid 17-digit id or null. Persisted in localStorage (survives refresh and browser restart). */
  studentId: string | null;
  setStudentId: (id: string | null) => void;
  /** Moves keyboard focus to the identity box (used when an action needs an id first). */
  focusIdentity: () => void;
  identityInputRef: React.RefObject<HTMLInputElement | null>;
  /** Bumped every time something asks for the id, so the strip can highlight itself. */
  attention: number;
}

const StudentContext = createContext<StudentContextValue | null>(null);

function readSaved(): string | null {
  const v = storage.get(KEYS.studentId);
  return isValidStudentId(v) ? v : null;
}

export function StudentProvider({ children, initialId }: { children: ReactNode; initialId?: string | null }) {
  const [studentId, setState] = useState<string | null>(initialId !== undefined ? initialId : readSaved);
  const [attention, setAttention] = useState(0);
  const identityInputRef = useRef<HTMLInputElement | null>(null);

  const setStudentId = useCallback((id: string | null) => {
    const value = isValidStudentId(id) ? id : null;
    storage.set(KEYS.studentId, value);
    setState(value);
  }, []);

  const focusIdentity = useCallback(() => {
    setAttention((n) => n + 1);
    // The strip may need a render to switch from "saved" to "editing" before the input exists.
    requestAnimationFrame(() => {
      identityInputRef.current?.focus();
      identityInputRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, []);

  const value = useMemo(
    () => ({ studentId, setStudentId, focusIdentity, identityInputRef, attention }),
    [studentId, setStudentId, focusIdentity, attention],
  );

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudent(): StudentContextValue {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error("useStudent must be used inside <StudentProvider>");
  return ctx;
}
