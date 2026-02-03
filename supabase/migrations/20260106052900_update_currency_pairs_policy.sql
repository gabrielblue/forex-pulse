-- Update currency_pairs policies to allow anonymous inserts for public data
-- Currency pairs are public reference data that can be inserted by anyone

-- Drop existing insert policy
DROP POLICY IF EXISTS "Currency pairs can be inserted by authenticated users" ON currency_pairs;

-- Create new policy allowing anonymous inserts for currency pairs
CREATE POLICY "Currency pairs can be inserted by anyone"
ON currency_pairs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Keep the other policies as they are for authenticated users
-- SELECT policy already allows authenticated users
-- UPDATE policy already allows authenticated users
