'use strict';

/**
 * AI egress gateway, phase G2 (Evoni, 2026-11-08): the durable ledger and
 * Stop control behind the G1 decision core (the gateway module, inert). Nothing in
 * the application calls these functions; creating them changes no behaviour.
 * Specification: docs/design/2026-11-ai-egress-gateway-m0.md.
 *
 * Tables (all new; no existing table changes):
 *   aigw_operations       the paid submission operations (fixed list)
 *   aigw_control          singleton Stop state, pauses, caps, the pending
 *                         Resume challenge, the gateway acknowledgement.
 *                         Seeded STOPPED with no caps: fail closed until an
 *                         administrator commissions it.
 *   aigw_permits          the ledger: one single-use permit per attempt,
 *                         every bound field immutable, phases moving only
 *                         along the allowed transitions
 *   aigw_permit_events    append-only history of every permit change
 *   aigw_reconciliations  append-only evidence-backed reconciliations
 *   aigw_audit            append-only administrative actions
 *
 * Access is only through SECURITY DEFINER functions (search_path pinned,
 * every name schema-qualified). This migration grants EXECUTE to nobody; the
 * hand-run role script (scripts/aigw/sql/aigw-roles.sql) grants each role
 * exactly its functions (aigwDbGrants.js, beside the G1 core) and moves
 * ownership to a NOLOGIN owner role, so the application login owns nothing.
 *
 * Lock order (every function takes a subset, always in this order):
 *   L1 the control row (FOR SHARE to read, UPDATE to change)
 *   L2 the logical-key advisory lock      aigw:lk:<logical_key>
 *   L3 the day advisory lock              aigw:day:<reservation_day>
 *   L4 permit rows (FOR UPDATE; several only in id order, SKIP LOCKED)
 *
 * down refuses while any permit, event, reconciliation or audit row exists.
 */

const SUBMISSION_OPERATIONS = [
  ['anthropic.messages', 'anthropic', 'writing', 'json'],
  ['openai.images.generations', 'openai', 'images', 'json'],
  ['openai.images.edits', 'openai', 'images', 'multipart'],
  ['fal.run', 'fal', 'images', 'json'],
  ['runway.image_to_video', 'runway', 'video', 'json'],
  ['replicate.predictions.create', 'replicate', 'images', 'json'],
  ['replicate.models.predictions.create', 'replicate', 'images', 'json'],
  ['elevenlabs.tts', 'elevenlabs', 'voice', 'json'],
  ['removebg', 'removebg', 'images', 'multipart'],
];

const TABLES = ['aigw_operations', 'aigw_control', 'aigw_permits', 'aigw_permit_events', 'aigw_reconciliations', 'aigw_audit'];

const FUNCTIONS = [
  'aigw_transition_allowed(text, text)',
  'aigw_actor(text)',
  'aigw_exposure_internal(date, text)',
  'aigw_permit_json(public.aigw_permits)',
  'aigw_event(uuid, text, text, text, text)',
  'aigw_permits_guard()',
  'aigw_append_only_guard()',
  'aigw_control_guard()',
  'aigw_authorize(jsonb)',
  'aigw_get_permit(uuid)',
  'aigw_dispatch(uuid, text, text)',
  'aigw_abandon_authorized(uuid, text)',
  'aigw_mark_not_forwarded(uuid, text, text)',
  'aigw_record_outcome(uuid, jsonb)',
  'aigw_sweep(interval, integer)',
  'aigw_find_by_task(text, text)',
  'aigw_reconcile(uuid, jsonb)',
  'aigw_exposure(date, text)',
  'aigw_read_control()',
  'aigw_stop(text, text)',
  'aigw_request_resume(jsonb)',
  'aigw_confirm_resume(jsonb)',
  'aigw_cancel_resume(text, text)',
  'aigw_set_pause(text, boolean, text, text)',
  'aigw_set_caps(jsonb)',
  'aigw_gateway_ack(jsonb)',
];

const DEFINER = 'SECURITY DEFINER SET search_path = pg_catalog, pg_temp';

const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS public.aigw_operations (
     operation text PRIMARY KEY,
     provider text NOT NULL,
     service text NOT NULL CHECK (service IN ('images', 'video', 'voice', 'writing')),
     body_kind text NOT NULL CHECK (body_kind IN ('json', 'multipart')),
     created_at timestamptz NOT NULL DEFAULT now(),
     deleted_at timestamptz NULL CHECK (deleted_at IS NULL)
   )`,
  `INSERT INTO public.aigw_operations (operation, provider, service, body_kind) VALUES
     ${SUBMISSION_OPERATIONS.map(([o, p, s, b]) => `('${o}', '${p}', '${s}', '${b}')`).join(',\n     ')}
   ON CONFLICT (operation) DO NOTHING`,

  `CREATE TABLE IF NOT EXISTS public.aigw_control (
     id smallint PRIMARY KEY CHECK (id = 1),
     global_state text NOT NULL CHECK (global_state IN ('RELEASED', 'STOPPED', 'RESUME_PENDING')),
     version bigint NOT NULL CHECK (version >= 1),
     paused_images boolean NOT NULL DEFAULT false,
     paused_video boolean NOT NULL DEFAULT false,
     paused_voice boolean NOT NULL DEFAULT false,
     paused_writing boolean NOT NULL DEFAULT false,
     daily_cap_micros bigint NULL CHECK (daily_cap_micros IS NULL OR daily_cap_micros >= 0),
     image_daily_cap_micros bigint NULL CHECK (image_daily_cap_micros IS NULL OR image_daily_cap_micros >= 0),
     resume_challenge_id uuid NULL,
     resume_nonce_hash text NULL CHECK (resume_nonce_hash IS NULL OR resume_nonce_hash ~ '^[0-9a-f]{64}$'),
     resume_requested_by text NULL,
     resume_target_version bigint NULL,
     resume_expires_at timestamptz NULL,
     resume_consumed_at timestamptz NULL,
     gateway_ack_version bigint NULL,
     gateway_ack_at timestamptz NULL,
     gateway_ack_effective text NULL,
     gateway_ack_instance text NULL,
     gateway_inflight_at_ack jsonb NULL,
     changed_by text NOT NULL,
     changed_at timestamptz NOT NULL DEFAULT now(),
     reason text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now(),
     deleted_at timestamptz NULL CHECK (deleted_at IS NULL)
   )`,
  `INSERT INTO public.aigw_control (id, global_state, version, changed_by, reason)
   VALUES (1, 'STOPPED', 1, 'migration', 'initial: the AI egress gateway is not commissioned')
   ON CONFLICT (id) DO NOTHING`,

  `CREATE TABLE IF NOT EXISTS public.aigw_permits (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     secret_hash text NOT NULL CHECK (secret_hash ~ '^[0-9a-f]{64}$'),
     caller_class text NOT NULL CHECK (caller_class IN ('api', 'worker', 'script')),
     caller_instance text NOT NULL CHECK (length(caller_instance) BETWEEN 1 AND 200),
     provider text NOT NULL,
     operation text NOT NULL REFERENCES public.aigw_operations (operation),
     service text NOT NULL CHECK (service IN ('images', 'video', 'voice', 'writing')),
     model text NOT NULL CHECK (length(model) BETWEEN 1 AND 200),
     model_version text NULL,
     job_type text NULL,
     job_id text NULL,
     logical_key text NOT NULL CHECK (length(logical_key) BETWEEN 1 AND 200),
     attempt integer NOT NULL CHECK (attempt >= 1),
     estimate_micros bigint NOT NULL CHECK (estimate_micros >= 0),
     unpriced boolean NOT NULL,
     strict boolean NOT NULL,
     price_catalog_id bigint NULL,
     reservation_day date NOT NULL,
     session_id uuid NULL,
     activation_id uuid NULL,
     authorized_version bigint NOT NULL,
     expires_at timestamptz NOT NULL,
     body_kind text NOT NULL CHECK (body_kind IN ('json', 'multipart')),
     body_sha256 text NOT NULL CHECK (body_sha256 ~ '^[0-9a-f]{64}$'),
     body_bytes bigint NOT NULL CHECK (body_bytes >= 0),
     billing_fields jsonb NULL,
     billing_fields_canonical text NULL,
     billing_headers jsonb NOT NULL DEFAULT '{}'::jsonb,
     billing_fields_verification text NOT NULL CHECK (billing_fields_verification IN ('parsed', 'hash_bound_only')),
     phase text NOT NULL CHECK (phase IN ('authorized', 'dispatching', 'accepted', 'provider_succeeded', 'succeeded',
                                          'failed_confirmed', 'unknown', 'abandoned', 'not_sent')),
     billed text NOT NULL DEFAULT 'unknown' CHECK (billed IN ('yes', 'no', 'unknown')),
     confirmed_micros bigint NULL CHECK (confirmed_micros IS NULL OR confirmed_micros >= 0),
     provider_task_id text NULL,
     dispatch_version bigint NULL,
     dispatched_at timestamptz NULL,
     dispatched_by text NULL,
     settled_at timestamptz NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now(),
     deleted_at timestamptz NULL CHECK (deleted_at IS NULL),
     CONSTRAINT aigw_permits_attempt_once UNIQUE (logical_key, attempt),
     -- the G1 limitation, recorded: a multipart body is bound by its hash only
     CONSTRAINT aigw_permits_multipart_hash_only CHECK ((body_kind = 'multipart') = (billing_fields_verification = 'hash_bound_only')),
     CONSTRAINT aigw_permits_json_fields CHECK (body_kind <> 'json' OR (billing_fields IS NOT NULL AND billing_fields_canonical IS NOT NULL)),
     -- strict work can never be authorized on unverified billing fields
     CONSTRAINT aigw_permits_strict_needs_parsed_fields CHECK (NOT (strict AND billing_fields_verification = 'hash_bound_only'))
   )`,
  `CREATE INDEX IF NOT EXISTS aigw_permits_open ON public.aigw_permits (phase)
     WHERE phase IN ('authorized', 'dispatching', 'accepted', 'provider_succeeded', 'unknown')`,
  'CREATE INDEX IF NOT EXISTS aigw_permits_day ON public.aigw_permits (reservation_day)',
  'CREATE INDEX IF NOT EXISTS aigw_permits_logical_key ON public.aigw_permits (logical_key)',
  `CREATE UNIQUE INDEX IF NOT EXISTS aigw_permits_task ON public.aigw_permits (provider, provider_task_id)
     WHERE provider_task_id IS NOT NULL`,

  `CREATE TABLE IF NOT EXISTS public.aigw_permit_events (
     id bigserial PRIMARY KEY,
     permit_id uuid NOT NULL REFERENCES public.aigw_permits (id),
     from_phase text NULL,
     to_phase text NOT NULL,
     cause text NOT NULL,
     actor text NOT NULL,
     estimate_micros bigint NULL,
     confirmed_micros bigint NULL,
     billed text NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     deleted_at timestamptz NULL CHECK (deleted_at IS NULL)
   )`,
  'CREATE INDEX IF NOT EXISTS aigw_permit_events_permit ON public.aigw_permit_events (permit_id, id)',

  `CREATE TABLE IF NOT EXISTS public.aigw_reconciliations (
     id bigserial PRIMARY KEY,
     permit_id uuid NOT NULL REFERENCES public.aigw_permits (id),
     decided_by text NOT NULL,
     method text NOT NULL CHECK (method IN ('provider_status_read', 'provider_dashboard', 'provider_invoice',
                                            'asset_attach', 'refund_record', 'owner_judgement')),
     evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence) = 'object' AND evidence <> '{}'::jsonb),
     from_phase text NOT NULL,
     to_phase text NOT NULL,
     billed_before text NOT NULL,
     billed_after text NOT NULL,
     confirmed_micros bigint NULL,
     reason text NOT NULL CHECK (length(btrim(reason)) > 0),
     created_at timestamptz NOT NULL DEFAULT now(),
     deleted_at timestamptz NULL CHECK (deleted_at IS NULL)
   )`,

  `CREATE TABLE IF NOT EXISTS public.aigw_audit (
     id bigserial PRIMARY KEY,
     actor text NOT NULL,
     action text NOT NULL,
     target_type text NOT NULL,
     target_id text NULL,
     before jsonb NULL,
     after jsonb NULL,
     reason text NOT NULL CHECK (length(btrim(reason)) > 0),
     created_at timestamptz NOT NULL DEFAULT now(),
     deleted_at timestamptz NULL CHECK (deleted_at IS NULL)
   )`,
];

const FUNCTION_SQL = [
  // The allowed phase moves (the G1 reference TRANSITIONS table).
  `CREATE OR REPLACE FUNCTION public.aigw_transition_allowed(p_from text, p_to text) RETURNS boolean
   LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, pg_temp AS $f$
     SELECT CASE p_from
       WHEN 'authorized' THEN p_to IN ('dispatching', 'not_sent')
       WHEN 'dispatching' THEN p_to IN ('not_sent', 'accepted', 'provider_succeeded', 'succeeded', 'failed_confirmed', 'unknown')
       WHEN 'accepted' THEN p_to IN ('provider_succeeded', 'succeeded', 'failed_confirmed', 'unknown')
       WHEN 'provider_succeeded' THEN p_to IN ('succeeded', 'failed_confirmed', 'unknown')
       WHEN 'unknown' THEN p_to IN ('accepted', 'provider_succeeded', 'succeeded', 'failed_confirmed', 'abandoned')
       ELSE false
     END
   $f$`,

  `CREATE OR REPLACE FUNCTION public.aigw_actor(p_actor text) RETURNS text
   LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp AS $f$
     SELECT COALESCE(NULLIF(btrim(p_actor), ''), 'unnamed') || ' via ' || session_user::text
   $f$`,

  // Three-amount exposure, mirroring the G1 budget module (exposureOf).
  `CREATE OR REPLACE FUNCTION public.aigw_exposure_internal(p_day date, p_service text)
   RETURNS TABLE (reserved bigint, confirmed bigint, uncertain bigint)
   LANGUAGE sql STABLE ${DEFINER} AS $f$
     SELECT
       COALESCE(SUM(CASE WHEN phase IN ('authorized', 'dispatching', 'accepted', 'provider_succeeded') THEN estimate_micros ELSE 0 END), 0)::bigint,
       COALESCE(SUM(CASE WHEN phase IN ('succeeded', 'failed_confirmed', 'abandoned') AND billed = 'yes'
                         THEN COALESCE(confirmed_micros, estimate_micros) ELSE 0 END), 0)::bigint,
       COALESCE(SUM(CASE WHEN phase = 'unknown'
                           OR (phase IN ('succeeded', 'failed_confirmed', 'abandoned') AND billed = 'unknown')
                         THEN estimate_micros ELSE 0 END), 0)::bigint
     FROM public.aigw_permits
     WHERE reservation_day = p_day AND (p_service IS NULL OR service = p_service)
   $f$`,

  `CREATE OR REPLACE FUNCTION public.aigw_permit_json(r public.aigw_permits) RETURNS jsonb
   LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp AS $f$
     SELECT jsonb_build_object(
       'id', r.id, 'secret_hash', r.secret_hash, 'caller_class', r.caller_class, 'caller_instance', r.caller_instance,
       'provider', r.provider, 'operation', r.operation, 'service', r.service, 'model', r.model,
       'model_version', r.model_version, 'job_type', r.job_type, 'job_id', r.job_id, 'logical_key', r.logical_key,
       'attempt', r.attempt, 'estimate_micros', r.estimate_micros, 'unpriced', r.unpriced, 'strict', r.strict,
       'price_catalog_id', r.price_catalog_id, 'reservation_day', to_char(r.reservation_day, 'YYYY-MM-DD'),
       'session_id', r.session_id, 'activation_id', r.activation_id, 'authorized_version', r.authorized_version,
       'expires_at_ms', floor(extract(epoch FROM r.expires_at) * 1000)::bigint,
       'body_kind', r.body_kind, 'body_sha256', r.body_sha256, 'body_bytes', r.body_bytes,
       'billing_fields', r.billing_fields, 'billing_fields_canonical', r.billing_fields_canonical,
       'billing_headers', r.billing_headers, 'billing_fields_verification', r.billing_fields_verification,
       'phase', r.phase, 'billed', r.billed, 'confirmed_micros', r.confirmed_micros, 'provider_task_id', r.provider_task_id,
       'dispatch_version', r.dispatch_version, 'dispatched_by', r.dispatched_by)
   $f$`,

  `CREATE OR REPLACE FUNCTION public.aigw_event(p_permit uuid, p_from text, p_to text, p_cause text, p_actor text)
   RETURNS void LANGUAGE plpgsql ${DEFINER} AS $f$
   BEGIN
     INSERT INTO public.aigw_permit_events (permit_id, from_phase, to_phase, cause, actor, estimate_micros, confirmed_micros, billed)
     SELECT p_permit, p_from, p_to, p_cause, public.aigw_actor(p_actor), estimate_micros, confirmed_micros, billed
       FROM public.aigw_permits WHERE id = p_permit;
   END
   $f$`,

  // Permit guard: bound fields immutable; phases only along the allowed
  // moves; dispatching -> not_sent only with the gateway's proof; terminal
  // billing changes only through reconciliation; no delete, no truncate.
  `CREATE OR REPLACE FUNCTION public.aigw_permits_guard() RETURNS trigger
   LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $f$
   BEGIN
     IF TG_OP = 'TRUNCATE' OR TG_OP = 'DELETE' THEN
       RAISE EXCEPTION 'aigw_permits is append-only: % is not allowed', TG_OP;
     END IF;
     IF TG_OP = 'INSERT' THEN
       IF NEW.phase <> 'authorized' OR NEW.billed <> 'unknown' OR NEW.confirmed_micros IS NOT NULL
          OR NEW.provider_task_id IS NOT NULL OR NEW.dispatch_version IS NOT NULL OR NEW.dispatched_at IS NOT NULL
          OR NEW.settled_at IS NOT NULL THEN
         RAISE EXCEPTION 'aigw_permits: a permit must be inserted as authorized and unsettled';
       END IF;
       NEW.created_at := now();
       NEW.updated_at := now();
       RETURN NEW;
     END IF;
     IF (OLD.id, OLD.secret_hash, OLD.caller_class, OLD.caller_instance, OLD.provider, OLD.operation, OLD.service,
         OLD.model, OLD.model_version, OLD.job_type, OLD.job_id, OLD.logical_key, OLD.attempt, OLD.estimate_micros,
         OLD.unpriced, OLD."strict", OLD.price_catalog_id, OLD.reservation_day, OLD.session_id, OLD.activation_id,
         OLD.authorized_version, OLD.expires_at, OLD.body_kind, OLD.body_sha256, OLD.body_bytes, OLD.billing_fields,
         OLD.billing_fields_canonical, OLD.billing_headers, OLD.billing_fields_verification, OLD.created_at)
        IS DISTINCT FROM
        (NEW.id, NEW.secret_hash, NEW.caller_class, NEW.caller_instance, NEW.provider, NEW.operation, NEW.service,
         NEW.model, NEW.model_version, NEW.job_type, NEW.job_id, NEW.logical_key, NEW.attempt, NEW.estimate_micros,
         NEW.unpriced, NEW."strict", NEW.price_catalog_id, NEW.reservation_day, NEW.session_id, NEW.activation_id,
         NEW.authorized_version, NEW.expires_at, NEW.body_kind, NEW.body_sha256, NEW.body_bytes, NEW.billing_fields,
         NEW.billing_fields_canonical, NEW.billing_headers, NEW.billing_fields_verification, NEW.created_at) THEN
       RAISE EXCEPTION 'aigw_permits: bound fields are immutable';
     END IF;
     IF NEW.deleted_at IS NOT NULL THEN
       RAISE EXCEPTION 'aigw_permits: deleted_at can never be set';
     END IF;
     IF (OLD.dispatch_version, OLD.dispatched_at, OLD.dispatched_by) IS DISTINCT FROM (NEW.dispatch_version, NEW.dispatched_at, NEW.dispatched_by)
        AND NOT (OLD.phase = 'authorized' AND NEW.phase = 'dispatching') THEN
       RAISE EXCEPTION 'aigw_permits: dispatch fields are set only by dispatch';
     END IF;
     IF NEW.phase IS DISTINCT FROM OLD.phase THEN
       IF NOT public.aigw_transition_allowed(OLD.phase, NEW.phase) THEN
         RAISE EXCEPTION 'aigw_permits: illegal transition % -> %', OLD.phase, NEW.phase;
       END IF;
       IF OLD.phase = 'dispatching' AND NEW.phase = 'not_sent'
          AND COALESCE(current_setting('aigw.not_sent_proof', true), '') <> 'proven' THEN
         RAISE EXCEPTION 'aigw_permits: a dispatched request becomes not_sent only with proof it was never forwarded';
       END IF;
     ELSIF OLD.phase IN ('succeeded', 'failed_confirmed', 'not_sent', 'abandoned')
           AND (OLD.billed, OLD.confirmed_micros) IS DISTINCT FROM (NEW.billed, NEW.confirmed_micros)
           AND COALESCE(current_setting('aigw.reconcile', true), '') <> 'on' THEN
       RAISE EXCEPTION 'aigw_permits: a settled permit changes only through reconciliation';
     END IF;
     NEW.updated_at := now();
     RETURN NEW;
   END
   $f$`,

  `CREATE OR REPLACE FUNCTION public.aigw_append_only_guard() RETURNS trigger
   LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $f$
   BEGIN
     IF TG_OP = 'INSERT' THEN
       NEW.created_at := now();
       IF NEW.deleted_at IS NOT NULL THEN RAISE EXCEPTION '%: deleted_at can never be set', TG_TABLE_NAME; END IF;
       RETURN NEW;
     END IF;
     RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP;
   END
   $f$`,

  `CREATE OR REPLACE FUNCTION public.aigw_control_guard() RETURNS trigger
   LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $f$
   BEGIN
     IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
       RAISE EXCEPTION 'aigw_control: % is not allowed', TG_OP;
     END IF;
     IF TG_OP = 'UPDATE' THEN
       IF NEW.version < OLD.version THEN RAISE EXCEPTION 'aigw_control: version can only increase'; END IF;
       IF NEW.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'aigw_control: deleted_at can never be set'; END IF;
       NEW.updated_at := now();
     END IF;
     RETURN NEW;
   END
   $f$`,

  // ---------------------------------------------------------------- T1
  `CREATE OR REPLACE FUNCTION public.aigw_authorize(p jsonb) RETURNS jsonb
   LANGUAGE plpgsql ${DEFINER} AS $f$
   DECLARE
     c public.aigw_control%ROWTYPE;
     op public.aigw_operations%ROWTYPE;
     v_strict boolean := COALESCE((p->>'strict')::boolean, false);
     v_est bigint := (p->>'estimate_micros')::bigint;
     v_day date := (p->>'reservation_day')::date;
     v_key text := p->>'logical_key';
     v_attempt integer := (p->>'attempt')::integer;
     v_ttl_ms integer := (p->>'ttl_ms')::integer;
     v_paused boolean;
     v_prior text;
     e record;
     ei record;
     v_id uuid;
     v_exp timestamptz;
   BEGIN
     PERFORM pg_catalog.set_config('lock_timeout', '2s', true);
     -- L1
     SELECT * INTO c FROM public.aigw_control WHERE id = 1 FOR SHARE;
     IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'CONTROL_MISSING'); END IF;
     IF c.global_state <> 'RELEASED' THEN
       RETURN jsonb_build_object('ok', false, 'code', 'STOPPED', 'version', c.version);
     END IF;
     SELECT * INTO op FROM public.aigw_operations WHERE operation = p->>'operation';
     IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'NOT_A_SUBMISSION'); END IF;
     IF op.provider IS DISTINCT FROM p->>'provider' THEN RETURN jsonb_build_object('ok', false, 'code', 'PROVIDER_MISMATCH'); END IF;
     IF op.body_kind IS DISTINCT FROM p->>'body_kind' THEN RETURN jsonb_build_object('ok', false, 'code', 'BODY_KIND_MISMATCH'); END IF;
     v_paused := CASE op.service WHEN 'images' THEN c.paused_images WHEN 'video' THEN c.paused_video
                                 WHEN 'voice' THEN c.paused_voice ELSE c.paused_writing END;
     IF v_paused THEN RETURN jsonb_build_object('ok', false, 'code', 'SERVICE_PAUSED', 'version', c.version); END IF;
     IF v_strict AND op.body_kind = 'multipart' THEN
       RETURN jsonb_build_object('ok', false, 'code', 'MULTIPART_FIELDS_UNVERIFIED');
     END IF;
     IF v_strict THEN
       -- No verified price catalogue exists yet: strict work is refused.
       RETURN jsonb_build_object('ok', false, 'code', 'PRICE_NOT_VERIFIED');
     END IF;
     IF v_est IS NOT NULL AND v_est < 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'ESTIMATE_INVALID'); END IF;
     -- Missing caps refuse: there is no default budget.
     IF c.daily_cap_micros IS NULL OR (op.service = 'images' AND c.image_daily_cap_micros IS NULL) THEN
       RETURN jsonb_build_object('ok', false, 'code', 'CAP_UNAVAILABLE');
     END IF;
     IF v_key IS NULL OR v_attempt IS NULL OR v_attempt < 1 OR v_day IS NULL THEN
       RETURN jsonb_build_object('ok', false, 'code', 'PERMIT_FIELDS_MISSING');
     END IF;
     IF v_ttl_ms IS NULL OR v_ttl_ms < 1000 OR v_ttl_ms > 600000 THEN
       RETURN jsonb_build_object('ok', false, 'code', 'TTL_INVALID');
     END IF;
     -- L2: one decision at a time per logical request
     PERFORM pg_advisory_xact_lock(hashtextextended('aigw:lk:' || v_key, 0));
     IF EXISTS (SELECT 1 FROM public.aigw_permits WHERE logical_key = v_key AND attempt = v_attempt) THEN
       RETURN jsonb_build_object('ok', false, 'code', 'ATTEMPT_EXISTS');
     END IF;
     SELECT CASE WHEN bool_or(phase = 'unknown') THEN 'PRIOR_ATTEMPT_UNKNOWN'
                 WHEN bool_or(phase NOT IN ('not_sent', 'failed_confirmed')) THEN 'PRIOR_ATTEMPT_NOT_RETRYABLE'
            END INTO v_prior
       FROM public.aigw_permits WHERE logical_key = v_key;
     IF v_prior IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'code', v_prior); END IF;
     -- L3: one budget decision at a time per day
     PERFORM pg_advisory_xact_lock(hashtextextended('aigw:day:' || v_day::text, 0));
     SELECT * INTO e FROM public.aigw_exposure_internal(v_day, NULL);
     IF e.reserved + e.confirmed + e.uncertain + COALESCE(v_est, 0) > c.daily_cap_micros THEN
       RETURN jsonb_build_object('ok', false, 'code', 'DAILY_CAP');
     END IF;
     IF op.service = 'images' THEN
       SELECT * INTO ei FROM public.aigw_exposure_internal(v_day, 'images');
       IF ei.reserved + ei.confirmed + ei.uncertain + COALESCE(v_est, 0) > c.image_daily_cap_micros THEN
         RETURN jsonb_build_object('ok', false, 'code', 'IMAGE_DAILY_CAP');
       END IF;
     END IF;
     INSERT INTO public.aigw_permits (
       secret_hash, caller_class, caller_instance, provider, operation, service, model, model_version, job_type, job_id,
       logical_key, attempt, estimate_micros, unpriced, strict, price_catalog_id, reservation_day, session_id, activation_id,
       authorized_version, expires_at, body_kind, body_sha256, body_bytes, billing_fields, billing_fields_canonical,
       billing_headers, billing_fields_verification, phase)
     VALUES (
       p->>'secret_hash', p->>'caller_class', p->>'caller_instance', op.provider, op.operation, op.service, p->>'model',
       p->>'model_version', p->>'job_type', p->>'job_id', v_key, v_attempt, COALESCE(v_est, 0), v_est IS NULL, v_strict,
       (p->>'price_catalog_id')::bigint, v_day, (p->>'session_id')::uuid, (p->>'activation_id')::uuid, c.version,
       clock_timestamp() + make_interval(secs => v_ttl_ms / 1000.0), op.body_kind, p->>'body_sha256',
       (p->>'body_bytes')::bigint, p->'billing_fields', p->>'billing_fields_canonical', COALESCE(p->'billing_headers', '{}'::jsonb),
       CASE WHEN op.body_kind = 'multipart' THEN 'hash_bound_only' ELSE 'parsed' END, 'authorized')
     RETURNING id, expires_at INTO v_id, v_exp;
     PERFORM public.aigw_event(v_id, NULL, 'authorized', 'authorize', p->>'caller_instance');
     RETURN jsonb_build_object('ok', true, 'permit_id', v_id, 'authorized_version', c.version,
                               'expires_at_ms', floor(extract(epoch FROM v_exp) * 1000)::bigint,
                               'unpriced', v_est IS NULL);
   END
   $f$`,

  `CREATE OR REPLACE FUNCTION public.aigw_get_permit(p_id uuid) RETURNS jsonb
   LANGUAGE sql STABLE ${DEFINER} AS $f$
     SELECT public.aigw_permit_json(r) FROM public.aigw_permits r WHERE r.id = p_id
   $f$`,

  // ---------------------------------------------------------------- T2
  `CREATE OR REPLACE FUNCTION public.aigw_dispatch(p_id uuid, p_operation text, p_instance text) RETURNS jsonb
   LANGUAGE plpgsql ${DEFINER} AS $f$
   DECLARE
     c public.aigw_control%ROWTYPE;
     r public.aigw_permits%ROWTYPE;
     v_paused boolean;
   BEGIN
     PERFORM pg_catalog.set_config('lock_timeout', '2s', true);
     SELECT * INTO c FROM public.aigw_control WHERE id = 1 FOR SHARE;           -- L1
     IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'CONTROL_MISSING'); END IF;
     SELECT * INTO r FROM public.aigw_permits WHERE id = p_id FOR UPDATE;      -- L4
     IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'PERMIT_UNKNOWN'); END IF;
     IF r.phase <> 'authorized' THEN RETURN jsonb_build_object('ok', false, 'code', 'PERMIT_USED'); END IF;
     IF r.operation <> p_operation THEN RETURN jsonb_build_object('ok', false, 'code', 'OPERATION_MISMATCH'); END IF;
     IF clock_timestamp() >= r.expires_at THEN
       UPDATE public.aigw_permits SET phase = 'not_sent', billed = 'no' WHERE id = p_id;
       PERFORM public.aigw_event(p_id, 'authorized', 'not_sent', 'permit_expired', p_instance);
       RETURN jsonb_build_object('ok', false, 'code', 'PERMIT_EXPIRED');
     END IF;
     v_paused := CASE r.service WHEN 'images' THEN c.paused_images WHEN 'video' THEN c.paused_video
                                WHEN 'voice' THEN c.paused_voice ELSE c.paused_writing END;
     IF c.global_state <> 'RELEASED' OR v_paused THEN
       UPDATE public.aigw_permits SET phase = 'not_sent', billed = 'no' WHERE id = p_id;
       PERFORM public.aigw_event(p_id, 'authorized', 'not_sent', 'stopped_at_dispatch', p_instance);
       RETURN jsonb_build_object('ok', false, 'code', 'STOPPED', 'version', c.version);
     END IF;
     UPDATE public.aigw_permits
        SET phase = 'dispatching', dispatch_version = c.version, dispatched_at = clock_timestamp(), dispatched_by = p_instance
      WHERE id = p_id;
     PERFORM public.aigw_event(p_id, 'authorized', 'dispatching', 'dispatch', p_instance);
     RETURN jsonb_build_object('ok', true, 'dispatch_version', c.version);
   END
   $f$`,

  `CREATE OR REPLACE FUNCTION public.aigw_abandon_authorized(p_id uuid, p_cause text) RETURNS jsonb
   LANGUAGE plpgsql ${DEFINER} AS $f$
   DECLARE r public.aigw_permits%ROWTYPE;
   BEGIN
     PERFORM pg_catalog.set_config('lock_timeout', '2s', true);
     SELECT * INTO r FROM public.aigw_permits WHERE id = p_id FOR UPDATE;      -- L4
     IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'PERMIT_UNKNOWN'); END IF;
     IF r.phase = 'not_sent' THEN RETURN jsonb_build_object('ok', true); END IF;
     IF r.phase = 'dispatching' THEN RETURN jsonb_build_object('ok', false, 'code', 'NOT_SENT_REQUIRES_PROOF'); END IF;
     IF r.phase <> 'authorized' THEN RETURN jsonb_build_object('ok', false, 'code', 'NOT_SENT_NOT_ALLOWED'); END IF;
     UPDATE public.aigw_permits SET phase = 'not_sent', billed = 'no' WHERE id = p_id;
     PERFORM public.aigw_event(p_id, 'authorized', 'not_sent', COALESCE(p_cause, 'abandoned'), NULL);
     RETURN jsonb_build_object('ok', true);
   END
   $f$`,

  // The gateway's same-turn refusal after dispatch (G1 dispatcher step 6):
  // only the gateway instance that dispatched it can attest it never left.
  `CREATE OR REPLACE FUNCTION public.aigw_mark_not_forwarded(p_id uuid, p_cause text, p_instance text) RETURNS jsonb
   LANGUAGE plpgsql ${DEFINER} AS $f$
   DECLARE r public.aigw_permits%ROWTYPE;
   BEGIN
     PERFORM pg_catalog.set_config('lock_timeout', '2s', true);
     SELECT * INTO r FROM public.aigw_permits WHERE id = p_id FOR UPDATE;      -- L4
     IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'PERMIT_UNKNOWN'); END IF;
     IF r.phase = 'not_sent' THEN RETURN jsonb_build_object('ok', true); END IF;
     IF r.phase = 'authorized' THEN
       UPDATE public.aigw_permits SET phase = 'not_sent', billed = 'no' WHERE id = p_id;
       PERFORM public.aigw_event(p_id, 'authorized', 'not_sent', COALESCE(p_cause, 'refused'), p_instance);
       RETURN jsonb_build_object('ok', true);
     END IF;
     IF r.phase <> 'dispatching' OR r.dispatched_by IS DISTINCT FROM p_instance THEN
       RETURN jsonb_build_object('ok', false, 'code', 'NOT_SENT_NOT_ALLOWED');
     END IF;
     PERFORM pg_catalog.set_config('aigw.not_sent_proof', 'proven', true);
     UPDATE public.aigw_permits SET phase = 'not_sent', billed = 'no' WHERE id = p_id;
     PERFORM pg_catalog.set_config('aigw.not_sent_proof', '', true);
     PERFORM public.aigw_event(p_id, 'dispatching', 'not_sent', COALESCE(p_cause, 'not_forwarded'), p_instance);
     RETURN jsonb_build_object('ok', true);
   END
   $f$`,

  // ---------------------------------------------------------------- T3
  `CREATE OR REPLACE FUNCTION public.aigw_record_outcome(p_id uuid, p jsonb) RETURNS jsonb
   LANGUAGE plpgsql ${DEFINER} AS $f$
   DECLARE
     r public.aigw_permits%ROWTYPE;
     v_day date;
     v_to text := p->>'phase';
     v_proof boolean := COALESCE((p->>'pre_send_proof')::boolean, false);
     v_billed text;
   BEGIN
     PERFORM pg_catalog.set_config('lock_timeout', '2s', true);
     SELECT reservation_day INTO v_day FROM public.aigw_permits WHERE id = p_id;  -- immutable
     IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'PERMIT_UNKNOWN'); END IF;
     PERFORM pg_advisory_xact_lock(hashtextextended('aigw:day:' || v_day::text, 0));   -- L3
     SELECT * INTO r FROM public.aigw_permits WHERE id = p_id FOR UPDATE;              -- L4
     -- Uncertainty is preserved: an unknown attempt leaves unknown only by an
     -- evidence-backed reconciliation (aigw_reconcile), never by the gateway.
     IF r.phase = 'unknown' THEN
       RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN_REQUIRES_RECONCILIATION');
     END IF;
     IF NOT public.aigw_transition_allowed(r.phase, v_to) THEN
       RETURN jsonb_build_object('ok', false, 'code', 'ILLEGAL_TRANSITION_' || r.phase || '_TO_' || COALESCE(v_to, 'null'));
     END IF;
     IF r.phase = 'dispatching' AND v_to = 'not_sent'
        AND (NOT v_proof OR r.dispatched_by IS DISTINCT FROM p->>'instance') THEN
       RETURN jsonb_build_object('ok', false, 'code', 'NOT_SENT_REQUIRES_PROOF');
     END IF;
     v_billed := CASE WHEN v_to = 'not_sent' THEN 'no'
                      WHEN p->>'billed' IN ('yes', 'no') THEN p->>'billed'
                      ELSE r.billed END;
     IF v_to = 'not_sent' THEN PERFORM pg_catalog.set_config('aigw.not_sent_proof', 'proven', true); END IF;
     UPDATE public.aigw_permits
        SET phase = v_to,
            billed = v_billed,
            confirmed_micros = COALESCE((p->>'confirmed_micros')::bigint, confirmed_micros),
            provider_task_id = COALESCE(provider_task_id, NULLIF(p->>'task_id', '')),
            settled_at = CASE WHEN v_to IN ('succeeded', 'failed_confirmed', 'not_sent', 'abandoned') THEN clock_timestamp() ELSE settled_at END
      WHERE id = p_id;
     PERFORM pg_catalog.set_config('aigw.not_sent_proof', '', true);
     PERFORM public.aigw_event(p_id, r.phase, v_to, 'outcome', p->>'instance');
     RETURN jsonb_build_object('ok', true);
   END
   $f$`,

  // Cleanup. Age never makes a dispatched request not_sent: a stale
  // dispatching row becomes unknown; only an expired, never-dispatched
  // authorized row becomes not_sent. Rows are taken in id order with SKIP
  // LOCKED, so concurrent sweeps neither deadlock nor block live work.
  `CREATE OR REPLACE FUNCTION public.aigw_sweep(p_submission_timeout interval, p_limit integer) RETURNS jsonb
   LANGUAGE plpgsql ${DEFINER} AS $f$
   DECLARE
     r record;
     n_expired integer := 0;
     n_unknown integer := 0;
   BEGIN
     PERFORM pg_catalog.set_config('lock_timeout', '2s', true);
     FOR r IN SELECT id FROM public.aigw_permits
               WHERE phase = 'authorized' AND expires_at <= clock_timestamp()
               ORDER BY id LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
       UPDATE public.aigw_permits SET phase = 'not_sent', billed = 'no' WHERE id = r.id;
       PERFORM public.aigw_event(r.id, 'authorized', 'not_sent', 'permit_expired_unused', 'sweep');
       n_expired := n_expired + 1;
     END LOOP;
     FOR r IN SELECT id FROM public.aigw_permits
               WHERE phase = 'dispatching' AND dispatched_at <= clock_timestamp() - p_submission_timeout
               ORDER BY id LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
       UPDATE public.aigw_permits SET phase = 'unknown' WHERE id = r.id;
       PERFORM public.aigw_event(r.id, 'dispatching', 'unknown', 'submission_timeout', 'sweep');
       n_unknown := n_unknown + 1;
     END LOOP;
     RETURN jsonb_build_object('ok', true, 'expired_not_sent', n_expired, 'dispatching_unknown', n_unknown);
   END
   $f$`,

  `CREATE OR REPLACE FUNCTION public.aigw_find_by_task(p_provider text, p_task text) RETURNS jsonb
   LANGUAGE sql STABLE ${DEFINER} AS $f$
     SELECT jsonb_build_object('id', id, 'phase', phase, 'task_id', provider_task_id)
       FROM public.aigw_permits WHERE provider = p_provider AND provider_task_id = p_task
   $f$`,

  `CREATE OR REPLACE FUNCTION public.aigw_reconcile(p_id uuid, p jsonb) RETURNS jsonb
   LANGUAGE plpgsql ${DEFINER} AS $f$
   DECLARE
     r public.aigw_permits%ROWTYPE;
     v_day date;
     v_to text := p->>'to';
     v_billed text;
     v_ok boolean;
   BEGIN
     PERFORM pg_catalog.set_config('lock_timeout', '2s', true);
     IF p->'evidence' IS NULL OR jsonb_typeof(p->'evidence') <> 'object' OR p->'evidence' = '{}'::jsonb THEN
       RETURN jsonb_build_object('ok', false, 'code', 'EVIDENCE_REQUIRED');
     END IF;
     IF COALESCE(btrim(p->>'reason'), '') = '' THEN RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED'); END IF;
     SELECT reservation_day INTO v_day FROM public.aigw_permits WHERE id = p_id;
     IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'PERMIT_UNKNOWN'); END IF;
     PERFORM pg_advisory_xact_lock(hashtextextended('aigw:day:' || v_day::text, 0));   -- L3
     SELECT * INTO r FROM public.aigw_permits WHERE id = p_id FOR UPDATE;              -- L4
     v_ok := (r.phase = 'unknown' AND v_to IN ('accepted', 'provider_succeeded', 'succeeded', 'failed_confirmed', 'abandoned'))
          OR (r.phase IN ('accepted', 'provider_succeeded') AND v_to IN ('succeeded', 'failed_confirmed'))
          OR (r.phase IN ('succeeded', 'failed_confirmed', 'abandoned') AND v_to = r.phase);
     IF NOT v_ok THEN RETURN jsonb_build_object('ok', false, 'code', 'ILLEGAL_RECONCILIATION'); END IF;
     v_billed := CASE WHEN p->>'billed' IN ('yes', 'no', 'unknown') THEN p->>'billed' ELSE r.billed END;
     PERFORM pg_catalog.set_config('aigw.reconcile', 'on', true);
     UPDATE public.aigw_permits
        SET phase = v_to, billed = v_billed,
            confirmed_micros = COALESCE((p->>'confirmed_micros')::bigint, confirmed_micros),
            settled_at = CASE WHEN v_to IN ('succeeded', 'failed_confirmed', 'abandoned') THEN clock_timestamp() ELSE settled_at END
      WHERE id = p_id;
     PERFORM pg_catalog.set_config('aigw.reconcile', '', true);
     INSERT INTO public.aigw_reconciliations (permit_id, decided_by, method, evidence, from_phase, to_phase,
                                              billed_before, billed_after, confirmed_micros, reason)
     VALUES (p_id, public.aigw_actor(p->>'actor'), p->>'method', p->'evidence', r.phase, v_to, r.billed, v_billed,
             (p->>'confirmed_micros')::bigint, p->>'reason');
     PERFORM public.aigw_event(p_id, r.phase, v_to, 'reconcile', p->>'actor');
     RETURN jsonb_build_object('ok', true);
   END
   $f$`,

  `CREATE OR REPLACE FUNCTION public.aigw_exposure(p_day date, p_service text) RETURNS jsonb
   LANGUAGE sql STABLE ${DEFINER} AS $f$
     SELECT jsonb_build_object('reserved', reserved, 'confirmed', confirmed, 'uncertain', uncertain,
                               'exposure', reserved + confirmed + uncertain)
       FROM public.aigw_exposure_internal(p_day, p_service)
   $f$`,

  `CREATE OR REPLACE FUNCTION public.aigw_read_control() RETURNS jsonb
   LANGUAGE sql STABLE ${DEFINER} AS $f$
     SELECT jsonb_build_object(
       'global_state', global_state, 'version', version,
       'paused', jsonb_build_object('images', paused_images, 'video', paused_video, 'voice', paused_voice, 'writing', paused_writing),
       'daily_cap_micros', daily_cap_micros, 'image_daily_cap_micros', image_daily_cap_micros,
       'resume_pending', global_state = 'RESUME_PENDING', 'resume_target_version', resume_target_version,
       'resume_expires_at', resume_expires_at,
       'gateway_ack_version', gateway_ack_version, 'gateway_ack_at', gateway_ack_at,
       'gateway_ack_effective', gateway_ack_effective, 'gateway_ack_instance', gateway_ack_instance,
       'gateway_inflight_at_ack', gateway_inflight_at_ack,
       'changed_by', changed_by, 'changed_at', changed_at, 'reason', reason,
       'read_at_ms', floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint)
     FROM public.aigw_control WHERE id = 1
   $f$`,

  // ---------------------------------------------------------- admin (L1)
  `CREATE OR REPLACE FUNCTION public.aigw_stop(p_actor text, p_reason text) RETURNS jsonb
   LANGUAGE plpgsql ${DEFINER} AS $f$
   DECLARE b public.aigw_control%ROWTYPE; v bigint;
   BEGIN
     IF COALESCE(btrim(p_reason), '') = '' THEN RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED'); END IF;
     PERFORM pg_catalog.set_config('lock_timeout', '10s', true);
     SELECT * INTO b FROM public.aigw_control WHERE id = 1 FOR UPDATE;
     UPDATE public.aigw_control
        SET global_state = 'STOPPED', version = version + 1, changed_by = public.aigw_actor(p_actor),
            changed_at = clock_timestamp(), reason = p_reason
      WHERE id = 1 RETURNING version INTO v;
     INSERT INTO public.aigw_audit (actor, action, target_type, target_id, before, after, reason)
     VALUES (public.aigw_actor(p_actor), 'stop', 'aigw_control', '1',
             jsonb_build_object('global_state', b.global_state, 'version', b.version),
             jsonb_build_object('global_state', 'STOPPED', 'version', v), p_reason);
     RETURN jsonb_build_object('ok', true, 'version', v);
   END
   $f$`,

  `CREATE OR REPLACE FUNCTION public.aigw_request_resume(p jsonb) RETURNS jsonb
   LANGUAGE plpgsql ${DEFINER} AS $f$
   DECLARE b public.aigw_control%ROWTYPE; v bigint; v_ttl integer := (p->>'ttl_seconds')::integer;
   BEGIN
     IF COALESCE(btrim(p->>'reason'), '') = '' THEN RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED'); END IF;
     IF COALESCE(btrim(p->>'actor'), '') = '' THEN RETURN jsonb_build_object('ok', false, 'code', 'ACTOR_REQUIRED'); END IF;
     IF v_ttl IS NULL OR v_ttl < 30 OR v_ttl > 300 THEN RETURN jsonb_build_object('ok', false, 'code', 'TTL_INVALID'); END IF;
     IF COALESCE(p->>'nonce_hash', '') !~ '^[0-9a-f]{64}$' OR (p->>'challenge_id') IS NULL THEN
       RETURN jsonb_build_object('ok', false, 'code', 'CHALLENGE_INVALID');
     END IF;
     PERFORM pg_catalog.set_config('lock_timeout', '10s', true);
     SELECT * INTO b FROM public.aigw_control WHERE id = 1 FOR UPDATE;
     IF b.global_state <> 'STOPPED' THEN RETURN jsonb_build_object('ok', false, 'code', 'NOT_STOPPED'); END IF;
     UPDATE public.aigw_control
        SET global_state = 'RESUME_PENDING', version = version + 1,
            resume_challenge_id = (p->>'challenge_id')::uuid, resume_nonce_hash = p->>'nonce_hash',
            resume_requested_by = btrim(p->>'actor'), resume_target_version = version + 1,
            resume_expires_at = clock_timestamp() + make_interval(secs => v_ttl), resume_consumed_at = NULL,
            changed_by = public.aigw_actor(p->>'actor'), changed_at = clock_timestamp(), reason = p->>'reason'
      WHERE id = 1 RETURNING version INTO v;
     INSERT INTO public.aigw_audit (actor, action, target_type, target_id, before, after, reason)
     VALUES (public.aigw_actor(p->>'actor'), 'resume_requested', 'aigw_control', '1',
             jsonb_build_object('global_state', b.global_state, 'version', b.version),
             jsonb_build_object('global_state', 'RESUME_PENDING', 'version', v, 'challenge_id', p->>'challenge_id'), p->>'reason');
     RETURN jsonb_build_object('ok', true, 'version', v, 'target_version', v);
   END
   $f$`,

  // Consumes the challenge exactly once: same administrator, same version,
  // unexpired, unconsumed, matching nonce. Fresh sign-in proof (Cognito) is
  // checked by the caller before this is called.
  `CREATE OR REPLACE FUNCTION public.aigw_confirm_resume(p jsonb) RETURNS jsonb
   LANGUAGE plpgsql ${DEFINER} AS $f$
   DECLARE v bigint;
   BEGIN
     PERFORM pg_catalog.set_config('lock_timeout', '10s', true);
     UPDATE public.aigw_control
        SET global_state = 'RELEASED', version = version + 1, resume_consumed_at = clock_timestamp(),
            changed_by = public.aigw_actor(p->>'actor'), changed_at = clock_timestamp(), reason = COALESCE(p->>'reason', 'resume confirmed')
      WHERE id = 1
        AND global_state = 'RESUME_PENDING'
        AND resume_consumed_at IS NULL
        AND resume_expires_at > clock_timestamp()
        AND resume_challenge_id = (p->>'challenge_id')::uuid
        AND resume_requested_by = btrim(p->>'actor')
        AND resume_target_version = (p->>'target_version')::bigint
        AND version = resume_target_version
        AND resume_nonce_hash = p->>'nonce_hash'
      RETURNING version INTO v;
     IF v IS NULL THEN
       INSERT INTO public.aigw_audit (actor, action, target_type, target_id, reason)
       VALUES (public.aigw_actor(p->>'actor'), 'resume_confirm_refused', 'aigw_control', '1', 'confirmation did not match the pending challenge');
       RETURN jsonb_build_object('ok', false, 'code', 'RESUME_REFUSED');
     END IF;
     INSERT INTO public.aigw_audit (actor, action, target_type, target_id, after, reason)
     VALUES (public.aigw_actor(p->>'actor'), 'resume_confirmed', 'aigw_control', '1',
             jsonb_build_object('global_state', 'RELEASED', 'version', v), COALESCE(p->>'reason', 'resume confirmed'));
     RETURN jsonb_build_object('ok', true, 'version', v);
   END
   $f$`,

  `CREATE OR REPLACE FUNCTION public.aigw_cancel_resume(p_actor text, p_reason text) RETURNS jsonb
   LANGUAGE plpgsql ${DEFINER} AS $f$
   DECLARE v bigint;
   BEGIN
     IF COALESCE(btrim(p_reason), '') = '' THEN RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED'); END IF;
     PERFORM pg_catalog.set_config('lock_timeout', '10s', true);
     UPDATE public.aigw_control
        SET global_state = 'STOPPED', version = version + 1, changed_by = public.aigw_actor(p_actor),
            changed_at = clock_timestamp(), reason = p_reason
      WHERE id = 1 AND global_state = 'RESUME_PENDING' RETURNING version INTO v;
     IF v IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'NOT_PENDING'); END IF;
     INSERT INTO public.aigw_audit (actor, action, target_type, target_id, after, reason)
     VALUES (public.aigw_actor(p_actor), 'resume_cancelled', 'aigw_control', '1', jsonb_build_object('version', v), p_reason);
     RETURN jsonb_build_object('ok', true, 'version', v);
   END
   $f$`,

  `CREATE OR REPLACE FUNCTION public.aigw_set_pause(p_service text, p_paused boolean, p_actor text, p_reason text) RETURNS jsonb
   LANGUAGE plpgsql ${DEFINER} AS $f$
   DECLARE v bigint;
   BEGIN
     IF COALESCE(btrim(p_reason), '') = '' THEN RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED'); END IF;
     IF p_service NOT IN ('images', 'video', 'voice', 'writing') OR p_paused IS NULL THEN
       RETURN jsonb_build_object('ok', false, 'code', 'SERVICE_INVALID');
     END IF;
     PERFORM pg_catalog.set_config('lock_timeout', '10s', true);
     UPDATE public.aigw_control
        SET paused_images = CASE WHEN p_service = 'images' THEN p_paused ELSE paused_images END,
            paused_video = CASE WHEN p_service = 'video' THEN p_paused ELSE paused_video END,
            paused_voice = CASE WHEN p_service = 'voice' THEN p_paused ELSE paused_voice END,
            paused_writing = CASE WHEN p_service = 'writing' THEN p_paused ELSE paused_writing END,
            version = version + 1, changed_by = public.aigw_actor(p_actor), changed_at = clock_timestamp(), reason = p_reason
      WHERE id = 1 RETURNING version INTO v;
     INSERT INTO public.aigw_audit (actor, action, target_type, target_id, after, reason)
     VALUES (public.aigw_actor(p_actor), CASE WHEN p_paused THEN 'pause' ELSE 'unpause' END, 'aigw_service', p_service,
             jsonb_build_object('paused', p_paused, 'version', v), p_reason);
     RETURN jsonb_build_object('ok', true, 'version', v);
   END
   $f$`,

  `CREATE OR REPLACE FUNCTION public.aigw_set_caps(p jsonb) RETURNS jsonb
   LANGUAGE plpgsql ${DEFINER} AS $f$
   DECLARE b public.aigw_control%ROWTYPE; v bigint;
     v_daily bigint := (p->>'daily_cap_micros')::bigint;
     v_image bigint := (p->>'image_daily_cap_micros')::bigint;
   BEGIN
     IF COALESCE(btrim(p->>'reason'), '') = '' THEN RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED'); END IF;
     IF (v_daily IS NOT NULL AND v_daily < 0) OR (v_image IS NOT NULL AND v_image < 0) THEN
       RETURN jsonb_build_object('ok', false, 'code', 'CAP_INVALID');
     END IF;
     PERFORM pg_catalog.set_config('lock_timeout', '10s', true);
     SELECT * INTO b FROM public.aigw_control WHERE id = 1 FOR UPDATE;
     UPDATE public.aigw_control
        SET daily_cap_micros = v_daily, image_daily_cap_micros = v_image, version = version + 1,
            changed_by = public.aigw_actor(p->>'actor'), changed_at = clock_timestamp(), reason = p->>'reason'
      WHERE id = 1 RETURNING version INTO v;
     INSERT INTO public.aigw_audit (actor, action, target_type, target_id, before, after, reason)
     VALUES (public.aigw_actor(p->>'actor'), 'set_caps', 'aigw_control', '1',
             jsonb_build_object('daily_cap_micros', b.daily_cap_micros, 'image_daily_cap_micros', b.image_daily_cap_micros),
             jsonb_build_object('daily_cap_micros', v_daily, 'image_daily_cap_micros', v_image, 'version', v), p->>'reason');
     RETURN jsonb_build_object('ok', true, 'version', v);
   END
   $f$`,

  `CREATE OR REPLACE FUNCTION public.aigw_gateway_ack(p jsonb) RETURNS jsonb
   LANGUAGE plpgsql ${DEFINER} AS $f$
   DECLARE c public.aigw_control%ROWTYPE; v_ack bigint := (p->>'version')::bigint;
   BEGIN
     PERFORM pg_catalog.set_config('lock_timeout', '2s', true);
     SELECT * INTO c FROM public.aigw_control WHERE id = 1 FOR UPDATE;
     IF v_ack IS NULL OR v_ack > c.version THEN RETURN jsonb_build_object('ok', false, 'code', 'ACK_VERSION_INVALID'); END IF;
     IF c.gateway_ack_version IS NOT NULL AND v_ack < c.gateway_ack_version THEN
       RETURN jsonb_build_object('ok', false, 'code', 'ACK_VERSION_STALE');
     END IF;
     UPDATE public.aigw_control
        SET gateway_ack_version = v_ack, gateway_ack_at = clock_timestamp(), gateway_ack_effective = p->>'effective',
            gateway_ack_instance = p->>'instance', gateway_inflight_at_ack = COALESCE(p->'inflight', '[]'::jsonb)
      WHERE id = 1;
     RETURN jsonb_build_object('ok', true);
   END
   $f$`,
];

const GUARD_SQL = [
  'DROP TRIGGER IF EXISTS aigw_permits_row_guard ON public.aigw_permits',
  `CREATE TRIGGER aigw_permits_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.aigw_permits
     FOR EACH ROW EXECUTE FUNCTION public.aigw_permits_guard()`,
  'DROP TRIGGER IF EXISTS aigw_permits_truncate_guard ON public.aigw_permits',
  `CREATE TRIGGER aigw_permits_truncate_guard BEFORE TRUNCATE ON public.aigw_permits
     FOR EACH STATEMENT EXECUTE FUNCTION public.aigw_permits_guard()`,
  ...['aigw_permit_events', 'aigw_reconciliations', 'aigw_audit'].flatMap((t) => [
    `DROP TRIGGER IF EXISTS ${t}_row_guard ON public.${t}`,
    `CREATE TRIGGER ${t}_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.${t}
       FOR EACH ROW EXECUTE FUNCTION public.aigw_append_only_guard()`,
    `DROP TRIGGER IF EXISTS ${t}_truncate_guard ON public.${t}`,
    `CREATE TRIGGER ${t}_truncate_guard BEFORE TRUNCATE ON public.${t}
       FOR EACH STATEMENT EXECUTE FUNCTION public.aigw_append_only_guard()`,
  ]),
  'DROP TRIGGER IF EXISTS aigw_control_row_guard ON public.aigw_control',
  `CREATE TRIGGER aigw_control_row_guard BEFORE UPDATE OR DELETE ON public.aigw_control
     FOR EACH ROW EXECUTE FUNCTION public.aigw_control_guard()`,
  'DROP TRIGGER IF EXISTS aigw_control_truncate_guard ON public.aigw_control',
  `CREATE TRIGGER aigw_control_truncate_guard BEFORE TRUNCATE ON public.aigw_control
     FOR EACH STATEMENT EXECUTE FUNCTION public.aigw_control_guard()`,
];

function privilegeSql() {
  const out = [];
  for (const t of TABLES) {
    out.push(`REVOKE ALL ON public.${t} FROM PUBLIC`);
    // Take back default-privilege grants from every role but the owner
    // (the data_correction_log pattern): no application role can touch them.
    out.push(`DO $acl$
      DECLARE g text;
      BEGIN
        FOR g IN SELECT DISTINCT a.grantee::regrole::text
                   FROM pg_catalog.pg_class c, pg_catalog.aclexplode(c.relacl) a
                  WHERE c.oid = 'public.${t}'::regclass AND a.grantee <> 0 AND a.grantee <> c.relowner
        LOOP
          EXECUTE format('REVOKE ALL ON public.${t} FROM %s', g);
        END LOOP;
      END
    $acl$`);
    out.push(`DO $ro$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'prime_readonly') THEN
          EXECUTE 'GRANT SELECT ON public.${t} TO prime_readonly';
        END IF;
      END
    $ro$`);
  }
  for (const seq of ['aigw_permit_events_id_seq', 'aigw_reconciliations_id_seq', 'aigw_audit_id_seq']) {
    out.push(`REVOKE ALL ON SEQUENCE public.${seq} FROM PUBLIC`);
  }
  for (const f of FUNCTIONS) {
    out.push(`REVOKE ALL ON FUNCTION public.${f} FROM PUBLIC`);
    // Default privileges can grant EXECUTE on new functions; take those back
    // too. EXECUTE is granted only by the hand-run role script.
    out.push(`DO $acl$
      DECLARE g text;
      BEGIN
        FOR g IN SELECT DISTINCT a.grantee::regrole::text
                   FROM pg_catalog.pg_proc p, pg_catalog.aclexplode(p.proacl) a
                  WHERE p.oid = 'public.${f}'::regprocedure AND a.grantee <> 0 AND a.grantee <> p.proowner
        LOOP
          EXECUTE format('REVOKE ALL ON FUNCTION public.${f} FROM %s', g);
        END LOOP;
      END
    $acl$`);
  }
  return out;
}

module.exports = {
  SUBMISSION_OPERATIONS,
  TABLES,
  FUNCTIONS,
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      // All or nothing, in one transaction. If the ledger already exists, a
      // second run changes nothing: it must not replace functions owned by
      // the aigw owner role, nor sweep away the grants the role script made.
      const [[existing]] = await sequelize.query("SELECT to_regclass('public.aigw_control') IS NOT NULL AS present", { transaction });
      if (existing.present) {
        console.log('[aigw migration] the AI gateway ledger already exists; nothing changed');
        return;
      }
      for (const sql of [...SCHEMA_SQL, ...FUNCTION_SQL, ...GUARD_SQL, ...privilegeSql()]) {
        await sequelize.query(sql, { transaction });
      }
    });
  },
  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const [[row]] = await sequelize.query(
        `SELECT (SELECT count(*) FROM public.aigw_permits) + (SELECT count(*) FROM public.aigw_permit_events)
              + (SELECT count(*) FROM public.aigw_reconciliations) + (SELECT count(*) FROM public.aigw_audit) AS n`,
        { transaction });
      if (Number(row.n) > 0) {
        throw new Error(`Refusing to drop the AI gateway ledger: it holds ${row.n} permit, event, reconciliation or audit row(s). Export them first.`);
      }
      // Functions first (aigw_permit_json takes the permits row type), then
      // the tables with their triggers, then the trigger functions.
      const isGuard = (f) => /_guard\(\)$/.test(f);
      for (const f of [...FUNCTIONS].reverse().filter((x) => !isGuard(x))) {
        await sequelize.query(`DROP FUNCTION IF EXISTS public.${f}`, { transaction });
      }
      for (const t of [...TABLES].reverse()) {
        await sequelize.query(`DROP TABLE IF EXISTS public.${t}`, { transaction });
      }
      for (const f of FUNCTIONS.filter(isGuard)) {
        await sequelize.query(`DROP FUNCTION IF EXISTS public.${f}`, { transaction });
      }
    });
  },
};
