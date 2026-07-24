import { radius, spacing } from './tokens';

export const componentTokens = {
  button: { minHeight: 52, radius: radius.md, paddingHorizontal: spacing.lg },
  card: { radius: radius.lg, padding: spacing.md, gap: spacing.sm },
  input: { minHeight: 56, radius: radius.md },
  badge: { minHeight: 28, radius: radius.full },
  bottomNavigation: { minHeight: 72 },
  touchTarget: { minimum: 48 },
} as const;
