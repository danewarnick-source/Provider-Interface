-- Step 19. Stop old course completion from issuing a row in certifications.
DROP TRIGGER IF EXISTS trg_issue_cert ON public.course_assignments;
