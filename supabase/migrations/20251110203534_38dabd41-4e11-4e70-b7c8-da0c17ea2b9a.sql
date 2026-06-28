-- Enable Realtime for afroid_witnesses table
ALTER TABLE public.afroid_witnesses REPLICA IDENTITY FULL;

-- Add the table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.afroid_witnesses;