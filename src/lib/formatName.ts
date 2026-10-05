/**
 * Display-only name formatting — prefixes "Sis" or "Bro" based on
 * gender wherever a youth's or exco's name is shown. The stored `name`
 * field stays plain (no prefix) so search/sort/alphabetical ordering
 * keep working against the real name; this is purely a rendering
 * concern, applied at every place a name is displayed.
 */

export function capitalizeWords(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}


export function formatPersonName(name: string, gender?: "male" | "female"): string {
  if (!name) return name;
  if (gender === "female") return `Sis ${capitalizeWords(name)}`;
  if (gender === "male") return `Bro ${capitalizeWords(name)}`;
  return name;
}
