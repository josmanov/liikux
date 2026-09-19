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

function cardMockFromSlug(slug: string): GymCardMock {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  const prices = [29, 35, 39, 49, 59];
  return {
    distanceKm: Math.round((0.5 + (h % 140) / 10) * 10) / 10,
    priceFrom: prices[h % prices.length],
    is247: h % 3 === 0,
    freeTrial: h % 2 === 0,
    openNow: h % 5 !== 0,
  };
}

export function getGymCardMock(slug: string): GymCardMock {
  return bySlug[slug] ?? cardMockFromSlug(slug);
}

export function formatDistanceKm(km: number) {
  return `${km.toFixed(1).replace(".", ",")} km`;
}

export function formatPriceFrom(eur: number) {
  return `alk. ${eur} €/kk`;
}
