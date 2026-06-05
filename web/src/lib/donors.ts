// Heuristics to separate party-committee donations (normal, expected, dominant) from
// private donors (the ones actually worth scrutinizing). Brazilian campaign money is
// mostly party funds, so splitting them makes the donor graph readable.

export function normalizeDonorName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

const PARTY_HINTS = [
  "partido",
  "nacional",
  "estadual",
  "municipal",
  "diretorio",
  "comissao provisoria",
  "fundo partidario",
  "fundo especial",
  "republicanos",
  "progressistas",
  "cidadania",
  "uniao brasil",
  "movimento democratico",
  "podemos",
  "solidariedade",
  "avante",
  "patriota",
];

export function isPartyDonor(name: string): boolean {
  const n = normalizeDonorName(name);
  if (!n || n === "nulo") return true; // "#NULO" = anonymized, not a real private donor
  if (/\bbr\b/.test(n) && /\bbrasil\b/.test(n)) return true; // "... - BRASIL - BR - NACIONAL"
  return PARTY_HINTS.some((h) => n.includes(h));
}
