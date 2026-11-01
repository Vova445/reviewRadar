export const featureFlags = {
  googleIntegration: process.env.NEXT_PUBLIC_FEATURE_GOOGLE_INTEGRATION === "false" ? false : true,
  yelpIntegration: process.env.NEXT_PUBLIC_FEATURE_YELP_INTEGRATION === "true",
  tripadvisorIntegration: process.env.NEXT_PUBLIC_FEATURE_TRIPADVISOR_INTEGRATION === "true",
  facebookIntegration: process.env.NEXT_PUBLIC_FEATURE_FACEBOOK_INTEGRATION === "true",
  bookingIntegration: process.env.NEXT_PUBLIC_FEATURE_BOOKING_INTEGRATION === "true",
  aiAnalysis: process.env.NEXT_PUBLIC_FEATURE_AI_ANALYSIS === "true",
  anomalyDetection: process.env.NEXT_PUBLIC_FEATURE_ANOMALY_DETECTION === "true",
  actionRecommendations: process.env.NEXT_PUBLIC_FEATURE_ACTION_RECOMMENDATIONS === "true",
  insights: process.env.NEXT_PUBLIC_FEATURE_INSIGHTS === "true",
  alertDelivery: process.env.NEXT_PUBLIC_FEATURE_ALERT_DELIVERY === "true",
  weeklyReports: process.env.NEXT_PUBLIC_FEATURE_WEEKLY_REPORTS === "true",
  dataExport: process.env.NEXT_PUBLIC_FEATURE_DATA_EXPORT === "true",
} as const;

export type FeatureFlag = keyof typeof featureFlags;
export const isFeatureEnabled = (flag: FeatureFlag) => featureFlags[flag];
