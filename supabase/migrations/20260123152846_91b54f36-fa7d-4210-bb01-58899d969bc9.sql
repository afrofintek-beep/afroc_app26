-- Enable realtime for afroloc_records table to support live updates on Grid Management Dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.afroloc_records;