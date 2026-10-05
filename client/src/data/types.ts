export type ChainMembership = {
  name: string;
  priceEur: number;
  note?: string;
};

export type Chain = {
  id: string;
  slug: string;
  name: string;
  image: string;
  logoFit?: "contain";
  logoClass?: string;
  pricingMode?: string | null;
  priceFrom?: number | null;
  is247?: boolean | null;
  freeTrial?: boolean | null;
  dayPass?: boolean | null;
  website?: string | null;
  hoursWeekday?: string | null;
  hoursWeekend?: string | null;
  membershipsJson?: string | null;
  servicesJson?: string | null;
  sourceUrl?: string | null;
  checkedAt?: string | null;
};

export type Gym = {
  id: string;
  slug: string;
  name: string;
  city: string;
  address: string;
  chainId: string;
  lat: number;
  lng: number;
  listed?: boolean;
  hiddenReason?: string | null;
  www?: string | null;
  phone?: string | null;
  email?: string | null;
  priceFrom?: number | null;
  is247?: boolean | null;
  hoursWeekday?: string | null;
  hoursWeekend?: string | null;
  membershipsJson?: string | null;
};

export function parseMembershipsJson(
  raw: string | null | undefined,
): ChainMembership[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseChainMemberships(
  chain: Chain | null | undefined,
): ChainMembership[] {
  return parseMembershipsJson(chain?.membershipsJson);
}

export function parseChainServices(chain: Chain | null | undefined): string[] {
  if (!chain?.servicesJson) return [];
  try {
    const raw = JSON.parse(chain.servicesJson);
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function resolveGymOffer(
  gym: Gym | null | undefined,
  chain: Chain | null | undefined,
) {
  const priceFrom =
    gym?.priceFrom != null ? gym.priceFrom : (chain?.priceFrom ?? null);
  const is247 = gym?.is247 != null ? gym.is247 : (chain?.is247 ?? null);
  const hoursWeekday =
    gym?.hoursWeekday?.trim() ||
    (is247 === true ? "24/7" : null) ||
    chain?.hoursWeekday?.trim() ||
    null;
  const hoursWeekend =
    gym?.hoursWeekend?.trim() ||
    (is247 === true ? "24/7" : null) ||
    chain?.hoursWeekend?.trim() ||
    null;
  const gymMemberships = parseMembershipsJson(gym?.membershipsJson);
  const memberships =
    gymMemberships.length > 0
      ? gymMemberships
      : parseChainMemberships(chain);
  return { priceFrom, is247, hoursWeekday, hoursWeekend, memberships };
}
