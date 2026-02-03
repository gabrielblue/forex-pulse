-- Add UPDATE policy for currency_pairs table
CREATE POLICY "Currency pairs can be updated by authenticated users"
ON currency_pairs
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
