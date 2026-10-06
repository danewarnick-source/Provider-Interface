import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isTeamMemberProfileTab,
  PROFILE_TAB_LABEL,
  profileTabSearchValue,
  resolveProfileTab,
  TEAM_MEMBER_PROFILE_TABS,
  visibleProfileTabs,
} from "./profile-tabs.ts";

describe("team member profile sections", () => {
  it("accepts the seven addresses and nothing else", () => {
    assert.deepEqual(
      [...TEAM_MEMBER_PROFILE_TABS],
      ["overview", "profile", "file", "training", "caseload", "notes", "activity"],
    );
    for (const tab of TEAM_MEMBER_PROFILE_TABS) assert.equal(isTeamMemberProfileTab(tab), true);
    assert.equal(isTeamMemberProfileTab("personnel"), false);
    assert.equal(isTeamMemberProfileTab("record"), false);
    assert.equal(isTeamMemberProfileTab(1), false);
    assert.equal(isTeamMemberProfileTab(undefined), false);
  });

  it("labels read Overview · Profile · Team member file · Training · Caseload · Notes · Activity", () => {
    assert.deepEqual(
      TEAM_MEMBER_PROFILE_TABS.map((t) => PROFILE_TAB_LABEL[t]),
      ["Overview", "Profile", "Team member file", "Training", "Caseload", "Notes", "Activity"],
    );
  });

  it("Notes only with Hire & deactivate View", () => {
    assert.deepEqual(visibleProfileTabs({ canSeeNotes: true }), [...TEAM_MEMBER_PROFILE_TABS]);
    assert.deepEqual(visibleProfileTabs({ canSeeNotes: false }), [
      "overview",
      "profile",
      "file",
      "training",
      "caseload",
      "activity",
    ]);
  });

  it("draws every tab; missing or hidden tabs land on Overview", () => {
    assert.equal(resolveProfileTab(undefined), "overview");
    for (const tab of TEAM_MEMBER_PROFILE_TABS) assert.equal(resolveProfileTab(tab), tab);
    assert.equal(resolveProfileTab("notes", { canSeeNotes: false }), "overview");
    assert.equal(resolveProfileTab("caseload", { canSeeNotes: false }), "caseload");
    // Old links keep working.
    assert.equal(resolveProfileTab("file"), "file");
    assert.equal(resolveProfileTab("profile"), "profile");
  });

  it("Overview is left out of the URL; every other tab is written", () => {
    assert.equal(profileTabSearchValue("overview"), undefined);
    assert.equal(profileTabSearchValue("profile"), "profile");
    assert.equal(profileTabSearchValue("file"), "file");
  });
});
