import { createFileRoute } from "@tanstack/react-router";
import { BudgetAccount } from '@/components/budget-account';

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fleezy Budget" },
      { name: "description", content: "Plan and track your Fleezy Budget." },
      { property: "og:title", content: "Fleezy Budget" },
      { property: "og:description", content: "Plan and track your Fleezy Budget." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <BudgetAccount />;
}
