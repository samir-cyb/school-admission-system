import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IdentityStrip } from "../components/IdentityStrip";
import { renderAt, mockFetch } from "./render";

describe("identity strip (the box at the top of the page)", () => {
  beforeEach(() => mockFetch({}));

  it("accepts Bangla digits, saves the ASCII number and remembers it", async () => {
    const user = userEvent.setup();
    renderAt("/", "/", <IdentityStrip />);
    await user.type(screen.getByRole("textbox"), "২০১৫ ২৬৯১ ২৩৪৫ ৬৭৮৯০");
    expect(screen.getByRole("textbox")).toHaveValue("20152691234567890");

    await user.click(screen.getByRole("button", { name: "সংরক্ষণ" }));
    expect(await screen.findByText("এই নম্বর দিয়ে আবেদন হবে")).toBeInTheDocument();
    expect(window.localStorage.getItem("admission.studentId")).toBe("20152691234567890");
  });

  it("refuses a number that is not 17 digits", async () => {
    const user = userEvent.setup();
    renderAt("/", "/", <IdentityStrip />);
    await user.type(screen.getByRole("textbox"), "12345");
    await user.click(screen.getByRole("button", { name: "সংরক্ষণ" }));
    expect(screen.getByText("নম্বরটি ঠিক ১৭ অঙ্কের হতে হবে।")).toBeInTheDocument();
    expect(window.localStorage.getItem("admission.studentId")).toBeNull();
  });

  it("shows a saved number grouped, and lets the guardian change it", async () => {
    const user = userEvent.setup();
    renderAt("/", "/", <IdentityStrip />, { studentId: "20152691234567890" });
    expect(screen.getByText("২০১৫ ২৬৯১ ২৩৪৫ ৬৭৮৯০")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "পরিবর্তন" }));
    expect(await screen.findByRole("textbox")).toHaveFocus();
  });
});
