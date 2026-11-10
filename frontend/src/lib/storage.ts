/** localStorage that never throws (private mode, blocked storage, quota). */
export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null): void {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch {
      /* storage unavailable: the app still works for this tab */
    }
  },
};

export const KEYS = {
  studentId: "admission.studentId",
  lang: "admission.lang",
  theme: "admission.theme",
} as const;
