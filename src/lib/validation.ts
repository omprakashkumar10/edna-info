// Synchronized directly with firebase-blueprint.json schema bounds
export const BLUEPRINT_LIMITS = {
  UID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  USERNAME_PATTERN: /^[a-zA-Z0-9_.-]+$/,
  FULL_NAME_MIN: 2,
  FULL_NAME_MAX: 120,
  USERNAME_MIN: 2,
  USERNAME_MAX: 60,
  EMAIL_MAX: 200,
  MOBILE_MAX: 32,
  COUNTRY_MAX: 100,
  STATE_MAX: 100,
  INSTITUTION_MAX: 200,
  DEPARTMENT_MAX: 200,
  RESEARCH_FIELD_MAX: 200,
  PHOTO_URL_MAX: 500,
  NOTIFICATION_TITLE_MAX: 200,
  NOTIFICATION_MESSAGE_MAX: 1000,
  AUDIT_DETAILS_MAX: 1000,
  APP_NAME_MAX: 120,
  TAGLINE_MAX: 200,
} as const;

export const USER_TYPES = [
  'Student',
  'Research Scholar',
  'Scientist',
  'Professor',
  'Environmental Researcher',
  'Biodiversity Expert',
  'Organisation',
  'Other',
] as const;

export function evaluatePasswordStrength(password: string): {
  score: number;
  label: 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  checks: { length: boolean; upper: boolean; lower: boolean; number: boolean; symbol: boolean };
} {
  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const label = score <= 2 ? 'Weak' : score === 3 ? 'Fair' : score === 4 ? 'Strong' : 'Very Strong';
  return { score, label, checks };
}

export function clampString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}
