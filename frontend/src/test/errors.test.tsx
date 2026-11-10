import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { I18nProvider, useI18n } from "../i18n/I18nProvider";
import { ApiError, NetworkError } from "../lib/api";

const wrap = (lang: "bn" | "en") => ({ children }: { children: ReactNode }) => <I18nProvider lang={lang}>{children}</I18nProvider>;

describe("error messages", () => {
  it("maps API error codes to readable Bangla", () => {
    const { result } = renderHook(() => useI18n(), { wrapper: wrap("bn") });
    expect(result.current.errorText(new ApiError(409, "NO_SEATS_AVAILABLE", "x"))).toBe("দুঃখিত, এই class-এ আর seat খালি নেই।");
    expect(result.current.errorText(new NetworkError())).toMatch(/সার্ভারের সাথে যোগাযোগ/);
    expect(result.current.errorText(new ApiError(500, "INTERNAL_ERROR", "boom"))).toMatch(/সার্ভারে সমস্যা/);
  });

  it("maps the same codes in English", () => {
    const { result } = renderHook(() => useI18n(), { wrapper: wrap("en") });
    expect(result.current.errorText(new ApiError(409, "HOLD_EXPIRED", "x"))).toBe("This application expired; the seat was released.");
  });

  it("renders numbers with Bangla digits", () => {
    const { result } = renderHook(() => useI18n(), { wrapper: wrap("bn") });
    expect(result.current.num(120)).toBe("১২০");
    expect(result.current.digits("09:42")).toBe("০৯:৪২");
  });
});
