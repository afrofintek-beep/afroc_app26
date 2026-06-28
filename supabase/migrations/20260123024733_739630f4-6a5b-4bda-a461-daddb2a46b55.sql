-- Add DELETE policy for users to delete their own DRAFT addresses
CREATE POLICY "Users can delete their own draft records"
ON public.afroloc_records
FOR DELETE
USING (auth.uid() = user_id AND status = 'draft');

-- Also allow admins to delete any record
CREATE POLICY "Admins can delete any record"
ON public.afroloc_records
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));