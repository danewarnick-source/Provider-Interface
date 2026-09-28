-- Step 20. Stop lesson progress from recalculating the old course assignment.
DROP TRIGGER IF EXISTS trg_recalc_assignment_progress ON public.lesson_progress;
