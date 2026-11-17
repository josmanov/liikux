export type ChainMembership = {
  name: string;
  priceEur: number;
  note?: string;
  /** 0 = no fixed term, 12 = 12-month contract (from the daily refresh). */
  commitmentMonths?: number;
  joiningFeeEur?: number;
  group?: "normal" | "student" | "senior" | "youth";
};

/** A campaign the daily refresh found on the chain's or gym's own page. */
export type GymOffer = {
  id: string;
  title: string;
  text: string;
  priceEur: number | null;
  discountPct: number | null;
  /** YYYY-MM-DD, or null when the page gives no end date. */
  validUntil: string | null;
  sourceUrl: string;
  /** true = the offer is for every gym of the chain. */
  chainWide: boolean;
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
  audienceJson?: string | null;
  sourceUrl?: string | null;
  checkedAt?: string | null;
  gymCount?: number;
  cityCount?: number;
};

export type ChainSummary = Pick<
  Chain,
  | "id"
  | "slug"
  | "name"
  | "image"
  | "logoFit"
  | "logoClass"
  | "pricingMode"
  | "priceFrom"
  | "is247"
  | "freeTrial"
  | "dayPass"
  | "audienceJson"
>;

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
  freeTrial?: boolean | null;
  dayPass?: boolean | null;
  hoursWeekday?: string | null;
  hoursWeekend?: string | null;
  membershipsJson?: string | null;
  servicesJson?: string | null;
  audienceJson?: string | null;
  /** When the price/offer data was last checked (ISO date), and where from. */
  offerCheckedAt?: string | null;
  offerSourceUrl?: string | null;
  /** Results of the daily robot check. Only on the single-gym API answer. */
  checks?: { price?: FactCheck; hours?: FactCheck } | null;
  /** Current offers. Only on the single-gym API answer. */
  offers?: GymOffer[] | null;
  /** The gym (or its chain) has an offer right now. On list answers. */
  hasOffer?: boolean;
  chain?: ChainSummary | null;
};

/** One fact ("price" or "hours") checked against the gym's own page. */
export type FactCheck = {
  status: "confirmed" | "not_found" | "unreachable" | "blocked" | "no_source";
  checkedAt: string;
  /** Last time the value was really found on the page. */
  verifiedAt: string | null;
  sourceUrl: string | null;
  note: string | null;
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

export function parseServicesJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseChainServices(chain: Chain | null | undefined): string[] {
  return parseServicesJson(chain?.servicesJson);
}

type OfferChain = {
  priceFrom?: number | null;
  is247?: boolean | null;
  freeTrial?: boolean | null;
  dayPass?: boolean | null;
  hoursWeekday?: string | null;
  hoursWeekend?: string | null;
  membershipsJson?: string | null;
  servicesJson?: string | null;
};

export function resolveGymOffer(
  gym: Gym | null | undefined,
  chain: OfferChain | null | undefined,
) {
  const priceFrom =
    gym?.priceFrom != null ? gym.priceFrom : (chain?.priceFrom ?? null);
  const is247 = gym?.is247 != null ? gym.is247 : (chain?.is247 ?? null);
  const freeTrial =
    gym?.freeTrial != null ? gym.freeTrial : (chain?.freeTrial ?? null);
  const dayPass =
    gym?.dayPass != null ? gym.dayPass : (chain?.dayPass ?? null);
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
      : parseMembershipsJson(chain?.membershipsJson);
  const gymServices = parseServicesJson(gym?.servicesJson);
  const services =
    gymServices.length > 0
      ? gymServices
      : parseServicesJson(chain?.servicesJson);
  return {
    priceFrom,
    is247,
    freeTrial,
    dayPass,
    hoursWeekday,
    hoursWeekend,
    memberships,
    services,
  };
}
