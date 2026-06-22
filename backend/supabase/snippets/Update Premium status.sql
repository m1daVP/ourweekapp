update public.subscriptions
set
  plan_type = 'premium',
  status = 'active',
  expires_at = now() + interval '30 days',
  last_checked_at = now()
where workspace_id = '2e173e3d-5784-4dab-87ab-64c9f34fbd12';