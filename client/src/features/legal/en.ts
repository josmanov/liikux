import { LEGAL_EMAIL, LEGAL_OWNER, LEGAL_UPDATED_EN, type LegalDoc, type LegalSlug } from "./types";

const updated = `Updated ${LEGAL_UPDATED_EN}`;

export const LEGAL_EN: Record<LegalSlug, LegalDoc> = {
  terms: {
    title: "Terms of use",
    updated,
    intro: "These terms apply to the use of liikux.fi. By using the service you accept them.",
    sections: [
      {
        h: "1. The service",
        p: [
          `Liikux (liikux.fi) is a free, independent service for finding and comparing gyms in Finland. It is run by ${LEGAL_OWNER} (contact: ${LEGAL_EMAIL}).`,
          "No account is needed. Liikux does not sell memberships and is not a party to any agreement between you and a gym. Memberships, trials and payments are always agreed directly with the gym.",
        ],
      },
      {
        h: "2. Data sources and accuracy",
        p: [
          "Basic gym data (name, address, location) comes from the open data of the Lipas sports facility database (University of Jyväskylä, licence CC BY 4.0) and OpenStreetMap (© OpenStreetMap contributors, ODbL).",
          "Prices, opening hours, trials, offers and services are collected from the gyms’ and chains’ own websites. They can change quickly and may contain errors or gaps.",
          "The information is indicative. Always confirm the price, contract terms and opening hours with the gym before signing up. Liikux is not responsible for the accuracy or timeliness of the information.",
          "If you spot an error, please report it with the feedback form (Report an error).",
        ],
      },
      {
        h: "3. Links to other sites",
        p: [
          "The service links to gym websites and other services (e.g. Google Maps). Liikux is not responsible for their content, availability or privacy practices.",
        ],
      },
      {
        h: "4. Acceptable use",
        p: ["You may use the service to find and compare gyms for yourself. You must not:"],
        list: [
          "collect the content automatically or in bulk (e.g. scraping) without written permission",
          "overload, disrupt or try to break into the service",
          "knowingly send false, offensive or unlawful content through the feedback form",
          "present the service or its content as your own",
        ],
      },
      {
        h: "5. Feedback and suggestions",
        p: [
          "You can suggest a new gym or report an error with the feedback form. What you send may be used to add or correct information in the service. We are not obliged to publish suggestions.",
          "Please do not send sensitive personal data through the form. The privacy notice explains how personal data is handled.",
        ],
      },
      {
        h: "6. Intellectual property",
        p: [
          "The design, code and content created by Liikux belong to the operator of the service. Gym chain names and logos belong to their owners and are used only to identify the chains. Open data sources are listed in section 2.",
        ],
      },
      {
        h: "7. Limitation of liability",
        p: [
          "The service is provided as is and free of charge. We do not guarantee that it is always available or error-free. Liikux is not liable for damages arising from the use of the information, such as a gym’s price or contract terms, except where mandatory law requires otherwise.",
        ],
      },
      {
        h: "8. Changes",
        p: [
          "We may change or discontinue the service and update these terms. The current version and its date are shown on this page. Continuing to use the service after a change means you accept the updated terms.",
        ],
      },
      {
        h: "9. Governing law and contact",
        p: ["These terms are governed by Finnish law.", `Questions about the terms: ${LEGAL_EMAIL}.`],
      },
    ],
  },

  privacy: {
    title: "Privacy notice",
    updated,
    intro:
      "This notice explains what personal data liikux.fi processes, why, who receives it and what rights you have (EU General Data Protection Regulation 2016/679, Articles 13–14).",
    sections: [
      {
        h: "1. Controller",
        p: [`${LEGAL_OWNER}, email ${LEGAL_EMAIL}. Contact this address about anything related to your data.`],
      },
      {
        h: "2. What we process and why",
        table: {
          head: ["Data", "Purpose", "Legal basis", "Retention"],
          rows: [
            [
              "The address or city you search for",
              "Address search and distances. The search text is passed from our server to an address search service (see section 3).",
              "Legitimate interest: providing the feature you asked for",
              "Kept in server memory for up to 24 h to speed up identical searches. Not stored in a database.",
            ],
            [
              "Your location (only if you press “Use my location” and your browser allows it)",
              "Showing nearby gyms and finding the address for the coordinates",
              "Consent (browser permission)",
              "Coordinates are rounded and kept in server memory for up to 24 h. The chosen location is saved only on your device.",
            ],
            [
              "Favourites and chosen location",
              "Remembering your favourites and location",
              "Legitimate interest: the feature you asked for",
              "Only on your own device (browser localStorage) until you delete them",
            ],
            [
              "Feedback form: message, gym details, language, time sent and optional email",
              "Adding new gyms, fixing errors and replying if needed",
              "Legitimate interest; consent for the email address",
              "Up to 24 months, or deleted earlier on request",
            ],
            [
              "Technical data: IP address, browser, requested page and time",
              "Delivering the service, preventing abuse (rate limiting) and troubleshooting",
              "Legitimate interest: security and reliability",
              "Rate limiting keeps it in memory for 1 minute. Provider logs follow their own policies.",
            ],
            [
              "Analytics (Google Analytics 4): pages visited, device and browser data, approximate location",
              "Understanding and improving how the service is used",
              "Consent. Only if you allow analytics in cookie settings.",
              "Cookies up to 2 years (see Cookies). Google keeps data according to the Google Analytics settings.",
            ],
          ],
        },
        p: [
          "We do not ask for your name or create user accounts. We do not sell data or use it for targeted advertising. No automated decisions or profiling with legal effects are made.",
        ],
      },
      {
        h: "3. Who receives data",
        p: ["We use the following providers, only to run the service."],
        list: [
          "Cloudflare, Inc.: site delivery, caching and security (IP address and requests)",
          "Render Services, Inc.: hosting of the server (API)",
          "Neon, Inc.: the database where feedback is stored",
          "Address search: Digitransit (HSL / Fintraffic), Photon (komoot GmbH) and Nominatim (OpenStreetMap Foundation). They receive the search text or rounded coordinates from our server, not your IP address.",
          "CARTO (CartoDB, Inc.): map background. Your browser loads the map directly from CARTO, so CARTO sees your IP address.",
          "Google Fonts (Google Ireland Ltd): the font is loaded from Google, so Google sees your IP address.",
          "Google Analytics (Google Ireland Ltd): only with consent. Google Analytics 4 does not store IP addresses.",
        ],
      },
      {
        h: "4. Transfers outside the EU",
        p: [
          "Some providers (e.g. Cloudflare, Render, Neon, CARTO and Google) may process data in the United States or elsewhere outside the EU/EEA. Transfers rely on the EU–US Data Privacy Framework or the European Commission’s standard contractual clauses.",
        ],
      },
      {
        h: "5. Your rights",
        p: ["You have the right to:"],
        list: [
          "know whether we process data about you and get a copy",
          "have incorrect data corrected",
          "have data deleted or its processing restricted",
          "object to processing based on legitimate interest",
          "withdraw consent at any time, e.g. for analytics in cookie settings (this does not affect earlier processing)",
          "lodge a complaint with the supervisory authority: Office of the Data Protection Ombudsman, tietosuoja.fi",
        ],
      },
      {
        h: "6. Data stored on your device",
        p: [
          "Favourites, your chosen location and your cookie choice are stored only in your browser (localStorage). You can remove them by clearing the site data in your browser. The full list is on the Cookies page.",
        ],
      },
      {
        h: "7. Changes",
        p: ["We update this notice when the service or its providers change. The date is shown at the top of the page."],
      },
    ],
  },

  cookies: {
    title: "Cookies",
    updated,
    intro:
      "Cookies are small text files a site saves in your browser. Liikux also uses your browser’s local storage (localStorage). Below is everything the site stores on your device.",
    sections: [
      {
        h: "Necessary (always on)",
        p: ["Needed for the features you ask for. They stay on your device and are not sent to us or to third parties."],
        table: {
          head: ["Name", "Type", "Purpose", "Duration"],
          rows: [
            ["liikux-cookie-consent", "localStorage", "Remembers your cookie choice", "Until you change it or clear browser data"],
            ["liikux-favorites", "localStorage", "Your favourite gyms", "Until you remove them"],
            ["liikux-location", "localStorage", "Last chosen address or city", "Until you change it or clear browser data"],
          ],
        },
      },
      {
        h: "Analytics (only with consent)",
        p: [
          "If you allow analytics, the site loads Google Analytics 4. Without consent these cookies are not set. When you withdraw consent, the site deletes them.",
        ],
        table: {
          head: ["Name", "Type", "Purpose", "Duration"],
          rows: [
            ["_ga", "Cookie (Google)", "Distinguishes users for statistics", "2 years"],
            ["_ga_<id>", "Cookie (Google)", "Keeps session state", "2 years"],
          ],
        },
      },
      {
        h: "Functional",
        p: ["Cookie settings include a choice for functional cookies. Liikux currently uses no functional cookies; the option is reserved for future features. If any are added, they will be listed here."],
      },
      {
        h: "Third-party content",
        p: [
          "The map (CARTO) and the font (Google Fonts) are loaded from those services, so they receive your IP address. They do not set cookies through Liikux. See the privacy notice for details.",
        ],
      },
      {
        h: "Changing your choice",
        p: [
          "You can change your choice at any time from the Cookie settings link at the bottom of the page. You can also delete all site data in your browser settings; this also removes favourites and your chosen location.",
        ],
      },
    ],
  },
};
