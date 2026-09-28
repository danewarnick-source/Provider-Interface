import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isTeamMemberProfileTab,
  PROFILE_TAB_LABEL,
  resolveProfileTab,
  TEAM_MEMBER_PROFILE_TABS,
  visibleProfileTabs,
} from "./profile-tabs.ts";

describe("team member profile tabs", () => {
  it("accepts the five addresses and nothing else", () => {
    assert.deepEqual(
      [...TEAM_MEMBER_PROFILE_TABS],
      ["profile", "file", "caseload", "notes", "activity"],
    );
    for (const tab of TEAM_MEMBER_PROFILE_TABS) assert.equal(isTeamMemberProfileTab(tab), true);
    assert.equal(isTeamMemberProfileTab("personnel"), false);
    assert.equal(isTeamMemberProfileTab("record"), false);
    assert.equal(isTeamMemberProfileTab(1), false);
    assert.equal(isTeamMemberProfileTab(undefined), false);
  });

  it("labels read Profile | File | Caseload | Notes | Activity", () => {
    assert.deepEqual(
      TEAM_MEMBER_PROFILE_TABS.map((t) => PROFILE_TAB_LABEL[t]),
      ["Profile", "File", "Caseload", "Notes", "Activity"],
    );
  });

  it("Notes only with Hire & deactivate View", () => {
    assert.deepEqual(visibleProfileTabs({ canSeeNotes: true }), [...TEAM_MEMBER_PROFILE_TABS]);
    assert.deepEqual(visibleProfileTabs({ canSeeNotes: false }), [
      "profile",
      "file",
      "caseload",
      "activity",
    ]);
  });

  it("draws every tab; missing or hidden tabs land on Profile", () => {
    assert.equal(resolveProfileTab(undefined), "profile");
    for (const tab of TEAM_MEMBER_PROFILE_TABS) assert.equal(resolveProfileTab(tab), tab);
    assert.equal(resolveProfileTab("notes", { canSeeNotes: false }), "profile");
    assert.equal(resolveProfileTab("caseload", { canSeeNotes: false }), "caseload");
  });
});
