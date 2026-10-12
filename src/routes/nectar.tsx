import { createFileRoute } from "@tanstack/react-router";
import { PiNectarPage } from "@/components/pi-landing/pi-nectar-page";
import { PI_NECTAR_PAGE_DESCRIPTION, PI_NECTAR_PAGE_TITLE } from "@/lib/pi-landing";

export const Route = createFileRoute("/nectar")({
  head: () => ({
    meta: [
      { title: PI_NECTAR_PAGE_TITLE },
      { name: "description", content: PI_NECTAR_PAGE_DESCRIPTION },
      { property: "og:title", content: PI_NECTAR_PAGE_TITLE },
      { property: "og:description", content: PI_NECTAR_PAGE_DESCRIPTION },
    ],
  }),
  component: NectarRoute,
});

function NectarRoute() {
  return <PiNectarPage />;
}
