-- Access cleanup: remove the permanently disabled self-promotion function.
-- Nothing in the app or database calls it; it only raises an exception.
DROP FUNCTION IF EXISTS public.restore_my_admin_role();
