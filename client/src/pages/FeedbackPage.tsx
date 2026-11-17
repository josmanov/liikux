import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { BackLink } from "../nav/backNav";
import { ArrowLeft, Building2, CircleCheck, MessageSquarePlus, MessagesSquare, TriangleAlert } from "lucide-react";
import { API } from "../data/apiBase";
import { pathGym, pathHome, type FeedbackType } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import { usePageMeta } from "../seo/usePageMeta";
import "./FeedbackPage.css";

/**
 * /fi/palaute (and /en/feedback)
 *
 *   ?type=suggest  → suggest a new gym
 *   ?type=error    → report wrong details (add &gym=<slug> to tie it to a gym)
 *   ?type=feedback → anything else
 *   ?type=business → a gym owner or chain getting in touch (email is required)
 *
 * Sends a POST to /api/feedback; messages are stored in the `feedback` table.
 */
type Status = "idle" | "sending" | "sent" | "failed";

function readType(raw: string | null): FeedbackType {
  return raw === "suggest" || raw === "error" || raw === "business" ? raw : "feedback";
}

function FeedbackPage() {
  const { lang, t } = useLang();
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const type = readType(params.get("type"));
  const gymSlug = params.get("gym") ?? "";
  const [gymLabel, setGymLabel] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const title =
    type === "suggest"
      ? t("fbTitleSuggest")
      : type === "error"
        ? t("fbTitleError")
        : type === "business"
          ? t("fbTitleBusiness")
          : t("fbTitleFeedback");
  usePageMeta({ title: `${title} | Liikux`, description: t("fbLead"), path: pathname });

  // When reporting an error about a specific gym, show its name.
  useEffect(() => {
    if (!gymSlug) return;
    fetch(`${API}/api/gyms/${encodeURIComponent(gymSlug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => g?.name && setGymLabel(`${g.name}, ${g.city ?? ""}`.replace(/, $/, "")))
      .catch(() => {});
  }, [gymSlug]);

  function setType(next: FeedbackType) {
    const p = new URLSearchParams(params);
    p.set("type", next);
    setParams(p, { replace: true });
    setStatus("idle");
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      type,
      gymSlug: gymSlug || undefined,
      gymName: form.get("gymName") || gymLabel || undefined,
      place: form.get("place") || undefined,
      url: form.get("url") || undefined,
      message: form.get("message") || "",
      email: form.get("email") || undefined,
      website: form.get("website") || undefined, // honeypot (hidden)
      lang,
    };
    setStatus("sending");
    try {
      const r = await fetch(`${API}/api/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      setStatus(r.ok ? "sent" : "failed");
    } catch {
      setStatus("failed");
    }
  }

  const types: Array<[FeedbackType, string, typeof MessageSquarePlus]> = [
    ["suggest", t("fbTypeSuggest"), MessageSquarePlus],
    ["error", t("fbTypeError"), TriangleAlert],
    ["feedback", t("fbTypeFeedback"), MessagesSquare],
    ["business", t("fbTypeBusiness"), Building2],
  ];

  return (
    <main className="fb load-reveal">
      <div className="fb-inner">
        <BackLink
          className="fb-back"
          fallbackTo={gymSlug ? pathGym(lang, gymSlug) : pathHome(lang)}
          fallbackLabel={gymSlug && gymLabel ? gymLabel : "Liikux"}
        >
          {(label) => (
            <>
              <ArrowLeft size={16} strokeWidth={2.4} aria-hidden="true" />
              {label}
            </>
          )}
        </BackLink>
        <h1 className="fb-title">{title}</h1>
        <p className="fb-lead">{t("fbLead")}</p>

        {status === "sent" ? (
          <div className="fb-done" role="status">
            <CircleCheck size={22} strokeWidth={2.4} aria-hidden="true" />
            {t("fbThanks")}
          </div>
        ) : (
          <form className="fb-form" onSubmit={onSubmit}>
            <fieldset className="fb-types is-wide">
              <legend>{t("fbType")}</legend>
              {types.map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  className={id === type ? "chip is-on" : "chip"}
                  aria-pressed={id === type}
                  onClick={() => setType(id)}
                >
                  <Icon size={15} strokeWidth={2.4} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </fieldset>

            {type === "suggest" ? (
              <>
                <label className="fb-field">
                  <span>{t("fbGymName")} *</span>
                  <input name="gymName" required maxLength={200} />
                </label>
                <label className="fb-field">
                  <span>{t("fbGymCity")}</span>
                  <input name="place" maxLength={200} />
                </label>
                <label className="fb-field">
                  <span>{t("fbGymUrl")}</span>
                  <input name="url" type="url" inputMode="url" maxLength={500} placeholder="https://" />
                </label>
              </>
            ) : null}

            {(type === "error" && !gymSlug) || type === "business" ? (
              <label className="fb-field">
                <span>{t("fbAboutGym")}</span>
                <input name="gymName" maxLength={200} />
              </label>
            ) : null}

            {type === "error" && gymSlug && gymLabel ? (
              <p className="fb-about is-wide">
                {t("fbAboutGym")}: <strong>{gymLabel}</strong>
              </p>
            ) : null}

            <label className="fb-field">
              <span>
                {type === "business" ? t("fbEmailBusiness") + " *" : t("fbEmail")}
              </span>
              <input
                name="email"
                type="email"
                inputMode="email"
                maxLength={200}
                autoComplete="email"
                required={type === "business"}
              />
            </label>

            <label className="fb-field is-wide">
              <span>
                {t("fbMessage")}
                {type === "suggest" ? "" : " *"}
              </span>
              <textarea
                name="message"
                rows={3}
                maxLength={4000}
                required={type !== "suggest"}
                placeholder={type === "error" ? t("fbMessageHintError") : ""}
              />
            </label>

            {/* Honeypot: hidden from people, bots fill it in and get ignored. */}
            <input className="fb-hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />

            {status === "failed" ? <p className="fb-error is-wide" role="alert">{t("fbFailed")}</p> : null}

            <button className="btn btn-primary fb-submit" type="submit" disabled={status === "sending"}>
              {status === "sending" ? t("fbSending") : t("fbSend")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default FeedbackPage;
