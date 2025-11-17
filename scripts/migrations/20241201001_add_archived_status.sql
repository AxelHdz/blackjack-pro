-- Add 'archived' status to challenges table
ALTER TABLE public.challenges DROP CONSTRAINT challenges_status_check;
ALTER TABLE public.challenges ADD CONSTRAINT challenges_status_check CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'archived'));
