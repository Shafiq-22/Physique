-- When the training programme began.
--
-- Drives the conditioning block (skipping ladder → hill sprints → flat sprints)
-- and the months 5–9 high-risk window where deloads stop being optional.
-- Nullable: the app falls back to the first logged day until this is set.

alter table profiles add column if not exists program_start date;
