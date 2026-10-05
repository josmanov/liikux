import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { chains, gyms } from "../db/schema.js";

export async function fetchListedGymsWithChain() {
  const rows = await db
    .select({
      id: gyms.id,
      slug: gyms.slug,
      name: gyms.name,
      city: gyms.city,
      address: gyms.address,
      chainId: gyms.chainId,
      lat: gyms.lat,
      lng: gyms.lng,
      priceFrom: gyms.priceFrom,
      is247: gyms.is247,
      hoursWeekday: gyms.hoursWeekday,
      hoursWeekend: gyms.hoursWeekend,
      membershipsJson: gyms.membershipsJson,
      chainRowId: chains.id,
      chainSlug: chains.slug,
      chainName: chains.name,
      chainImage: chains.image,
      chainLogoFit: chains.logoFit,
      chainLogoClass: chains.logoClass,
      chainPricingMode: chains.pricingMode,
      chainPriceFrom: chains.priceFrom,
      chainIs247: chains.is247,
      chainFreeTrial: chains.freeTrial,
      chainDayPass: chains.dayPass,
      chainAudienceJson: chains.audienceJson,
    })
    .from(gyms)
    .leftJoin(chains, eq(gyms.chainId, chains.id))
    .where(eq(gyms.listed, true));

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    city: r.city,
    address: r.address,
    chainId: r.chainId,
    lat: r.lat,
    lng: r.lng,
    priceFrom: r.priceFrom,
    is247: r.is247,
    hoursWeekday: r.hoursWeekday,
    hoursWeekend: r.hoursWeekend,
    membershipsJson: r.membershipsJson,
    chain: r.chainRowId
      ? {
          id: r.chainRowId,
          slug: r.chainSlug!,
          name: r.chainName!,
          image: r.chainImage!,
          logoFit: r.chainLogoFit,
          logoClass: r.chainLogoClass,
          pricingMode: r.chainPricingMode,
          priceFrom: r.chainPriceFrom,
          is247: r.chainIs247,
          freeTrial: r.chainFreeTrial,
          dayPass: r.chainDayPass,
          audienceJson: r.chainAudienceJson,
        }
      : null,
  }));
}
