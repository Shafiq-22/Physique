-- Add 'recomp' as a phase type.
--
-- Recomposition — holding scale weight while trading fat for muscle — is a
-- distinct plan, not a flavour of maintenance: it carries its own protein target
-- and is judged by the tape rather than by weight change.

alter table phases drop constraint if exists phases_phase_type_check;

alter table phases
  add constraint phases_phase_type_check
  check (phase_type in ('cut','maintain','gain','mini_cut','recomp'));
