-- Expands UPDATE policy so either participant can sync challenge progress while active.
-- Resolves RLS blocking challengers from posting credit updates during an active challenge.

DO $$
BEGIN
  -- Drop the previous update policy to avoid duplicates or overlapping logic.
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can update challenges where they are challenger (pending only) or challenged (accept/counter-offer)'
      AND tablename = 'challenges'
  ) THEN
    DROP POLICY "Users can update challenges where they are challenger (pending only) or challenged (accept/counter-offer)" ON public.challenges;
  END IF;
END
$$;

-- Allow either participant to update while pending (creating/countering) or active (credit/XP sync).
CREATE POLICY "Participants can update pending or active challenges"
  ON public.challenges
  FOR UPDATE
  USING (
    auth.uid() IN (challenger_id, challenged_id)
    AND status IN ('pending', 'active')
  )
  WITH CHECK (auth.uid() IN (challenger_id, challenged_id));
