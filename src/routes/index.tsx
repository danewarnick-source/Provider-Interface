import { createFileRoute } from "@tanstack/react-router";
import { PiMarketingPage } from "@/components/pi-landing/pi-marketing-page";
import { PI_PAGE_DESCRIPTION, PI_PAGE_TITLE } from "@/lib/pi-landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: PI_PAGE_TITLE },
      { name: "description", content: PI_PAGE_DESCRIPTION },
      { property: "og:title", content: PI_PAGE_TITLE },
      { property: "og:description", content: PI_PAGE_DESCRIPTION },
      { name: "twitter:title", content: PI_PAGE_TITLE },
      { name: "twitter:description", content: PI_PAGE_DESCRIPTION },
    ],
  }),
  component: ProviderInterfaceLanding,
});

function ProviderInterfaceLanding() {
  return <PiMarketingPage />;
}
