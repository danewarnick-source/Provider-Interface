-- Clients rebuild P3: one place for every person tied to a client.
-- client_contacts replaces client_emergency_contacts and the guardian_*,
-- emergency_contact_*, support_coordinator_*, provider (doctor/dentist/...)
-- columns on clients and client_external_services. Additive only: the old
-- columns and tables stay (production main still reads them) until Prompt 12.

CREATE TABLE IF NOT EXISTS public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN (
    'guardian','representative','emergency','support_coordinator','primary_doctor',
    'specialist','prescriber','dentist','psychiatrist','neurologist','other_provider'
  )),
  name text NOT NULL CHECK (btrim(name) <> ''),
  relationship text,
  phone text,
  email text,
  address text,
  company text,
  notes text,
  is_primary boolean NOT NULL DEFAULT false,
  sort integer NOT NULL DEFAULT 0,
  ended_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS client_contacts_client_idx
  ON public.client_contacts (client_id, role, sort);
CREATE INDEX IF NOT EXISTS client_contacts_org_idx
  ON public.client_contacts (organization_id);

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

-- Read: same rule as client_emergency_contacts.
CREATE POLICY "members read client contacts" ON public.client_contacts
  FOR SELECT TO authenticated
  USING (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    OR (public.is_org_member(organization_id, auth.uid()) AND public.can_access_client_phi(client_id))
  );

-- Write: Clients: Edit on a client the caller can see.
CREATE POLICY "clients editors insert client contacts" ON public.client_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND public.access_can_see_client(client_id, auth.uid())
  );

CREATE POLICY "clients editors update client contacts" ON public.client_contacts
  FOR UPDATE TO authenticated
  USING (
    public.access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND public.access_can_see_client(client_id, auth.uid())
  )
  WITH CHECK (
    public.access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND public.access_can_see_client(client_id, auth.uid())
  );
-- No DELETE policy: contacts are ended (ended_on), never deleted (7-year retention).

-- ---------------------------------------------------------------------------
-- Backfill. Mirrors legacyContactsForClient() in src/lib/clients/legacy-fields.ts.
-- Empty values are skipped; a nameless entry with a phone/email gets the role
-- label as its name; the same client+role+name+phone is inserted once.
-- Idempotent: re-running adds only contacts not already present.
-- ---------------------------------------------------------------------------
WITH src AS (
  SELECT c.organization_id, c.id AS client_id, v.*
  FROM public.clients c
  CROSS JOIN LATERAL (VALUES
    (1,  'guardian',            c.guardian_name,            c.guardian_relationship,           c.guardian_phone,            c.guardian_email,            c.guardian_address,            NULL::text,                    NULL::text,                         true,  0, NULL::date),
    (2,  'emergency',           c.emergency_contact_name,   c.emergency_contact_relationship,  c.emergency_contact_phone,   NULL,                        c.emergency_contact_address,   NULL,                          c.emergency_contact_instructions,   true,  0, NULL),
    (3,  'emergency',           c.emergency_contact_2_name, c.emergency_contact_2_relationship,c.emergency_contact_2_phone, NULL,                        c.emergency_contact_2_address, NULL,                          c.emergency_contact_2_instructions, false, 1, NULL),
    (5,  'support_coordinator', c.support_coordinator_name, NULL,                              c.support_coordinator_phone, c.support_coordinator_email, NULL,                          c.support_coordinator_company, NULL,                               true,  0, NULL),
    (6,  'primary_doctor',      c.primary_care_name,        NULL,                              c.primary_care_phone,        NULL,                        c.physician_address,           NULL,                          NULL,                               true,  0, NULL),
    (7,  'primary_doctor',      c.pcp_name,                 NULL,                              c.pcp_phone,                 NULL,                        c.physician_address,           NULL,                          NULL,                               false, 1, NULL),
    (8,  'prescriber',          c.prescriber_name,          NULL,                              c.prescriber_phone,          NULL,                        NULL,                          NULL,                          NULL,                               true,  0, NULL),
    (9,  'prescriber',          c.med_prescriber_name,      NULL,                              c.med_prescriber_phone,      NULL,                        NULL,                          NULL,                          NULL,                               false, 1, NULL),
    (10, 'psychiatrist',        c.psychiatrist_name,        NULL,                              c.psychiatrist_phone,        NULL,                        c.psychiatrist_address,        NULL,                          NULL,                               true,  0, NULL),
    (11, 'neurologist',         c.neurologist_name,         NULL,                              c.neurologist_phone,         NULL,                        NULL,                          NULL,                          NULL,                               true,  0, NULL),
    (12, 'dentist',             c.dentist_name,             NULL,                              c.dentist_phone,             NULL,                        c.dentist_address,             NULL,                          NULL,                               true,  0, NULL),
    (13, 'specialist',          c.specialist_name,          NULL,                              c.specialist_phone,          NULL,                        NULL,                          NULL,                          NULL,                               true,  0, NULL),
    (14, 'other_provider',      c.residential_provider,     'Residential provider',            NULL,                        NULL,                        NULL,                          NULL,                          NULL,                               false, 0, NULL),
    (15, 'other_provider',      c.day_program_provider,     'Day program provider',            NULL,                        NULL,                        NULL,                          NULL,                          NULL,                               false, 1, NULL)
  ) AS v(prio, role, name, relationship, phone, email, address, company, notes, is_primary, sort, ended_on)
  UNION ALL
  SELECT e.organization_id, e.client_id, 4, 'emergency', e.name, e.relationship, e.phone, NULL, NULL, NULL, NULL,
         false, 2 + (row_number() OVER (PARTITION BY e.client_id ORDER BY e.created_at, e.id))::int,
         e.archived_at::date
  FROM public.client_emergency_contacts e
  JOIN public.clients ec ON ec.id = e.client_id  -- skip rows whose client no longer exists
  UNION ALL
  SELECT s.organization_id, s.client_id, 16, 'other_provider', s.provider_name,
         CASE WHEN nullif(btrim(s.service_code), '') IS NOT NULL THEN 'Provides ' || upper(btrim(s.service_code)) END,
         NULL, NULL, NULL, NULL, s.note, false,
         2 + (row_number() OVER (PARTITION BY s.client_id ORDER BY s.created_at, s.id))::int, NULL
  FROM public.client_external_services s
  JOIN public.clients sc ON sc.id = s.client_id
),
cleaned AS (
  SELECT organization_id, client_id, prio, role,
         coalesce(nullif(btrim(name), ''),
           CASE WHEN coalesce(nullif(btrim(phone), ''), nullif(btrim(email), '')) IS NOT NULL THEN
             CASE role
               WHEN 'guardian' THEN 'Guardian'
               WHEN 'emergency' THEN 'Emergency contact'
               WHEN 'support_coordinator' THEN 'Support coordinator'
               WHEN 'primary_doctor' THEN 'Primary doctor'
               WHEN 'prescriber' THEN 'Prescriber'
               WHEN 'psychiatrist' THEN 'Psychiatrist'
               WHEN 'neurologist' THEN 'Neurologist'
               WHEN 'dentist' THEN 'Dentist'
               WHEN 'specialist' THEN 'Specialist'
               ELSE 'Provider'
             END
           END) AS name,
         nullif(btrim(relationship), '') AS relationship,
         nullif(btrim(phone), '') AS phone,
         nullif(btrim(email), '') AS email,
         nullif(btrim(address), '') AS address,
         nullif(btrim(company), '') AS company,
         nullif(btrim(notes), '') AS notes,
         is_primary, sort, ended_on
  FROM src
),
ranked AS (
  SELECT *,
         row_number() OVER (
           PARTITION BY client_id, role, lower(name), regexp_replace(coalesce(phone, ''), '\D', '', 'g')
           ORDER BY prio, sort
         ) AS dup
  FROM cleaned
  WHERE name IS NOT NULL
)
INSERT INTO public.client_contacts
  (organization_id, client_id, role, name, relationship, phone, email, address, company, notes, is_primary, sort, ended_on)
SELECT r.organization_id, r.client_id, r.role, r.name, r.relationship, r.phone, r.email, r.address, r.company, r.notes,
       r.is_primary, r.sort, r.ended_on
FROM ranked r
WHERE r.dup = 1
  AND NOT EXISTS (
    SELECT 1 FROM public.client_contacts x
    WHERE x.client_id = r.client_id
      AND x.role = r.role
      AND lower(x.name) = lower(r.name)
      AND regexp_replace(coalesce(x.phone, ''), '\D', '', 'g') = regexp_replace(coalesce(r.phone, ''), '\D', '', 'g')
  );

COMMENT ON TABLE public.client_contacts IS
  'Every person tied to a client (guardian, emergency, support coordinator, doctors, other providers). One source for contacts.';
