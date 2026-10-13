import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./hive-tickets.functions.ts", import.meta.url), "utf8");

describe("hive-tickets.functions.ts (N2)", () => {
  it("only exports the exec ticket list, create and update functions", () => {
    const exported = [...SRC.matchAll(/^export (?:async )?(?:const|function) (\w+)/gm)].map((m) => m[1]);
    assert.deepEqual(exported, ["listPlatformTickets", "createPlatformTicket", "updatePlatformTicket"]);
  });

  it("no longer files tickets with the service-role client", () => {
    const imports = [...SRC.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(imports, [
      "@tanstack/react-start",
      "zod",
      "@/integrations/supabase/auth-middleware",
    ]);
  });
});
