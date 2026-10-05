import type { Chain, ChainSummary, Gym } from "./types";

export function parseAudienceTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function gymMatchesAudience(
  chain: Chain | ChainSummary | null | undefined,
  selected: string[],
) {
  if (selected.length === 0) return true;
  const tags = parseAudienceTags(chain?.audienceJson);
  if (tags.length === 0) return true;
  return selected.some((id) => tags.includes(id));
}

export function chainForGym(
  gym: Gym,
  chains: Chain[],
): Chain | ChainSummary | null {
  if (gym.chain) return gym.chain;
  return chains.find((c) => c.id === gym.chainId) ?? null;
}

export function gymIs247(
  gym: Gym,
  chain: Chain | ChainSummary | null | undefined,
) {
  if (gym.is247 === true) return true;
  if (gym.is247 === false) return false;
  return chain?.is247 === true;
}
