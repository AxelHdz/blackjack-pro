-- Create a function to handle bidirectional friendship creation
-- This function bypasses RLS to create friendships for both users
CREATE OR REPLACE FUNCTION create_bidirectional_friendship(
  user1_id UUID,
  user2_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if friendship already exists
  IF EXISTS (
    SELECT 1 FROM friends 
    WHERE (user_id = user1_id AND friend_user_id = user2_id)
       OR (user_id = user2_id AND friend_user_id = user1_id)
  ) THEN
    RETURN;
  END IF;

  -- Create bidirectional friendship
  INSERT INTO friends (user_id, friend_user_id, created_at)
  VALUES 
    (user1_id, user2_id, NOW()),
    (user2_id, user1_id, NOW())
  ON CONFLICT (user_id, friend_user_id) DO NOTHING;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_bidirectional_friendship(UUID, UUID) TO authenticated;
