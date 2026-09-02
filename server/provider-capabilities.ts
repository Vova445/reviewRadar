export const providerIds = [
  "google",
  "yelp",
  "tripadvisor",
  "facebook",
  "booking",
] as const;

export type ProviderId = (typeof providerIds)[number];

export type ProviderCapability = {
  id: ProviderId;
  name: string;
  mode: "oauth" | "api_key" | "partner_account" | "restricted";
  fullReviewFeed: boolean;
  replies: boolean;
  envKeys: readonly string[];
  noteUk: string;
  noteEn: string;
};

export const providerCapabilities: readonly ProviderCapability[] = [
  {
    id: "google",
    name: "Google Business Profile",
    mode: "oauth",
    fullReviewFeed: true,
    replies: true,
    envKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    noteUk: "Потрібні OAuth 2.0 та схвалений доступ до Business Profile API.",
    noteEn: "OAuth 2.0 and approved Business Profile API access are required.",
  },
  {
    id: "yelp",
    name: "Yelp",
    mode: "api_key",
    fullReviewFeed: false,
    replies: false,
    envKeys: ["YELP_API_KEY"],
    noteUk: "Places API повертає до трьох уривків. Для повного потоку потрібна окрема ліцензія Yelp.",
    noteEn: "Places API returns up to three excerpts. A separate Yelp data license is needed for a full feed.",
  },
  {
    id: "tripadvisor",
    name: "Tripadvisor",
    mode: "api_key",
    fullReviewFeed: false,
    replies: false,
    envKeys: ["TRIPADVISOR_API_KEY"],
    noteUk: "Content API платний, має правила атрибуції та не є owner-review inbox.",
    noteEn: "Content API is paid, requires attribution, and is not an owner review inbox.",
  },
  {
    id: "facebook",
    name: "Facebook",
    mode: "restricted",
    fullReviewFeed: false,
    replies: false,
    envKeys: ["META_APP_ID", "META_APP_SECRET"],
    noteUk: "Доступ до рекомендацій сторінок залежить від актуальної версії Graph API та App Review.",
    noteEn: "Page recommendation access depends on the current Graph API version and App Review.",
  },
  {
    id: "booking",
    name: "Booking.com",
    mode: "partner_account",
    fullReviewFeed: true,
    replies: true,
    envKeys: ["BOOKING_CONNECTIVITY_CLIENT_ID", "BOOKING_CONNECTIVITY_CLIENT_SECRET"],
    noteUk: "Потрібен статус Connectivity Partner, machine account і дозвіл review-api.",
    noteEn: "Connectivity Partner status, a machine account, and review-api permission are required.",
  },
] as const;

export function isProviderConfigured(provider: ProviderCapability) {
  return provider.envKeys.every((key) => Boolean(process.env[key]?.trim()));
}
