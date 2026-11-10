import { act, screen } from "@testing-library/react";
import { HoldPage } from "../routes/HoldPage";
import { renderAt, mockFetch } from "./render";
import { resetClock } from "../lib/clock";

const student = "20152691234567890";

function holdResponse(expiresInMs: number) {
  const now = Date.now();
  return {
    holdId: "h_aaaaaaaaaaaaaaaaaaaa",
    classId: "c_aaaaaaaaaaaaaaaaaaaa",
    className: "Class 6 - Morning Shift",
    status: "HELD",
    createdAt: new Date(now - 1000).toISOString(),
    expiresAt: new Date(now + expiresInMs).toISOString(),
  };
}

describe("application page", () => {
  beforeEach(() => resetClock(0));
  afterEach(() => vi.useRealTimers());

  it("shows the countdown and an enabled pay button while HELD", async () => {
    mockFetch({
      "GET /holds/h_aaaaaaaaaaaaaaaaaaaa": { body: holdResponse(5 * 60_000) },
      "GET /me/holds": { body: [{ ...holdResponse(5 * 60_000) }] },
    });
    renderAt("/holds/h_aaaaaaaaaaaaaaaaaaaa", "/holds/:holdId", <HoldPage />, { studentId: student });

    const pay = await screen.findByRole("button", { name: "ভর্তি ফি দিন" });
    expect(pay).toBeEnabled();
    expect(screen.getByRole("button", { name: "বাতিল" })).toBeEnabled();
    expect(screen.getByText("hold-এ আছে")).toBeInTheDocument();
  });

  it("flips to EXPIRED and disables pay when time runs out, without a reload", async () => {
    mockFetch({
      "GET /holds/h_aaaaaaaaaaaaaaaaaaaa": { body: holdResponse(1200) },
      "GET /me/holds": { body: [{ ...holdResponse(1200) }] },
    });
    renderAt("/holds/h_aaaaaaaaaaaaaaaaaaaa", "/holds/:holdId", <HoldPage />, { studentId: student });

    const pay = await screen.findByRole("button", { name: "ভর্তি ফি দিন" });
    expect(pay).toBeEnabled();

    // Let the real clock pass the expiry; the server still says HELD.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1700));
    });

    expect(await screen.findByText("মেয়াদোত্তীর্ণ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ভর্তি ফি দিন" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "বাতিল" })).not.toBeInTheDocument();
  });

  it("shows a readable message for an unknown application", async () => {
    mockFetch({});
    renderAt("/holds/h_zzzzzzzzzzzzzzzzzzzz", "/holds/:holdId", <HoldPage />, { studentId: student });
    expect(await screen.findByText("এই আবেদনটি পাওয়া যায়নি।")).toBeInTheDocument();
  });
});
