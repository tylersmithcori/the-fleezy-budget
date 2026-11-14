import { createFileRoute } from '@tanstack/react-router';
import { PasswordReset } from '@/components/budget-account';
export const Route = createFileRoute('/reset-password')({
  head: () => ({ meta: [
    { title: 'Reset password — Fleezy Budget' },
    { name: 'description', content: 'Reset your Fleezy Budget account password securely.' },
    { property: 'og:title', content: 'Reset password — Fleezy Budget' },
    { property: 'og:description', content: 'Reset your Fleezy Budget account password securely.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }), component: PasswordReset,
});