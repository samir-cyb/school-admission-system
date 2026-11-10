import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateClassPage } from "../routes/CreateClassPage";
import { renderAt, mockFetch } from "./render";

describe("create class form", () => {
  it("creates one class after another by changing only the name", async () => {
    let n = 0;
    const calls = mockFetch({
      "POST /classes": () => {
        n += 1;
        return { status: 201, body: { id: `c_${"a".repeat(19)}${n}`, name: `Class ${n}`, totalSeats: 120 } };
      },
    });
    const user = userEvent.setup();
    renderAt("/admin/classes/new", "/admin/classes/new", <CreateClassPage />);

    const name = screen.getByLabelText("Class-এর নাম");
    const seats = screen.getByLabelText("Seat সংখ্যা");
    const submit = screen.getByRole("button", { name: "Class তৈরি করুন" });

    await user.type(name, "Class 6 Day");
    await user.type(seats, "120");
    await user.click(submit);
    await screen.findByText(/তৈরি হয়েছে, /);

    // Name is cleared and focused, seat count is kept, button still works.
    expect(name).toHaveValue("");
    expect(name).toHaveFocus();
    expect(seats).toHaveValue("120");
    expect(submit).toBeEnabled();

    await user.type(name, "Class 7 Day");
    await user.click(submit);
    await screen.findByText(/"Class 2" তৈরি হয়েছে/);

    const posts = calls.filter((c) => c.method === "POST");
    expect(posts).toHaveLength(2);
  });

  it("never disables the button silently: a bad click explains and focuses the field", async () => {
    const calls = mockFetch({});
    const user = userEvent.setup();
    renderAt("/admin/classes/new", "/admin/classes/new", <CreateClassPage />);

    await user.type(screen.getByLabelText("Class-এর নাম"), "Class 8 Day");
    await user.click(screen.getByRole("button", { name: "Class তৈরি করুন" }));

    expect(screen.getByText("১ থেকে ১০,০০০-এর মধ্যে একটি পূর্ণ সংখ্যা দিন।")).toBeInTheDocument();
    expect(screen.getByLabelText("Seat সংখ্যা")).toHaveFocus();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });
});
