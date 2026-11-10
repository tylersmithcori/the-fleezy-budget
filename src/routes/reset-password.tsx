import { createFileRoute } from '@tanstack/react-router';
import { PasswordReset } from '@/components/budget-account';
export const Route = createFileRoute('/reset-password')({
  head: () => ({ meta: [
    { title: 'Reset password — TSC Budgeting Tool' },
    { name: 'description', content: 'Reset your TSC Budgeting Tool account password securely.' },
    { property: 'og:title', content: 'Reset password — TSC Budgeting Tool' },
    { property: 'og:description', content: 'Reset your TSC Budgeting Tool account password securely.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }), component: PasswordReset,
});