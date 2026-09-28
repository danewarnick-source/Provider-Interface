import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isTeamMemberProfileTab,
  RENDERED_PROFILE_TABS,
  resolveProfileTab,
  TEAM_MEMBER_PROFILE_TABS,
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

  it("draws Profile, Team member file, and Activity; everything else lands on Profile", () => {
    assert.deepEqual([...RENDERED_PROFILE_TABS], ["profile", "file", "activity"]);
    assert.equal(resolveProfileTab(undefined), "profile");
    assert.equal(resolveProfileTab("profile"), "profile");
    assert.equal(resolveProfileTab("file"), "file");
    assert.equal(resolveProfileTab("activity"), "activity");
    assert.equal(resolveProfileTab("caseload"), "profile");
    assert.equal(resolveProfileTab("notes"), "profile");
  });
});
