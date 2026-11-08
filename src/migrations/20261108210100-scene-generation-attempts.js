'use strict';

/**
 * Scene Sets: one row per paid generation attempt, and database guards that
 * keep an uncertain outcome from being retried, reclassified or deleted
 * (#3748, PR A; Evoni, 2026-11-08). Schema only and inert: no application
 * code writes scene_generation_attempts or current_attempt_id until PR B is
 * separately approved. Every existing row has current_attempt_id NULL, so the
 * guards change nothing for today's code (they only read the attempts table
 * when a row references an attempt).
 *
 * scene_generation_attempts (append-only evidence):
 *   target_kind/target_id   the scene set ('set') or angle ('angle'); no
 *                           foreign key, so the evidence outlives the target
 *   state                   claimed -> dispatch_started -> stored |
 *                           stored_failed | not_sent | refused | uncertain;
 *                           claimed -> not_sent | abandoned_unsent;
 *                           stored_failed -> stored (Retry storing).
 *                           'dispatch_started' is committed before the paid
 *                           request is sent: it means the request MAY have
 *                           been sent, not that fal received or charged it.
 *   provider_image_url etc. evidence, each written once
 *   supersedes_attempt_id   a confirmed new attempt points at the uncertain
 *                           one it follows; the original is never changed
 *   confirm_*               a single-use confirmation stored on the
 *                           uncertain attempt it is bound to (the token is
 *                           kept only as a hash)
 *   reviewed_*              Mark reviewed (the status stays uncertain)
 *
 * Guards (BEFORE triggers, SECURITY DEFINER, search_path pinned):
 *   scene_sets / scene_angles
 *     G1 'uncertain' may become only 'generating' with a new attempt whose
 *        confirmation was consumed in the same transaction, or 'complete'
 *        with a newly stored image (the image column set to a new,
 *        non-empty value). Never 'failed' or 'pending'.
 *     G2 while the current attempt is claimed or dispatch_started the row
 *        stays 'generating'; a stale one (no update for 15 minutes,
 *        services/generationClaimService GENERATION_STALE_MINUTES) cannot be
 *        reclaimed or restamped, only reconciled through its attempt.
 *     G3 current_attempt_id may change only to an existing 'claimed'
 *        attempt for this same row, together with 'generating'; never
 *        cleared, never another row's attempt, never while one is in flight.
 *     G4 'uncertain' may be entered only when the current attempt is
 *        'uncertain' or 'stored_failed'.
 *     G5 an uncertain row cannot be deleted or soft-deleted; nor can a set
 *        while one of its live angles is uncertain. TRUNCATE of either table
 *        is refused while any row is uncertain or any attempt is in flight.
 *     G7 while the current attempt is in flight, an UPDATE that names
 *        generation_status without taking a new attempt is refused, even
 *        when it leaves the value 'generating' (the code before PR B marks a
 *        base generating with a plain UPDATE and then calls fal: during a
 *        rollback it would send a second request for a run in flight). The
 *        same restamp to 'generating' is refused while the current attempt
 *        holds an unknown outcome, and so is 'failed' or 'pending'.
 *   An attempt "holds an unknown outcome" when it is uncertain or
 *   stored_failed, or when it is a confirmed replacement (its predecessor's
 *   confirmation was consumed by it) that ended abandoned_unsent or not_sent:
 *   the replacement was never sent, so the original is still unknown. Such a
 *   row returns to 'uncertain' (never 'failed' or 'pending'), and a new
 *   confirmation is issued on, and supersedes, that replacement.
 *   scene_generation_attempts
 *     G6 no DELETE or TRUNCATE; identity and evidence columns write-once;
 *        only the state transitions above; a confirmation is consumed once,
 *        before it expires, by the user it was issued to, for an attempt
 *        that supersedes it.
 *   one attempt in flight per target (unique partial index).
 *
 * The confirmation order PR B / PR C must use (the guards refuse any other),
 * in ONE transaction, committed together:
 *   1. lock the target row (SELECT ... FOR UPDATE); check it is 'uncertain'
 *      with the expected current_attempt_id;
 *   2. INSERT the replacement attempt ('claimed', supersedes_attempt_id =
 *      that current attempt);
 *   3. consume the confirmation conditionally (UPDATE ... SET
 *      confirm_consumed_* WHERE hash, user, not consumed, not expired);
 *      0 rows: roll back, nothing is sent;
 *   4. switch the target: current_attempt_id = the replacement, 'generating';
 *   5. commit.
 * Consuming before the insert is refused: a confirmation is consumed only by
 * an existing claimed attempt that supersedes it. The reconciler also locks
 * the target first, then its attempt.
 *
 * Down refuses while any attempt row exists (evidence) or any row is
 * uncertain; it never converts anything into a retryable status.
 */
const PIN = 'SET LOCAL search_path = pg_catalog, pg_temp';
const STALE_MINUTES = 15; // generationClaimService.GENERATION_STALE_MINUTES

const UNKNOWN_OUTCOME = `
CREATE OR REPLACE FUNCTION public.scene_generation_unknown_outcome(p_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.scene_generation_attempts a
     WHERE a.id = p_id
       AND (a.state IN ('uncertain', 'stored_failed')
            OR (a.state IN ('abandoned_unsent', 'not_sent')
                AND EXISTS (SELECT 1 FROM public.scene_generation_attempts p
                             WHERE p.id = a.supersedes_attempt_id AND p.confirm_consumed_by_attempt_id = a.id))))
$fn$`;

const STATUS_WRITE_GUARD = `
CREATE OR REPLACE FUNCTION public.scene_generation_status_write_guard() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $fn$
BEGIN
  IF OLD.current_attempt_id IS NOT NULL AND NEW.current_attempt_id IS NOT DISTINCT FROM OLD.current_attempt_id
     AND NEW.generation_status IS NOT DISTINCT FROM OLD.generation_status
     AND (EXISTS (SELECT 1 FROM public.scene_generation_attempts a
                   WHERE a.id = OLD.current_attempt_id AND a.state IN ('claimed', 'dispatch_started'))
          OR (OLD.generation_status::text = 'generating' AND NEW.generation_status::text = 'generating'
              AND public.scene_generation_unknown_outcome(OLD.current_attempt_id))) THEN
    RAISE EXCEPTION 'scene generation guard: % % has an attempt in flight; another generation cannot start',
      CASE TG_TABLE_NAME WHEN 'scene_sets' THEN 'set' ELSE 'angle' END, OLD.id USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $fn$`;

const TARGET_TRUNCATE_GUARD = `
CREATE OR REPLACE FUNCTION public.scene_generation_target_truncate_guard() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $fn$
BEGIN
  IF EXISTS (SELECT 1 FROM public.scene_sets WHERE generation_status::text = 'uncertain')
     OR EXISTS (SELECT 1 FROM public.scene_angles WHERE generation_status::text = 'uncertain')
     OR EXISTS (SELECT 1 FROM public.scene_generation_attempts WHERE state IN ('claimed', 'dispatch_started')) THEN
    RAISE EXCEPTION 'scene generation guard: % is refused while a scene set or angle is uncertain or an attempt is in flight', TG_TABLE_NAME USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $fn$`;

const TARGET_GUARD = `
CREATE OR REPLACE FUNCTION public.scene_generation_target_guard() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $fn$
DECLARE
  kind text := CASE TG_TABLE_NAME WHEN 'scene_sets' THEN 'set' ELSE 'angle' END;
  old_status text;
  new_status text;
  cur public.scene_generation_attempts%ROWTYPE;
  nxt public.scene_generation_attempts%ROWTYPE;
  old_img text;
  new_img text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.generation_status::text = 'uncertain' THEN
      RAISE EXCEPTION 'scene generation guard: % % has an uncertain outcome (a paid request may already have been charged) and cannot be deleted', kind, OLD.id USING ERRCODE = '23514';
    END IF;
    IF kind = 'set' AND EXISTS (SELECT 1 FROM public.scene_angles a WHERE a.scene_set_id = OLD.id AND a.generation_status::text = 'uncertain') THEN
      RAISE EXCEPTION 'scene generation guard: set % has an angle with an uncertain outcome and cannot be deleted', OLD.id USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  old_status := OLD.generation_status::text;
  new_status := NEW.generation_status::text;

  -- G5: soft delete.
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    IF old_status = 'uncertain' OR new_status = 'uncertain' THEN
      RAISE EXCEPTION 'scene generation guard: % % has an uncertain outcome and cannot be deleted', kind, OLD.id USING ERRCODE = '23514';
    END IF;
    IF kind = 'set' AND EXISTS (SELECT 1 FROM public.scene_angles a
                                 WHERE a.scene_set_id = OLD.id AND a.deleted_at IS NULL AND a.generation_status::text = 'uncertain') THEN
      RAISE EXCEPTION 'scene generation guard: set % has an angle with an uncertain outcome and cannot be deleted', OLD.id USING ERRCODE = '23514';
    END IF;
  END IF;

  IF OLD.current_attempt_id IS NOT NULL THEN
    SELECT * INTO cur FROM public.scene_generation_attempts WHERE id = OLD.current_attempt_id;
  END IF;

  -- G3: a new current attempt.
  IF NEW.current_attempt_id IS DISTINCT FROM OLD.current_attempt_id THEN
    IF NEW.current_attempt_id IS NULL THEN
      RAISE EXCEPTION 'scene generation guard: current_attempt_id of % % cannot be cleared', kind, OLD.id USING ERRCODE = '23514';
    END IF;
    SELECT * INTO nxt FROM public.scene_generation_attempts WHERE id = NEW.current_attempt_id;
    IF NOT FOUND OR nxt.target_kind <> kind OR nxt.target_id <> NEW.id THEN
      RAISE EXCEPTION 'scene generation guard: attempt % does not belong to % %', NEW.current_attempt_id, kind, NEW.id USING ERRCODE = '23514';
    END IF;
    IF nxt.state <> 'claimed' OR new_status <> 'generating' THEN
      RAISE EXCEPTION 'scene generation guard: % % may only take a new, claimed attempt while becoming generating', kind, NEW.id USING ERRCODE = '23514';
    END IF;
    IF OLD.current_attempt_id IS NOT NULL AND cur.state IN ('claimed', 'dispatch_started') THEN
      RAISE EXCEPTION 'scene generation guard: % % has an attempt in flight; record its outcome before another', kind, NEW.id USING ERRCODE = '23514';
    END IF;
    IF old_status = 'uncertain' AND (nxt.supersedes_attempt_id IS DISTINCT FROM OLD.current_attempt_id
                                     OR cur.confirm_consumed_by_attempt_id IS DISTINCT FROM nxt.id) THEN
      RAISE EXCEPTION 'scene generation guard: % % has an uncertain outcome; a new paid attempt needs a confirmation consumed for it', kind, NEW.id USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  -- G2: an attempt in flight.
  IF OLD.current_attempt_id IS NOT NULL AND cur.state IN ('claimed', 'dispatch_started') THEN
    IF new_status <> 'generating' THEN
      RAISE EXCEPTION 'scene generation guard: % % has an attempt in flight; record its outcome first', kind, NEW.id USING ERRCODE = '23514';
    END IF;
    IF old_status = 'generating' AND OLD.updated_at < pg_catalog.now() - pg_catalog.make_interval(mins => ${STALE_MINUTES}) THEN
      RAISE EXCEPTION 'scene generation guard: % % has a stale attempt in flight; it must be reconciled, not claimed again', kind, NEW.id USING ERRCODE = '23514';
    END IF;
  END IF;

  IF new_status = old_status THEN
    RETURN NEW;
  END IF;

  -- G1: leaving uncertain.
  IF old_status = 'uncertain' THEN
    IF new_status = 'complete' THEN
      IF kind = 'set' THEN
        old_img := OLD.base_still_url;
        new_img := NEW.base_still_url;
      ELSE
        old_img := OLD.still_image_url;
        new_img := NEW.still_image_url;
      END IF;
      IF new_img IS NULL OR pg_catalog.btrim(new_img) = '' OR new_img IS NOT DISTINCT FROM old_img THEN
        RAISE EXCEPTION 'scene generation guard: % % has an uncertain outcome; it becomes complete only with a newly stored image', kind, NEW.id USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'scene generation guard: % % has an uncertain outcome and cannot become %', kind, NEW.id, new_status USING ERRCODE = '23514';
  END IF;

  -- The current attempt still holds an unknown outcome (uncertain, a failed
  -- store, or a confirmed replacement that was never sent): never retryable.
  -- Only from 'generating': a row already resolved by Upload ('complete')
  -- keeps its normal edits.
  IF OLD.current_attempt_id IS NOT NULL AND old_status = 'generating' AND new_status IN ('failed', 'pending')
     AND public.scene_generation_unknown_outcome(cur.id) THEN
    RAISE EXCEPTION 'scene generation guard: % % still has an unknown outcome (a confirmed replacement that was never sent leaves the original unknown); it returns to uncertain, not %', kind, NEW.id, new_status USING ERRCODE = '23514';
  END IF;

  -- G4: entering uncertain.
  IF new_status = 'uncertain' AND (NEW.current_attempt_id IS NULL OR NOT public.scene_generation_unknown_outcome(cur.id)) THEN
    RAISE EXCEPTION 'scene generation guard: % % becomes uncertain only through an attempt recorded as uncertain', kind, NEW.id USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $fn$`;

const ATTEMPT_GUARD = `
CREATE OR REPLACE FUNCTION public.scene_generation_attempt_guard() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $fn$
DECLARE
  prev public.scene_generation_attempts%ROWTYPE;
  nxt public.scene_generation_attempts%ROWTYPE;
  ok boolean;
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'scene generation guard: attempts are append-only evidence; % is not allowed', TG_OP USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'claimed'
       OR NEW.dispatch_started_at IS NOT NULL OR NEW.finished_at IS NOT NULL
       OR NEW.provider_image_url IS NOT NULL OR NEW.storage_error IS NOT NULL OR NEW.usage_log_id IS NOT NULL
       OR NEW.error_code IS NOT NULL OR NEW.error_class IS NOT NULL OR NEW.message IS NOT NULL
       OR NEW.confirm_token_hash IS NOT NULL OR NEW.confirm_user_id IS NOT NULL OR NEW.confirm_expires_at IS NOT NULL
       OR NEW.confirm_consumed_at IS NOT NULL OR NEW.confirm_consumed_by_attempt_id IS NOT NULL OR NEW.confirm_consumed_by_user_id IS NOT NULL
       OR NEW.reviewed_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL OR NEW.review_note IS NOT NULL THEN
      RAISE EXCEPTION 'scene generation guard: a new attempt starts as claimed, with no outcome, confirmation or review' USING ERRCODE = '23514';
    END IF;
    IF NEW.supersedes_attempt_id IS NOT NULL THEN
      SELECT * INTO prev FROM public.scene_generation_attempts WHERE id = NEW.supersedes_attempt_id;
      IF NOT FOUND OR prev.target_kind <> NEW.target_kind OR prev.target_id <> NEW.target_id
         OR NOT public.scene_generation_unknown_outcome(prev.id) THEN
        RAISE EXCEPTION 'scene generation guard: an attempt may only supersede an uncertain attempt of the same target' USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: identity never changes.
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.target_kind IS DISTINCT FROM OLD.target_kind OR NEW.target_id IS DISTINCT FROM OLD.target_id
     OR NEW.scene_set_id IS DISTINCT FROM OLD.scene_set_id OR NEW.provider IS DISTINCT FROM OLD.provider
     OR NEW.model IS DISTINCT FROM OLD.model OR NEW.route IS DISTINCT FROM OLD.route OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at OR NEW.supersedes_attempt_id IS DISTINCT FROM OLD.supersedes_attempt_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'scene generation guard: an attempt''s identity cannot change' USING ERRCODE = '23514';
  END IF;

  -- Evidence is written once.
  IF (OLD.dispatch_started_at IS NOT NULL AND NEW.dispatch_started_at IS DISTINCT FROM OLD.dispatch_started_at)
     OR (OLD.finished_at IS NOT NULL AND NEW.finished_at IS DISTINCT FROM OLD.finished_at)
     OR (OLD.provider_image_url IS NOT NULL AND NEW.provider_image_url IS DISTINCT FROM OLD.provider_image_url)
     OR (OLD.usage_log_id IS NOT NULL AND NEW.usage_log_id IS DISTINCT FROM OLD.usage_log_id)
     OR (OLD.estimate_usd IS NOT NULL AND NEW.estimate_usd IS DISTINCT FROM OLD.estimate_usd)
     OR (OLD.error_code IS NOT NULL AND NEW.error_code IS DISTINCT FROM OLD.error_code)
     OR (OLD.error_class IS NOT NULL AND NEW.error_class IS DISTINCT FROM OLD.error_class)
     OR (OLD.message IS NOT NULL AND NEW.message IS DISTINCT FROM OLD.message)
     OR (OLD.confirm_consumed_at IS NOT NULL AND NEW.confirm_consumed_at IS DISTINCT FROM OLD.confirm_consumed_at)
     OR (OLD.confirm_consumed_by_attempt_id IS NOT NULL AND NEW.confirm_consumed_by_attempt_id IS DISTINCT FROM OLD.confirm_consumed_by_attempt_id)
     OR (OLD.confirm_consumed_by_user_id IS NOT NULL AND NEW.confirm_consumed_by_user_id IS DISTINCT FROM OLD.confirm_consumed_by_user_id)
     OR (OLD.reviewed_at IS NOT NULL AND NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at)
     OR (OLD.reviewed_by IS NOT NULL AND NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by)
     OR (OLD.review_note IS NOT NULL AND NEW.review_note IS DISTINCT FROM OLD.review_note) THEN
    RAISE EXCEPTION 'scene generation guard: recorded evidence cannot be changed' USING ERRCODE = '23514';
  END IF;
  IF NEW.storage_error IS DISTINCT FROM OLD.storage_error AND NEW.state <> 'stored_failed' AND OLD.state <> 'stored_failed' THEN
    RAISE EXCEPTION 'scene generation guard: a storage error is recorded only with a failed store' USING ERRCODE = '23514';
  END IF;

  -- State transitions.
  IF NEW.state IS DISTINCT FROM OLD.state THEN
    ok := (OLD.state = 'claimed' AND NEW.state IN ('dispatch_started', 'not_sent', 'abandoned_unsent'))
       OR (OLD.state = 'dispatch_started' AND NEW.state IN ('stored', 'stored_failed', 'not_sent', 'refused', 'uncertain'))
       OR (OLD.state = 'stored_failed' AND NEW.state = 'stored');
    IF NOT ok THEN
      RAISE EXCEPTION 'scene generation guard: attempt state cannot go from % to %', OLD.state, NEW.state USING ERRCODE = '23514';
    END IF;
  END IF;

  -- The confirmation: issued (or replaced) only on an unconsumed uncertain
  -- attempt; consumed once, unexpired, by its user, for an attempt that
  -- supersedes this one.
  IF NEW.confirm_token_hash IS DISTINCT FROM OLD.confirm_token_hash OR NEW.confirm_user_id IS DISTINCT FROM OLD.confirm_user_id
     OR NEW.confirm_expires_at IS DISTINCT FROM OLD.confirm_expires_at THEN
    IF NOT public.scene_generation_unknown_outcome(OLD.id) OR OLD.confirm_consumed_at IS NOT NULL OR NEW.confirm_consumed_at IS NOT NULL THEN
      RAISE EXCEPTION 'scene generation guard: a confirmation is issued only for an uncertain attempt not yet confirmed' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF OLD.confirm_consumed_at IS NULL AND NEW.confirm_consumed_at IS NOT NULL THEN
    IF OLD.confirm_token_hash IS NULL OR OLD.confirm_expires_at IS NULL OR OLD.confirm_expires_at <= pg_catalog.now()
       OR NEW.confirm_consumed_by_attempt_id IS NULL OR NEW.confirm_consumed_by_user_id IS NULL
       OR NEW.confirm_consumed_by_user_id IS DISTINCT FROM OLD.confirm_user_id THEN
      RAISE EXCEPTION 'scene generation guard: the confirmation is missing, expired or not this user''s' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO nxt FROM public.scene_generation_attempts WHERE id = NEW.confirm_consumed_by_attempt_id;
    IF NOT FOUND OR nxt.supersedes_attempt_id IS DISTINCT FROM OLD.id OR nxt.state <> 'claimed' THEN
      RAISE EXCEPTION 'scene generation guard: a confirmation is consumed only by the new attempt that supersedes it' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.confirm_consumed_by_attempt_id IS DISTINCT FROM OLD.confirm_consumed_by_attempt_id
     OR NEW.confirm_consumed_by_user_id IS DISTINCT FROM OLD.confirm_consumed_by_user_id THEN
    RAISE EXCEPTION 'scene generation guard: a confirmation is consumed in one step' USING ERRCODE = '23514';
  END IF;

  -- Mark reviewed: only an uncertain attempt.
  IF (NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by)
     AND NOT public.scene_generation_unknown_outcome(OLD.id) THEN
    RAISE EXCEPTION 'scene generation guard: only an uncertain attempt is marked reviewed' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $fn$`;

const FUNCTIONS = [
  'scene_generation_unknown_outcome(uuid)', 'scene_generation_target_guard()', 'scene_generation_status_write_guard()',
  'scene_generation_target_truncate_guard()', 'scene_generation_attempt_guard()',
];

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql) => sequelize.query(sql, { transaction });
      await q(PIN);
      await q(`CREATE TABLE public.scene_generation_attempts (
        id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
        target_kind VARCHAR(5) NOT NULL CHECK (target_kind IN ('set', 'angle')),
        target_id UUID NOT NULL,
        scene_set_id UUID NOT NULL,
        state VARCHAR(20) NOT NULL DEFAULT 'claimed' CHECK (state IN (
          'claimed', 'dispatch_started', 'stored', 'stored_failed', 'not_sent', 'refused', 'uncertain', 'abandoned_unsent')),
        provider VARCHAR(40) NULL,
        model VARCHAR(120) NULL,
        route VARCHAR(120) NULL,
        created_by VARCHAR(255) NULL,
        claimed_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
        dispatch_started_at TIMESTAMPTZ NULL,
        finished_at TIMESTAMPTZ NULL,
        provider_image_url TEXT NULL,
        storage_error TEXT NULL,
        usage_log_id INTEGER NULL,
        estimate_usd NUMERIC(12, 6) NULL,
        error_code VARCHAR(80) NULL,
        error_class VARCHAR(80) NULL,
        message VARCHAR(1000) NULL,
        supersedes_attempt_id UUID NULL REFERENCES public.scene_generation_attempts(id),
        confirm_token_hash CHAR(64) NULL,
        confirm_user_id VARCHAR(255) NULL,
        confirm_expires_at TIMESTAMPTZ NULL,
        confirm_consumed_at TIMESTAMPTZ NULL,
        confirm_consumed_by_attempt_id UUID NULL REFERENCES public.scene_generation_attempts(id),
        confirm_consumed_by_user_id VARCHAR(255) NULL,
        reviewed_at TIMESTAMPTZ NULL,
        reviewed_by VARCHAR(255) NULL,
        review_note VARCHAR(1000) NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
        deleted_at TIMESTAMPTZ NULL,
        CONSTRAINT scene_generation_attempts_confirm_whole CHECK (
          (confirm_token_hash IS NULL) = (confirm_user_id IS NULL) AND (confirm_token_hash IS NULL) = (confirm_expires_at IS NULL)),
        CONSTRAINT scene_generation_attempts_consumed_whole CHECK (
          (confirm_consumed_at IS NULL) = (confirm_consumed_by_attempt_id IS NULL)
          AND (confirm_consumed_at IS NULL) = (confirm_consumed_by_user_id IS NULL))
      )`);
      await q(`CREATE INDEX scene_generation_attempts_target ON public.scene_generation_attempts (target_kind, target_id, claimed_at)`);
      await q(`CREATE INDEX scene_generation_attempts_state ON public.scene_generation_attempts (state)`);
      // One paid attempt in flight per target, whatever the application does.
      await q(`CREATE UNIQUE INDEX scene_generation_attempts_one_in_flight ON public.scene_generation_attempts (target_kind, target_id)
                 WHERE state IN ('claimed', 'dispatch_started')`);

      for (const table of ['scene_sets', 'scene_angles']) {
        await q(`ALTER TABLE public.${table}
                   ADD COLUMN current_attempt_id UUID NULL REFERENCES public.scene_generation_attempts(id)`);
      }

      await q(UNKNOWN_OUTCOME);
      await q(TARGET_GUARD);
      await q(STATUS_WRITE_GUARD);
      await q(TARGET_TRUNCATE_GUARD);
      await q(ATTEMPT_GUARD);
      for (const fn of FUNCTIONS) await q(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC`);
      for (const table of ['scene_sets', 'scene_angles']) {
        await q(`CREATE TRIGGER scene_generation_target_guard BEFORE UPDATE OR DELETE ON public.${table}
                   FOR EACH ROW EXECUTE FUNCTION public.scene_generation_target_guard()`);
        await q(`CREATE TRIGGER scene_generation_status_write_guard BEFORE UPDATE OF generation_status ON public.${table}
                   FOR EACH ROW EXECUTE FUNCTION public.scene_generation_status_write_guard()`);
        await q(`CREATE TRIGGER scene_generation_target_truncate_guard BEFORE TRUNCATE ON public.${table}
                   FOR EACH STATEMENT EXECUTE FUNCTION public.scene_generation_target_truncate_guard()`);
      }
      await q(`CREATE TRIGGER scene_generation_attempt_guard BEFORE INSERT OR UPDATE OR DELETE ON public.scene_generation_attempts
                 FOR EACH ROW EXECUTE FUNCTION public.scene_generation_attempt_guard()`);
      await q(`CREATE TRIGGER scene_generation_attempt_truncate_guard BEFORE TRUNCATE ON public.scene_generation_attempts
                 FOR EACH STATEMENT EXECUTE FUNCTION public.scene_generation_attempt_guard()`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql) => sequelize.query(sql, { transaction, type: sequelize.QueryTypes.SELECT });
      await q(PIN);
      const [{ attempts }] = await q('SELECT count(*)::int AS attempts FROM public.scene_generation_attempts');
      const [{ uncertain }] = await q(`SELECT ((SELECT count(*) FROM public.scene_sets WHERE generation_status::text = 'uncertain')
        + (SELECT count(*) FROM public.scene_angles WHERE generation_status::text = 'uncertain'))::int AS uncertain`);
      if (attempts > 0 || uncertain > 0) {
        throw new Error(`Refusing to remove the scene generation safeguards: ${attempts} recorded attempt(s) and ${uncertain} uncertain scene set(s) or angle(s). The attempts are evidence of paid requests and the uncertain rows may already have been charged; nothing is converted into a retryable status. Nothing was changed.`);
      }
      for (const table of ['scene_sets', 'scene_angles']) {
        for (const trg of ['scene_generation_target_guard', 'scene_generation_status_write_guard', 'scene_generation_target_truncate_guard']) {
          await q(`DROP TRIGGER IF EXISTS ${trg} ON public.${table}`);
        }
        await q(`ALTER TABLE public.${table} DROP COLUMN IF EXISTS current_attempt_id`);
      }
      await q('DROP TABLE IF EXISTS public.scene_generation_attempts');
      for (const fn of ['scene_generation_target_guard()', 'scene_generation_status_write_guard()', 'scene_generation_target_truncate_guard()',
        'scene_generation_attempt_guard()', 'scene_generation_unknown_outcome(uuid)']) {
        await q(`DROP FUNCTION IF EXISTS public.${fn}`);
      }
    });
  },
};
