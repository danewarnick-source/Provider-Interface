# Controlled publication (Soft=none)

Wiring is not publication. All 50 live-key parents are on the obligation engine. `VERIFIED_PUBLICATIONS` stays empty until a human pastes a verified row.

There is no tenant table and no global flip. Soft would need a table to persist approvals outside git; this path does not.

## How one rule gets published

1. Confirm the parent is wired and structurally complete (`canPublish`, still `not_published`). Coverage: `docs/compliance/dhhs91172/COVERAGE_REPORT.md`.
2. Preview — does not write the overlay:

```bash
npm run propose:verified-publication -- --rule REQ-1.8.4 \
  --actor-id dane --actor-label Dane --approved-at 2026-09-15T00:00:00.000Z
```

Named batch (still preview only):

```bash
npm run propose:verified-publication -- --rule REQ-1.8.4 --rule REQ-1.8.5
```

`--wired` prints every structurally complete live-key parent. It does not record them.

3. READY → paste **that one row** (or the named READY batch) into `VERIFIED_PUBLICATIONS` in `src/lib/obligations/draft-rules/verified-publication.ts`.
4. DRAFT → leave unpublished. Reasons come from `applyVerifiedPublication` / `structuralPublicationGaps` (predicates, group, timing, evidence, source, tests, unresolved alternatives/renewals, rule-specific gaps, missing approval).
5. `applyVerifiedPublicationOverlay` publishes only listed rows that pass the gate. Siblings stay draft. `committedPublicationIssues` fails a listed row that cannot publish.

## Do not

- Bulk-fill `VERIFIED_PUBLICATIONS`
- Treat Source_index or catalog-wide Release_Gaps as permission
- Invent PN1/PN2, quarterly evac, or annual-outcome parents
- Restore Accept → `manually_confirmed` here (held until Soft CHECK + Reese)
