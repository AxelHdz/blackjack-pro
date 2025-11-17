-- 20241117002_update_challenge_rls_policy.sql
-- Updates the challenge UPDATE policy to allow archiving completed and cancelled challenges

DO $$
BEGIN
  -- Drop the old policy
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Participants can update pending or active challenges'
      AND tablename = 'challenges'
  ) THEN
    DROP POLICY "Participants can update pending or active challenges" ON public.challenges;
  END IF;
END
$$;

-- Allow participants to update challenges in any status (needed for archiving completed/cancelled challenges)
CREATE POLICY "Participants can update challenges"
  ON public.challenges
  FOR UPDATE
  USING (
    auth.uid() IN (challenger_id, challenged_id)
  )
  WITH CHECK (auth.uid() IN (challenger_id, challenged_id));
