alter table public.processes
  drop constraint if exists processes_learning_source_check;

alter table public.processes
  add constraint processes_learning_source_check
  check (
    learning_source in (
      'text',
      'voice',
      'video',
      'screen',
      'google_drive',
      'ai_conversation'
    )
  );

comment on column public.processes.learning_source is
  'Owner-visible learning input used to create the process, including explicitly selected AI conversations.';
