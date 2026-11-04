-- Undo of B. Run only on Evoni's request.
\set ON_ERROR_STOP on
BEGIN;
UPDATE wardrobe SET is_owned = true, updated_at = NOW()
 WHERE id IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867')
   AND is_owned = false;
COMMIT;
\echo 'B UNDONE'
