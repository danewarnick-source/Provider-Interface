import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { memberDisplayName, type MemberProfile } from "./org-member-profiles.ts";

const p = (o: Partial<MemberProfile>): MemberProfile => ({
  id: "u1",
  first_name: null,
  last_name: null,
  full_name: null,
  email: null,
  ...o,
});

describe("memberDisplayName", () => {
  it("prefers full name, then first + last, then email, then fallback", () => {
    assert.equal(memberDisplayName(p({ full_name: " Ana Ruiz ", first_name: "A" })), "Ana Ruiz");
    assert.equal(memberDisplayName(p({ first_name: "Ana", last_name: "Ruiz" })), "Ana Ruiz");
    assert.equal(memberDisplayName(p({ email: "ana@x.org" })), "ana@x.org");
    assert.equal(memberDisplayName(p({}), "u1"), "u1");
  });
});
