-- Persist real batch cooldown and manual safety pause for the Instagram Story queue.
alter table public.av_distribution_settings
  add column if not exists paused boolean not null default false,
  add column if not exists pause_reason text,
  add column if not exists next_batch_at timestamptz,
  add column if not exists last_batch_at timestamptz;
