import { createServerFn } from "@tanstack/react-start";

/**
 * Public server fn — Have I Been Pwned range lookup (same check Auth uses
 * for "Password is known to be weak and easy to guess…").
 *
 * Client sends only the SHA-1 prefix (k-anonymity). The password never
 * leaves the browser for this pre-check. Fail-open on HIBP errors so a
 * network blip does not invent a new signup rule.
 */
export const checkPasswordPwnedRange = createServerFn({ method: "POST" })
  .inputValidator((input: { sha1Prefix: string }) => {
    const sha1Prefix = String(input?.sha1Prefix ?? "")
      .trim()
      .toUpperCase();
    if (!/^[A-F0-9]{5}$/.test(sha1Prefix)) {
      throw new Error("Invalid prefix");
    }
    return { sha1Prefix };
  })
  .handler(async ({ data }) => {
    try {
      const res = await fetch(`https://api.pwnedpasswords.com/range/${data.sha1Prefix}`, {
        headers: {
          "Add-Padding": "true",
          "User-Agent": "ProviderInterface-signup",
        },
      });
      if (!res.ok) return { range: "" };
      return { range: await res.text() };
    } catch {
      return { range: "" };
    }
  });
