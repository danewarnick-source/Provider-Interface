-- B1: rule_settings now holds the agency's strength per scheduler rule
-- (src/lib/scheduler/rules-strength.ts). Nothing read the old shape; the one row is {}.
COMMENT ON COLUMN public.org_shift_behavior_settings.rule_settings IS
  'Scheduler rule strengths: {"<rule>": "off" | "warn" | "reason" | "block"}. Missing = the rule''s default.';
