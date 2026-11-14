-- Ensure the public curriculum catalog obeys the underlying lessons table RLS policies.
-- Anonymous users may see only free, published lessons; authenticated admins retain their policy-based access.
ALTER VIEW public.curriculum_catalog SET (security_invoker = true);
