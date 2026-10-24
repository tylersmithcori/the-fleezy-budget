import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TSC Budgeting Tool" },
      { name: "description", content: "Plan and track your TSC budget." },
      { property: "og:title", content: "TSC Budgeting Tool" },
      { property: "og:description", content: "Plan and track your TSC budget." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <iframe
      src="/budget.html"
      title="TSC Budgeting Tool"
      className="fixed inset-0 h-screen w-screen border-0"
    />
  );
}
