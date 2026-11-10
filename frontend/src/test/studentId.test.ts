import { groupStudentId, isValidStudentId, maskStudentId, normalizeStudentId } from "../lib/studentId";

describe("student id (birth registration number)", () => {
  it("turns Bangla digits into ASCII and drops separators", () => {
    expect(normalizeStudentId("২০১৫ ২৬৯১-২৩৪৫ ৬৭৮৯০")).toBe("20152691234567890");
  });

  it("never keeps more than 17 digits", () => {
    expect(normalizeStudentId("1234567890123456789")).toHaveLength(17);
  });

  it("accepts exactly 17 ASCII digits only", () => {
    expect(isValidStudentId("20152691234567890")).toBe(true);
    expect(isValidStudentId("2015269123456789")).toBe(false);
    expect(isValidStudentId("2015269123456789a")).toBe(false);
    expect(isValidStudentId(null)).toBe(false);
  });

  it("groups and masks for display", () => {
    expect(groupStudentId("20152691234567890")).toBe("2015 2691 2345 67890");
    expect(maskStudentId("20152691234567890")).toBe("2015 •••• •••• 67890");
  });
});
