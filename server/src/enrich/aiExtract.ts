import { htmlToText } from "./fetchPage.js";
import { emptyExtracted, type Extracted } from "./adapters.js";

export type AiExtractInput = {
  gymName: string;
  city: string;
  chainName?: string;
  pageTexts: { url: string; text: string }[];
};

function parseEuroLoose(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 10 || n > 200) return null;
  return n;
}

export function hasAiKey() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function aiExtractOffer(input: AiExtractInput): Promise<{
  extracted: Extracted;
  sourceUrl: string | null;
  rawNote: string | null;
} | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  if (!input.pageTexts.length) return null;

  const chunks = input.pageTexts
    .map((p) => {
      const t = p.text.slice(0, 7000);
      return `URL: ${p.url}\n${t}`;
    })
    .join("\n\n----\n\n")
    .slice(0, 18000);

  const prompt = `Olet suomalainen kuntosalidatan poimija. Etsi NORMAALI aikuisen jäsenyyden kuukausihinta (ei opiskelija/eläkeläinen/kampanja/kertakäynti/1.kk) ja kuntosalin aukiolo jäsenille (ei pelkkä asiakaspalvelutiski jos jäsenkulku löytyy).
Palauta VAIN JSON:
{"priceFrom":number|null,"priceLabel":string|null,"hoursWeekday":string|null,"hoursWeekend":string|null,"is247":boolean|null,"sourceUrl":string|null,"confidence":"high"|"medium"|"low","note":string|null}
Aukiolo muodossa "06:00–23:00" tai "24/7". Jos et ole varma, null.

Sali: ${input.gymName}
Kaupunki: ${input.city}
Ketju: ${input.chainName ?? "-"}

Sisältö:
${chunks}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Poimi kuntosalin hinta ja aukiolo. Vastaa vain JSONilla.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return {
        extracted: emptyExtracted(),
        sourceUrl: null,
        rawNote: `ai_http_${res.status}:${err.slice(0, 80)}`,
      };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as {
      priceFrom?: number | string | null;
      priceLabel?: string | null;
      hoursWeekday?: string | null;
      hoursWeekend?: string | null;
      is247?: boolean | null;
      sourceUrl?: string | null;
      confidence?: string | null;
      note?: string | null;
    };
    if (parsed.confidence === "low") {
      return {
        extracted: emptyExtracted(),
        sourceUrl: null,
        rawNote: `ai_low_confidence:${parsed.note ?? ""}`,
      };
    }
    const price =
      typeof parsed.priceFrom === "number"
        ? parseEuroLoose(String(parsed.priceFrom))
        : parseEuroLoose(parsed.priceFrom == null ? null : String(parsed.priceFrom));
    const out = emptyExtracted();
    out.priceFrom = price;
    out.priceLabel = parsed.priceLabel ?? (price != null ? "AI" : null);
    out.hoursWeekday = parsed.hoursWeekday ? String(parsed.hoursWeekday) : null;
    out.hoursWeekend = parsed.hoursWeekend
      ? String(parsed.hoursWeekend)
      : out.hoursWeekday;
    out.is247 =
      parsed.is247 === true ||
      (out.hoursWeekday != null && /24\s*\/\s*7/i.test(out.hoursWeekday));
    if (out.is247) {
      out.hoursWeekday = "24/7";
      out.hoursWeekend = "24/7";
    }
    if (out.priceFrom != null) {
      out.memberships = [
        {
          name: out.priceLabel ?? "Jäsenyys",
          priceEur: out.priceFrom,
          note: "AI",
        },
      ];
    }
    return {
      extracted: out,
      sourceUrl: parsed.sourceUrl ?? input.pageTexts[0]?.url ?? null,
      rawNote: parsed.note ?? null,
    };
  } catch (e) {
    return {
      extracted: emptyExtracted(),
      sourceUrl: null,
      rawNote: `ai_error:${String(e).slice(0, 100)}`,
    };
  }
}

export function pagesToAiInput(
  pages: { url: string; html: string }[],
): { url: string; text: string }[] {
  return pages.map((p) => ({
    url: p.url,
    text: htmlToText(p.html),
  }));
}
