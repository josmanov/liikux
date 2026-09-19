export type GymCardMock = {
  distanceKm: number;
  priceFrom: number;
  is247: boolean;
  freeTrial: boolean;
  openNow: boolean;
};

const bySlug: Record<string, GymCardMock> = {
  "elixia-redi": {
    distanceKm: 1.2,
    priceFrom: 49,
    is247: false,
    freeTrial: true,
    openNow: true,
  },
  "elixia-itis": {
    distanceKm: 4.8,
    priceFrom: 49,
    is247: false,
    freeTrial: true,
    openNow: true,
  },
  "easyfit-kamppi": {
    distanceKm: 0.6,
    priceFrom: 29,
    is247: true,
    freeTrial: true,
    openNow: true,
  },
  "easyfit-tikkurila": {
    distanceKm: 12.4,
    priceFrom: 29,
    is247: true,
    freeTrial: false,
    openNow: true,
  },
  "fressi-tapiola": {
    distanceKm: 7.1,
    priceFrom: 59,
    is247: false,
    freeTrial: true,
    openNow: false,
  },
  "liikku-pasila": {
    distanceKm: 2.3,
    priceFrom: 39,
    is247: false,
    freeTrial: false,
    openNow: true,
  },
};

const fallback: GymCardMock = {
  distanceKm: 3.5,
  priceFrom: 35,
  is247: false,
  freeTrial: false,
  openNow: true,
};

export function getGymCardMock(slug: string): GymCardMock {
  return bySlug[slug] ?? fallback;
}

export function formatDistanceKm(km: number) {
  return `${km.toFixed(1).replace(".", ",")} km`;
}

export function formatPriceFrom(eur: number) {
  return `alk. ${eur} €/kk`;
}
