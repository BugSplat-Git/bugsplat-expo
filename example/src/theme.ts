// Shared design tokens for the demo app. Extracted from App.tsx so the feedback
// sheet and the main screen draw from one palette. Token names are unchanged
// from the original inline `COLORS` block — only the green/feedback-flow
// tokens at the bottom are new.
export const COLORS = {
  screenBg: '#FAF8F2',
  cardBg: '#FFFFFF',
  cardStroke: '#ECEAE2',
  textPrimary: '#0E1116',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  link: '#1F73E8',
  badgeBg: '#F1EFE8',
  connectedBg: '#FFFFFF',
  connectedStroke: '#E4E2DA',
  connectedDot: '#22C55E',
  activityCrash: '#1F73E8',
  activityError: '#E5B142',
  activityCrashWithCause: '#E5B142',
  activityFeedback: '#22C55E',
  activityHang: '#E5B142',

  // Feedback flow — green accent, matching the redesigned mockups. Kept
  // separate from the blue `link` accent the rest of the app uses.
  primary: '#4E9E78',
  primaryPressed: '#438866',
  // Pale-green check badge on the thank-you screen.
  checkBg: '#E4F0E9',
  checkBorder: '#BFE0CD',
  // Required-field asterisk.
  asterisk: '#E5484D',
};
