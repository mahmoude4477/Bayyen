import { describe, expect, it } from "vitest";
import { normalizeStudentName } from "@/lib/student-name";

describe("student name normalization", () => {
  it("trims and collapses spaces while preserving the display name", () => {
    expect(normalizeStudentName("  أحمد   محمد  ")).toEqual({ name: "أحمد محمد", nameKey: "أحمد محمد" });
  });

  it("uses a case-insensitive key for duplicate detection", () => {
    expect(normalizeStudentName("Sara Ali").nameKey).toBe(normalizeStudentName("sara ali").nameKey);
  });
});
