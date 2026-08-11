import { describe, expect, it } from "vitest";
import { correctInkStroke, type InkPoint } from "@/lib/ink";

describe("correctInkStroke", () => {
  it("snaps a slightly wobbly long line to exact interpolation", () => {
    const raw: InkPoint[] = [[0, 20, 0.5], [40, 23, 0.5], [80, 18, 0.5], [140, 21, 0.5]];
    const result = correctInkStroke(raw);
    expect(result.snapped).toBe(true);
    expect(result.raw).toEqual(raw);
    expect(result.corrected).toHaveLength(16);
    expect(result.corrected[0]).toEqual(raw[0]);
    expect(result.corrected.at(-1)).toEqual(raw.at(-1));
  });

  it("keeps a curved digit stroke while preserving its original points", () => {
    const raw: InkPoint[] = [[10, 10, 0.5], [70, 5, 0.5], [85, 45, 0.5], [45, 70, 0.5], [90, 110, 0.5], [20, 140, 0.5]];
    const result = correctInkStroke(raw);
    expect(result.snapped).toBe(false);
    expect(result.raw).toEqual(raw);
    expect(result.corrected).toEqual(raw);
  });
});
