/**
 * Legal pages (terms, privacy, cookies) are plain data: a title, an
 * "updated" date and a list of sections. LegalPage.tsx renders them.
 * Edit the texts in fi.ts / en.ts; keep both languages in sync.
 */
export type LegalSection = {
  h: string;
  p?: string[];
  list?: string[];
  table?: { head: string[]; rows: string[][] };
};

export type LegalDoc = {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
};

export type LegalSlug = "terms" | "privacy" | "cookies";

/**
 * Who runs Liikux. GDPR requires the controller's name and contact details.
 * TODO (owner): put your full name or company name + business ID here.
 */
export const LEGAL_OWNER = "Liikux";
export const LEGAL_EMAIL = "hello@liikux.fi";
export const LEGAL_UPDATED_FI = "15.11.2026";
export const LEGAL_UPDATED_EN = "15 November 2026";
