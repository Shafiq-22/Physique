-- Meal ticks and water, on the daily log.
--
-- `meals` records which of the three planned meals were eaten and which swap
-- was used, e.g. {"m1":{"eaten":true},"m2":{"eaten":true,"optionId":"m2_tuna"}}.
--
-- Because the plan is fixed, that is a complete calorie log: the app derives
-- kcal_intake and protein_g from it and writes them to the existing columns, so
-- every downstream rule — adaptive TDEE, compliance, the weekly verdict — keeps
-- working unchanged and simply gets fed properly.

alter table daily_logs add column if not exists meals jsonb;
alter table daily_logs add column if not exists water_l numeric;
