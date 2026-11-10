import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClassListPage } from "../routes/ClassListPage";
import { renderAt, mockFetch } from "./render";

const classes = [
  { id: "c_aaaaaaaaaaaaaaaaaaaa", name: "Class 6 - Morning Shift", totalSeats: 120, heldSeats: 15, confirmedSeats: 80, availableSeats: 25 },
  { id: "c_bbbbbbbbbbbbbbbbbbbb", name: "Class 6 - Day Shift", totalSeats: 2, heldSeats: 1, confirmedSeats: 1, availableSeats: 0 },
];

describe("class list", () => {
  it("shows every class with its seat counts and disables full ones", async () => {
    mockFetch({ "GET /classes": { body: classes }, "GET /me/holds": { body: [] } });
    renderAt("/classes", "/classes", <ClassListPage />, { studentId: "20152691234567890" });

    const morning = (await screen.findByText("Class 6 - Morning Shift")).closest("li")!;
    expect(within(morning).getByRole("img")).toHaveAccessibleName(/মোট ১২০, নিশ্চিত ৮০, hold-এ ১৫, খালি ২৫/);
    expect(within(morning).getByRole("button", { name: "আবেদন করুন" })).toBeEnabled();

    const day = screen.getByText("Class 6 - Day Shift").closest("li")!;
    expect(within(day).getByRole("button", { name: "seat শেষ" })).toBeDisabled();
  });

  it("asks for the birth registration number before applying", async () => {
    const calls = mockFetch({ "GET /classes": { body: classes } });
    renderAt("/classes", "/classes", <ClassListPage />, { studentId: null });

    await userEvent.click(await screen.findAllByRole("button", { name: "আবেদন করুন" }).then((b) => b[0]!));

    expect(await screen.findByText("আগে উপরে শিক্ষার্থীর জন্ম নিবন্ধন নম্বর দিন।")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("sends X-Student-Id and explains a 409 when seats run out", async () => {
    const calls = mockFetch({
      "GET /classes": { body: classes },
      "GET /me/holds": { body: [] },
      "POST /classes/c_aaaaaaaaaaaaaaaaaaaa/holds": {
        status: 409,
        body: { error: { code: "NO_SEATS_AVAILABLE", message: "No seats" } },
      },
    });
    renderAt("/classes", "/classes", <ClassListPage />, { studentId: "20152691234567890" });

    const morning = (await screen.findByText("Class 6 - Morning Shift")).closest("li")!;
    await userEvent.click(within(morning).getByRole("button", { name: "আবেদন করুন" }));

    expect(await screen.findByText("দুঃখিত, এই class-এ আর seat খালি নেই।")).toBeInTheDocument();
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.headers["X-Student-Id"]).toBe("20152691234567890");
  });
});
