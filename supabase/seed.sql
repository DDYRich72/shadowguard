-- Deterministic, non-personal local-development data.
-- This organization is intentionally not linked to an auth user. Create a
-- real local account through the app to exercise the signup bootstrap.
INSERT INTO public.organizations (id, name, domain, settings)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Example Organization',
  'example.invalid',
  '{"seeded": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    domain = EXCLUDED.domain,
    settings = EXCLUDED.settings;
