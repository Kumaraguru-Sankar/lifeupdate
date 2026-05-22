DELETE FROM public.ai_messages WHERE role NOT IN ('user', 'assistant');
ALTER TABLE public.ai_messages ADD CONSTRAINT ai_messages_role_check CHECK (role IN ('user', 'assistant'));