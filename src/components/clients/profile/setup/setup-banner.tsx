// "Finish setting up <first name>" on the profile of a client added through
// Add client (by hand, from a PCSP or the spreadsheet import) until the setup
// steps are finished. Only people who can edit clients see it.

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setupBannerText } from "@/lib/clients/client-setup";
import { SectionCard } from "@/components/clients/profile/cards/section-card";

export function SetupBanner({ firstName, onOpen }: { firstName: string; onOpen: () => void }) {
  const text = setupBannerText(firstName);
  return (
    <SectionCard
      icon={Sparkles}
      tone="profile"
      title={text.title}
      description={text.line}
      testId="client-setup-banner"
      actions={<Button onClick={onOpen}>{text.title}</Button>}
    />
  );
}
