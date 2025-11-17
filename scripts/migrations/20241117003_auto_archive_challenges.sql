-- 20241117003_auto_archive_challenges.sql
-- Creates a function and trigger to automatically archive challenges for users when they participate in new challenges

CREATE OR REPLACE FUNCTION auto_archive_user_challenges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Archive challenges for the challenger (NEW.challenger_id)
  UPDATE challenges
  SET challenger_archive_status = true,
      updated_at = NOW()
  WHERE challenger_id = NEW.challenger_id
    AND status IN ('pending', 'active', 'completed')
    AND challenger_archive_status = false
    AND id != NEW.id;  -- Don't archive the newly created challenge

  -- Archive challenges for the challenged user (NEW.challenged_id)
  UPDATE challenges
  SET challenged_archive_status = true,
      updated_at = NOW()
  WHERE challenged_id = NEW.challenged_id
    AND status IN ('pending', 'active', 'completed')
    AND challenged_archive_status = false
    AND id != NEW.id;  -- Don't archive the newly created challenge

  RETURN NEW;
END;
$$;

-- Create the trigger that runs after inserting a new challenge
DROP TRIGGER IF EXISTS trigger_auto_archive_challenges ON challenges;
CREATE TRIGGER trigger_auto_archive_challenges
  AFTER INSERT ON challenges
  FOR EACH ROW
  EXECUTE FUNCTION auto_archive_user_challenges();
