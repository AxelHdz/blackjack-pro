-- Create challenges table for user-to-user challenges
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenged_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wager_amount INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (5, 10)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  challenger_balance_start INTEGER,
  challenged_balance_start INTEGER,
  challenger_balance_end INTEGER,
  challenged_balance_end INTEGER,
  winner_id UUID REFERENCES auth.users(id),
  started_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

-- Policies for challenges table
CREATE POLICY "Users can view challenges where they are challenger or challenged"
  ON challenges FOR SELECT
  USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

CREATE POLICY "Users can create challenges where they are the challenger"
  ON challenges FOR INSERT
  WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "Users can update challenges where they are challenger (pending only) or challenged (accept/counter-offer)"
  ON challenges FOR UPDATE
  USING (
    (auth.uid() = challenger_id AND status = 'pending') OR
    (auth.uid() = challenged_id)
  );

CREATE POLICY "Users can delete challenges where they are challenger and status is pending"
  ON challenges FOR DELETE
  USING (auth.uid() = challenger_id AND status = 'pending');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_challenges_challenger_id ON challenges(challenger_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenged_id ON challenges(challenged_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_expires_at ON challenges(expires_at);

-- Create partial unique indexes to ensure one active/pending challenge per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_challenges_one_active_challenger
  ON challenges(challenger_id)
  WHERE status IN ('pending', 'active');

CREATE UNIQUE INDEX IF NOT EXISTS idx_challenges_one_active_challenged
  ON challenges(challenged_id)
  WHERE status IN ('pending', 'active');
