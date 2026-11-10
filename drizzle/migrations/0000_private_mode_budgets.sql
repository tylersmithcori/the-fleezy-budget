DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['bills','payoff_bills','income','spending','savings','accounts','ebt_entries','receipts','weekly_checkins','bill_payments'] LOOP
 EXECUTE format('CREATE TABLE public.%I (id text NOT NULL CHECK(length(id) BETWEEN 1 AND 200), user_id uuid NOT NULL, mode text NOT NULL CHECK(mode IN (''personal'',''business'')), data jsonb NOT NULL CHECK(jsonb_typeof(data) = ''object'' AND octet_length(data::text) <= 100000), PRIMARY KEY(user_id,mode,id))',t);
 EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY owner_select ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id)',t);
 EXECUTE format('CREATE POLICY owner_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)',t);
 EXECUTE format('CREATE POLICY owner_update ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',t);
 EXECUTE format('CREATE POLICY owner_delete ON public.%I FOR DELETE TO authenticated USING (auth.uid() = user_id)',t);
 END LOOP;
END $$;
CREATE FUNCTION public.save_budget(p_mode text, p_rows jsonb, p_revision integer) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE t text; r jsonb; current_revision integer; next_revision integer;
BEGIN
 IF auth.uid() IS NULL OR p_mode NOT IN ('personal','business') OR jsonb_typeof(p_rows) <> 'object' OR octet_length(p_rows::text)>5000000 THEN RAISE EXCEPTION 'Invalid budget'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_mode,0));
 SELECT COALESCE((data->>'revision')::integer,0) INTO current_revision FROM public.savings WHERE user_id=auth.uid() AND mode=p_mode AND id='settings';
 current_revision := COALESCE(current_revision,0);
 IF current_revision <> p_revision THEN RAISE EXCEPTION 'Your budget changed in another tab. Reload before saving.'; END IF;
 next_revision := current_revision + 1;
 FOREACH t IN ARRAY ARRAY['bills','payoff_bills','income','spending','savings','accounts','ebt_entries','receipts','weekly_checkins','bill_payments'] LOOP
 IF jsonb_typeof(p_rows->t) <> 'array' OR p_rows->t IS NULL THEN RAISE EXCEPTION 'Missing budget entries'; END IF;
 EXECUTE format('DELETE FROM public.%I WHERE user_id=auth.uid() AND mode=$1',t) USING p_mode;
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows->t) LOOP
 IF t='receipts' AND (r->'data'->>'path' NOT LIKE auth.uid()::text || '/' || p_mode || '/%' OR r->'data'->>'path' IS NULL) THEN RAISE EXCEPTION 'Invalid receipt folder'; END IF;
 IF t='spending' AND ((r->'data') ? 'receipt') THEN RAISE EXCEPTION 'Receipt images must be stored privately'; END IF;
 IF t='savings' THEN r := jsonb_set(r,'{data,revision}',to_jsonb(next_revision)); END IF;
 EXECUTE format('INSERT INTO public.%I(id,user_id,mode,data) VALUES($1,auth.uid(),$2,$3)',t) USING r->>'id',p_mode,r->'data';
 END LOOP;
 END LOOP;
 RETURN next_revision;
END $$;
REVOKE ALL ON FUNCTION public.save_budget(text,jsonb,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_budget(text,jsonb,integer) TO authenticated;
CREATE POLICY receipts_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id='receipts' AND (storage.foldername(name))[1]=auth.uid()::text AND (storage.foldername(name))[2] IN ('personal','business'));
CREATE POLICY receipts_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='receipts' AND (storage.foldername(name))[1]=auth.uid()::text AND (storage.foldername(name))[2] IN ('personal','business'));
CREATE POLICY receipts_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='receipts' AND (storage.foldername(name))[1]=auth.uid()::text) WITH CHECK (bucket_id='receipts' AND (storage.foldername(name))[1]=auth.uid()::text AND (storage.foldername(name))[2] IN ('personal','business'));
CREATE POLICY receipts_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id='receipts' AND (storage.foldername(name))[1]=auth.uid()::text);