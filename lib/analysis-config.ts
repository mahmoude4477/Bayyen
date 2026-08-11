export const REQUIRED_STUDENT_COUNT = 5;

export function studentCode(index: number) {
  return `S-${String(index + 1).padStart(3, "0")}`;
}

export function formatArabicInteger(value: number) {
  return new Intl.NumberFormat("ar-SA-u-nu-arab", { useGrouping: false }).format(value);
}
