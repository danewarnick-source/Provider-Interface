# PR 332 import correction

The checked-in draft catalog is regenerated from the revised workbook with SHA-256 `aba9f6c4debc0b19e207a55f1a2f1fc2b3397d94f8f18a52c6fbc6b0f9d2dbd6`.

Run `python scripts/import-dhhs91172-workbook.py /path/to/DHHS91172_SOW_Labeled_Catalog.xlsx` to reproduce the JSON exports. The exporter verifies the source hash and does not include the spreadsheet header as a requirement.

The runtime now loads 760 parents, 607 source-linked elements and 1,367 canonical requirement rows. All 40 parent columns are preserved in each rule's `workbookRow`. Referenced setup facts resolve against all 85 workbook fact definitions. Full Source_index content is retained as an archive and does not grant publication permission.

The four handling labels are descriptive defaults. Narrative deadlines, alternatives and renewal instructions remain source metadata pending explicit reviewed predicates and evidence acceptance. Import success is not activation, legal approval, or evidence of complete UI implementation. All rules remain draft/not_published; the activation lock is unchanged.

Release_Gaps contains the workbook's actual 12 open issues. Existing encoded pilot fixtures remain separate from the complete catalog. `Core_Rule_Logic_source.json` preserves the workbook's original logic guidance separately from those pilot fixtures.

Validation: 21 catalog-loader and publication tests pass. Tests now require the actual committed catalog to be loaded and reject headers, duplicate IDs, unresolved fact references, and orphan elements. Full application typecheck/build and live signup/UI walkthrough must still run in the repository CI/preview environment; dependencies for a full build were unavailable in the review workspace.

Before live activation: resolve the workbook's Release_Gaps, implement and review typed per-rule conditions/timing/acceptance, verify the required agency setup gate in both frontend and backend, and exercise synthetic end-to-end flows. Do not remove activation locks or infer missing legal requirements to make tests pass.
