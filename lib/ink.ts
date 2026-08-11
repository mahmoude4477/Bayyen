export type InkPoint = [number, number, number];
export type InkStroke = { raw: InkPoint[]; corrected: InkPoint[]; snapped: boolean };

export function getSvgPathFromStroke(points: number[][]) {
  if (points.length < 4) return "";
  const average = (first: number[], second: number[]) => [
    (first[0] + second[0]) / 2,
    (first[1] + second[1]) / 2,
  ];
  let path = `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)} Q${points[1][0].toFixed(2)},${points[1][1].toFixed(2)} `;
  const firstMidpoint = average(points[1], points[2]);
  path += `${firstMidpoint[0].toFixed(2)},${firstMidpoint[1].toFixed(2)} T`;
  for (let index = 2; index < points.length - 1; index += 1) {
    const midpoint = average(points[index], points[index + 1]);
    path += `${midpoint[0].toFixed(2)},${midpoint[1].toFixed(2)} `;
  }
  return `${path}Z`;
}

function distanceFromLine(point: InkPoint, start: InkPoint, end: InkPoint) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (!length) return 0;
  return Math.abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / length;
}

export function correctInkStroke(raw: InkPoint[]): InkStroke {
  if (raw.length < 3) return { raw, corrected: raw, snapped: false };
  const start = raw[0];
  const end = raw[raw.length - 1];
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const maxDeviation = raw.reduce((maximum, point) => Math.max(maximum, distanceFromLine(point, start, end)), 0);
  const shouldSnap = length >= 70 && maxDeviation <= Math.min(18, length * 0.08);
  if (!shouldSnap) return { raw, corrected: raw, snapped: false };
  const corrected = Array.from({ length: 16 }, (_, index): InkPoint => {
    const ratio = index / 15;
    return [
      start[0] + (end[0] - start[0]) * ratio,
      start[1] + (end[1] - start[1]) * ratio,
      start[2] + (end[2] - start[2]) * ratio,
    ];
  });
  return { raw, corrected, snapped: true };
}
