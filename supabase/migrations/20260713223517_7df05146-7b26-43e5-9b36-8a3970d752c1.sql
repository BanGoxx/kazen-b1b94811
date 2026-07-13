REVOKE ALL ON FUNCTION public.chat_pair_key(uuid, uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.chat_pair_key(uuid, uuid) FROM anon;
REVOKE SELECT ON public.chat_conversations FROM anon;
REVOKE SELECT ON public.chat_participants FROM anon;
REVOKE SELECT ON public.chat_messages FROM anon;