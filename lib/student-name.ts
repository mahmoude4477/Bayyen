export function normalizeStudentName(value: string) {
  const name = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  return { name, nameKey: name.toLocaleLowerCase("ar") };
}
