-- Everything that depends on public.brain_documents or its sequence, other than the table's own
-- primary key, column defaults, indexes, sequence and row type. Expected: no row.
SELECT pg_catalog.pg_describe_object(d.classid, d.objid, d.objsubid) AS dependent, d.deptype
  FROM pg_catalog.pg_depend d,
       (SELECT to_regclass('public.brain_documents') AS t, to_regclass('public.brain_documents_id_seq') AS s) x
 WHERE d.refclassid = 'pg_catalog.pg_class'::regclass AND d.refobjid IN (x.t, x.s) AND d.deptype IN ('n', 'a')
   AND NOT (d.classid = 'pg_catalog.pg_constraint'::regclass AND d.objid IN (SELECT oid FROM pg_catalog.pg_constraint WHERE conrelid = x.t AND contype = 'p'))
   AND NOT (d.classid = 'pg_catalog.pg_attrdef'::regclass AND d.objid IN (SELECT oid FROM pg_catalog.pg_attrdef WHERE adrelid = x.t))
   AND NOT (d.classid = 'pg_catalog.pg_class'::regclass AND (d.objid = x.s OR d.objid IN (SELECT indexrelid FROM pg_catalog.pg_index WHERE indrelid = x.t)))
 ORDER BY 1
