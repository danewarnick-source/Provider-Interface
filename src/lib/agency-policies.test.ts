import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  policyMediaKind,
  staffLooksLikeDriver,
  staffMatchesPolicyAudience,
} from "./agency-policies.ts";

describe("agency policy audience", () => {
  it("everyone matches any staff", () => {
    assert.equal(
      staffMatchesPolicyAudience({ kind: "everyone" }, { staffTypeKeys: [] }),
      true,
    );
  });

  it("drivers match transporter, MTP, or driver job wording", () => {
    assert.equal(
      staffLooksLikeDriver({ staffTypeKeys: ["DSP"], isTransporter: true }),
      true,
    );
    assert.equal(
      staffLooksLikeDriver({ staffTypeKeys: [], assignedServiceCodes: ["MTP"] }),
      true,
    );
    assert.equal(
      staffLooksLikeDriver({ staffTypeKeys: ["driver"], assignedServiceCodes: [] }),
      true,
    );
    assert.equal(
      staffLooksLikeDriver({ staffTypeKeys: ["DSP"], assignedServiceCodes: ["SLN"] }),
      false,
    );
  });

  it("job code matches staff type or assigned service code", () => {
    assert.equal(
      staffMatchesPolicyAudience(
        { kind: "job_code", jobCode: "sln" },
        { staffTypeKeys: ["SLN"] },
      ),
      true,
    );
    assert.equal(
      staffMatchesPolicyAudience(
        { kind: "job_code", jobCode: "HHS" },
        { staffTypeKeys: ["DSP"], assignedServiceCodes: ["HHS"] },
      ),
      true,
    );
    assert.equal(
      staffMatchesPolicyAudience(
        { kind: "job_code", jobCode: "SEI" },
        { staffTypeKeys: ["DSP"], assignedServiceCodes: ["SLN"] },
      ),
      false,
    );
  });
});

describe("agency policy files", () => {
  it("classifies video, image, and PDF for the staff viewer", () => {
    assert.equal(policyMediaKind("video/mp4", "clip.mp4"), "video");
    assert.equal(policyMediaKind("image/png", "slide.png"), "image");
    assert.equal(policyMediaKind("application/pdf", "book.pdf"), "pdf");
    assert.equal(policyMediaKind(null, "deck.pptx"), "other");
  });
});
