-- Allow all authenticated users to read other walkers' basic info
-- (needed for the WalkerPicker bottom sheet to show sector walkers)
-- Run this once in the Supabase SQL editor.

-- First, check existing policies to avoid duplicates:
-- SELECT policyname FROM pg_policies WHERE tablename = 'profiles';

-- If there's already a restrictive SELECT policy that only allows auth.uid() = id,
-- add this new permissive policy alongside it:

CREATE POLICY "Authenticated users can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Note: if you get "policy already exists", the policy is already in place.
-- If existing policies conflict (e.g. only allow read own row), you may need to
-- drop the old one first:
--   DROP POLICY "Users can view own profile" ON profiles;
-- Then re-run the CREATE POLICY above.
