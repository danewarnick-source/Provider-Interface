import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  armClientListReturn,
  clientListReturnView,
  rememberClientList,
  takeClientListReturn,
} from "./list-return.ts";

describe("clients list return (← All clients)", () => {
  it("restores the remembered list once, and only after the back link armed it", () => {
    assert.equal(clientListReturnView(), "active");
    assert.equal(takeClientListReturn(), null);
    const state = {
      view: "discharged" as const,
      search: "joby",
      code: "SLN",
      homeId: null,
      staffId: null,
    };
    rememberClientList(state);
    assert.equal(takeClientListReturn(), null, "the main menu's Clients link starts plain");
    assert.equal(clientListReturnView(), "discharged");
    armClientListReturn();
    assert.deepEqual(takeClientListReturn(), state);
    assert.equal(takeClientListReturn(), null, "only once");
  });
});
