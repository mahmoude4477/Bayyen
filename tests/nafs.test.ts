import { describe, expect, it } from "vitest";
import { canonicalizeSubject, getNafsLearningOutcomes, resolveNafsAlignment } from "@/lib/nafs";

describe("NAFS alignment", () => {
  it("shows science instead of physics for sixth primary", () => {
    expect(canonicalizeSubject("الفيزياء", "الصف السادس الابتدائي")).toBe("العلوم");
  });

  it("activates cumulative science alignment for sixth grade", () => {
    const alignment = resolveNafsAlignment({
      subject: "فيزياء",
      grade: "الصف السادس الابتدائي",
    });
    expect(alignment).toMatchObject({
      enabled: true,
      subject: "العلوم",
      domain: "العلوم الطبيعية · الصف السادس",
      framework: "وثيقة نواتج التعلم للاختبارات الوطنية 2026",
    });
  });

  it("does not relabel secondary physics as science", () => {
    const alignment = resolveNafsAlignment({
      subject: "الفيزياء",
      grade: "الصف الأول الثانوي",
    });
    expect(alignment.enabled).toBe(false);
    expect(alignment.subject).toBe("الفيزياء");
  });

  it("loads the ten published science content outcomes", () => {
    const outcomes = getNafsLearningOutcomes({ subject: "العلوم", grade: "الصف السادس الابتدائي" });
    expect(outcomes).toHaveLength(10);
    expect(outcomes.map((outcome) => outcome.code)).toEqual([
      "NAFS-SCI6-01",
      "NAFS-SCI6-02",
      "NAFS-SCI6-03",
      "NAFS-SCI6-04",
      "NAFS-SCI6-05",
      "NAFS-SCI6-06",
      "NAFS-SCI6-07",
      "NAFS-SCI6-08",
      "NAFS-SCI6-09",
      "NAFS-SCI6-10",
    ]);
  });
});
