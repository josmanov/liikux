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

function isWomenOnly(tags: string[]) {
  return tags.includes("women") && !tags.includes("men") && !tags.includes("all");
}

function isMenOnly(tags: string[]) {
  return tags.includes("men") && !tags.includes("women") && !tags.includes("all");
}

function matchesAudienceTag(tags: string[], id: string) {
  if (id === "all") return tags.includes("all");
  if (id === "women") return isWomenOnly(tags);
  if (id === "men") return isMenOnly(tags);
  if (id === "kids") return tags.includes("kids");
  if (id === "seniors") return tags.includes("seniors");
  return tags.includes(id);
}

export function gymMatchesAudience(
  gym: Gym | null | undefined,
  chain: Chain | ChainSummary | null | undefined,
  selected: string[],
) {
  if (selected.length === 0) return true;
  const tags = parseAudienceTags(gym?.audienceJson ?? chain?.audienceJson);
  if (tags.length === 0) return false;
  return selected.some((id) => matchesAudienceTag(tags, id));
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

export function gymHasFreeTrial(
  gym: Gym,
  chain: Chain | ChainSummary | null | undefined,
) {
  if (gym.freeTrial === true) return true;
  if (gym.freeTrial === false) return false;
  return chain?.freeTrial === true;
}

export function gymHasDayPass(
  gym: Gym,
  chain: Chain | ChainSummary | null | undefined,
) {
  if (gym.dayPass === true) return true;
  if (gym.dayPass === false) return false;
  return chain?.dayPass === true;
}
