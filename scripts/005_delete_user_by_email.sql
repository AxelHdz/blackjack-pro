-- Script to delete a user and all related records by email
-- Replace 'stephortiz1995@gmail.com' with the email you want to delete

DO $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Get the user_id from email
  SELECT id INTO target_user_id 
  FROM auth.users 
  WHERE email = 'stephortiz1995@gmail.com';
  
  IF target_user_id IS NULL THEN
    RAISE NOTICE 'User with email stephortiz1995@gmail.com not found';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found user_id: %', target_user_id;
  
  -- Delete from friend_requests (both sent and received)
  DELETE FROM public.friend_requests 
  WHERE from_user_id = target_user_id OR to_user_id = target_user_id;
  RAISE NOTICE 'Deleted friend requests';
  
  -- Delete from friends table (both directions)
  DELETE FROM public.friends 
  WHERE user_id = target_user_id OR friend_user_id = target_user_id;
  RAISE NOTICE 'Deleted friends relationships';
  
  -- Delete from game_stats
  DELETE FROM public.game_stats 
  WHERE user_id = target_user_id;
  RAISE NOTICE 'Deleted game stats';
  
  -- Delete from user_profiles
  DELETE FROM public.user_profiles 
  WHERE id = target_user_id;
  RAISE NOTICE 'Deleted user profile';
  
  -- Delete from auth.users (this is the main user record)
  DELETE FROM auth.users 
  WHERE id = target_user_id;
  RAISE NOTICE 'Deleted auth user';
  
  RAISE NOTICE 'Successfully deleted user and all related records';
END $$;
