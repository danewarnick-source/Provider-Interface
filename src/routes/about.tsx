import { createFileRoute } from "@tanstack/react-router";
import { PiAboutPage } from "@/components/pi-landing/pi-about-page";
import { PI_ABOUT_PAGE_DESCRIPTION, PI_ABOUT_PAGE_TITLE } from "@/lib/pi-landing";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: PI_ABOUT_PAGE_TITLE },
      { name: "description", content: PI_ABOUT_PAGE_DESCRIPTION },
      { property: "og:title", content: PI_ABOUT_PAGE_TITLE },
      { property: "og:description", content: PI_ABOUT_PAGE_DESCRIPTION },
    ],
  }),
  component: AboutRoute,
});

function AboutRoute() {
  return <PiAboutPage />;
}
