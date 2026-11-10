import { screen, within } from "@testing-library/react";
import { MyHoldsPage } from "../routes/MyHoldsPage";
import { renderAt, mockFetch } from "./render";

const sid = "20152691234567890";
const future = () => new Date(Date.now() + 5 * 60_000).toISOString();
const past = () => new Date(Date.now() - 60_000).toISOString();

describe("my applications", () => {
  it("asks for the birth registration number when none is saved", async () => {
    const calls = mockFetch({});
    renderAt("/me", "/me", <MyHoldsPage />, { studentId: null });
    expect(screen.getByText("আবেদন দেখতে উপরে শিক্ষার্থীর জন্ম নিবন্ধন নম্বর দিন।")).toBeInTheDocument();
    expect(calls).toHaveLength(0); // no request without an identity
  });

  it("groups applications by status and sends the student's header", async () => {
    const calls = mockFetch({
      "GET /me/holds": {
        body: [
          { holdId: "h_aaaaaaaaaaaaaaaaaaaa", classId: "c_1", className: "Class 6 - Morning Shift", status: "HELD", expiresAt: future() },
          { holdId: "h_bbbbbbbbbbbbbbbbbbbb", classId: "c_2", className: "Class 7 - Day Shift", status: "CONFIRMED", expiresAt: future() },
          { holdId: "h_cccccccccccccccccccc", classId: "c_3", className: "Class 8 - Day Shift", status: "CANCELLED", expiresAt: past() },
        ],
      },
    });
    renderAt("/me", "/me", <MyHoldsPage />, { studentId: sid });

    const active = (await screen.findByRole("heading", { name: "চলমান" })).closest("section")!;
    expect(within(active).getByText("Class 6 - Morning Shift")).toBeInTheDocument();
    expect(within(active).getByText("hold-এ আছে")).toBeInTheDocument();

    const confirmed = screen.getByRole("heading", { name: "নিশ্চিত" }).closest("section")!;
    expect(within(confirmed).getByText("Class 7 - Day Shift")).toBeInTheDocument();

    const closed = screen.getByRole("heading", { name: "শেষ / বাতিল" }).closest("section")!;
    expect(within(closed).getByText("বাতিল")).toBeInTheDocument();

    expect(calls[0]!.headers["X-Student-Id"]).toBe(sid);
  });

  it("shows an empty state with a way forward", async () => {
    mockFetch({ "GET /me/holds": { body: [] } });
    renderAt("/me", "/me", <MyHoldsPage />, { studentId: sid });
    expect(await screen.findByText("এই নম্বরে এখনো কোনো আবেদন নেই।")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Class তালিকা দেখুন" })).toHaveAttribute("href", "/classes");
  });

  it("explains a server outage instead of showing a blank page", async () => {
    globalThis.fetch = (() => Promise.reject(new TypeError("Failed to fetch"))) as typeof fetch;
    renderAt("/me", "/me", <MyHoldsPage />, { studentId: sid });
    expect(await screen.findByText(/সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "আবার চেষ্টা করুন" })).toBeInTheDocument();
  });
});
