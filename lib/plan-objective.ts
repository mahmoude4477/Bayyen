const MAX_PLAN_OBJECTIVE_LENGTH = 180;
const MAX_PLAN_FOCUS_LENGTH = 132;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function trimToLength(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

export function compactPlanFocus(value: string | null | undefined, fallback: string) {
  const normalized = normalizeWhitespace(value ?? "") || normalizeWhitespace(fallback);
  const firstIdea = normalized.split(/[،؛.]/u).map((part) => part.trim()).find(Boolean) ?? normalized;
  return trimToLength(firstIdea.replace(/[،؛.,]+$/u, ""), MAX_PLAN_FOCUS_LENGTH);
}

export function buildPlanObjective(groupLabel: string, focus: string | null | undefined, fallback: string) {
  return `${groupLabel}: ${compactPlanFocus(focus, fallback)}`;
}

export function normalizePlanObjective(value: string, groupLabel: string) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= MAX_PLAN_OBJECTIVE_LENGTH) return normalized;

  const prefix = `${groupLabel}:`;
  const focus = normalized.startsWith(prefix) ? normalized.slice(prefix.length).trim() : normalized;
  return buildPlanObjective(groupLabel, focus, "المهارة ذات الأولوية");
}
