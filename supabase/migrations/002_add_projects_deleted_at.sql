-- Soft delete support for projects

alter table public.projects
  add column if not exists deleted_at timestamptz null;
