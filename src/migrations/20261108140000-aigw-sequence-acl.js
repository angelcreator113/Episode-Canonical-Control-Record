'use strict';

/**
 * AI egress gateway, G2 follow-up (Evoni, 2026-11-08: pre-deployment check
 * of pg_default_acl). The ledger migration 20261108120000-create-aigw-ledger
 * removes every non-owner grant from its tables and functions, but on its
 * three sequences it only revokes PUBLIC. In production the migration login
 * has default privileges on new sequences in schema public
 * (episode_app_dev: SELECT, USAGE; dev_refresh_ro: SELECT), so after that
 * migration the application login could call nextval() on the aigw_
 * sequences. It still could not read or write any aigw_ table or call any
 * aigw_ function.
 *
 * This migration takes every grant on those three sequences back from every
 * role except their owner (the same sweep the ledger migration applies to
 * its tables and functions). Nothing else is touched: no table, no function,
 * no data, no ownership, no other sequence. It does nothing for a sequence
 * that does not exist, and running it again changes nothing.
 *
 * down does nothing: giving the application login access back is never
 * wanted.
 */

const SEQUENCES = ['aigw_permit_events_id_seq', 'aigw_reconciliations_id_seq', 'aigw_audit_id_seq'];

function sweepSql(seq) {
  return `DO $acl$
    DECLARE g text;
    BEGIN
      IF to_regclass('public.${seq}') IS NULL THEN RETURN; END IF;
      EXECUTE 'REVOKE ALL ON SEQUENCE public.${seq} FROM PUBLIC';
      FOR g IN SELECT DISTINCT a.grantee::regrole::text
                 FROM pg_catalog.pg_class c, pg_catalog.aclexplode(c.relacl) a
                WHERE c.oid = 'public.${seq}'::regclass AND a.grantee <> 0 AND a.grantee <> c.relowner
      LOOP
        EXECUTE format('REVOKE ALL ON SEQUENCE public.${seq} FROM %s', g);
      END LOOP;
    END
  $acl$`;
}

module.exports = {
  SEQUENCES,
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      for (const seq of SEQUENCES) await sequelize.query(sweepSql(seq), { transaction });
    });
  },
  async down() {
    // Intentionally nothing: see the header.
  },
};
