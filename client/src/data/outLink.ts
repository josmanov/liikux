import { API } from "./apiBase";

/** Where on the page the link is. Shown in the click numbers on /admin/data. */
export type OutLinkPlace = "button" | "contacts" | "bar";

/**
 * A link to a gym's own website that goes through our server first
 * (/api/go/<slug>), so the click is counted. The server then sends the
 * visitor on to the address saved for that gym.
 */
export function gymSiteLink(gymSlug: string, place: OutLinkPlace) {
  return `${API}/api/go/${encodeURIComponent(gymSlug)}?src=${place}`;
}
