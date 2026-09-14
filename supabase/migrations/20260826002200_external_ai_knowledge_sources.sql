alter table public.knowledge_chunks drop constraint if exists knowledge_chunks_source_type_check;
alter table public.knowledge_chunks add constraint knowledge_chunks_source_type_check
  check (source_type in (
    'process_summary', 'process_step', 'rule', 'exception', 'owner_answer',
    'role_instruction', 'call_finding', 'faq', 'google_drive', 'video_finding'
  ));

alter table public.external_ai_knowledge_access drop constraint if exists external_ai_knowledge_access_source_type_check;
alter table public.external_ai_knowledge_access add constraint external_ai_knowledge_access_source_type_check
  check (source_type in (
    'process_summary', 'process_step', 'rule', 'exception', 'owner_answer',
    'role_instruction', 'call_finding', 'faq', 'google_drive', 'video_finding'
  ));
