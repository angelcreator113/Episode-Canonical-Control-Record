--
-- PostgreSQL database dump
--

\restrict TNfn2zWH0rkzpH23rqtnVj7YFBUK4nu0E9qPXHfZkI0IVEQOUK8bX4B4uwIZmbE

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: asset_scope_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.asset_scope_enum AS ENUM (
    'GLOBAL',
    'SHOW',
    'EPISODE'
);


ALTER TYPE public.asset_scope_enum OWNER TO postgres;

--
-- Name: attachment_point_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.attachment_point_enum AS ENUM (
    'scene-start',
    'scene-end',
    'scene-middle',
    'custom'
);


ALTER TYPE public.attachment_point_enum OWNER TO postgres;

--
-- Name: enum_episode_scenes_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_episode_scenes_type AS ENUM (
    'clip',
    'note'
);


ALTER TYPE public.enum_episode_scenes_type OWNER TO postgres;

--
-- Name: enum_episodes_processingStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_episodes_processingStatus" AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed'
);


ALTER TYPE public."enum_episodes_processingStatus" OWNER TO postgres;

--
-- Name: placement_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.placement_type_enum AS ENUM (
    'asset',
    'wardrobe',
    'audio'
);


ALTER TYPE public.placement_type_enum OWNER TO postgres;

--
-- Name: create_default_roles_for_show(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_default_roles_for_show() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO asset_roles (show_id, role_key, role_label, category, icon, color, is_required, sort_order, description)
  VALUES
    (NEW.id, 'HOST', 'Host (Lala)', 'Characters', '👩', '#ec4899', true, 1, 'Primary show host'),
    (NEW.id, 'CO_HOST', 'Co-Host', 'Characters', '👤', '#f472b6', false, 2, 'Secondary host or regular guest'),
    (NEW.id, 'GUEST_1', 'Guest 1', 'Characters', '🎤', '#a855f7', false, 3, 'Featured guest slot 1'),
    (NEW.id, 'GUEST_2', 'Guest 2', 'Characters', '🎤', '#a855f7', false, 4, 'Featured guest slot 2'),
    (NEW.id, 'GUEST_3', 'Guest 3', 'Characters', '🎤', '#a855f7', false, 5, 'Featured guest slot 3'),
    (NEW.id, 'ICON_CLOSET', 'Closet Icon', 'UI Icons', '👗', '#3b82f6', false, 10, 'Wardrobe/closet UI element'),
    (NEW.id, 'ICON_JEWELRY', 'Jewelry Box Icon', 'UI Icons', '💎', '#3b82f6', false, 11, 'Jewelry/accessories UI element'),
    (NEW.id, 'ICON_SHOES', 'Shoes Icon', 'UI Icons', '👠', '#3b82f6', false, 12, 'Footwear UI element'),
    (NEW.id, 'ICON_MAKEUP', 'Makeup Icon', 'UI Icons', '💄', '#3b82f6', false, 13, 'Beauty/makeup UI element'),
    (NEW.id, 'CHROME_CURSOR', 'Cursor/Pointer', 'UI Chrome', '👆', '#6b7280', false, 20, 'Custom cursor design'),
    (NEW.id, 'CHROME_EXIT', 'Exit Button', 'UI Chrome', '❌', '#6b7280', false, 21, 'Exit/close button'),
    (NEW.id, 'CHROME_MINIMIZE', 'Minimize Button', 'UI Chrome', '➖', '#6b7280', false, 22, 'Minimize button'),
    (NEW.id, 'BRAND_SHOW_TITLE', 'Show Title Logo', 'Branding', '✨', '#8b5cf6', true, 30, 'Main show title/logo'),
    (NEW.id, 'BRAND_SUBTITLE', 'Episode Subtitle', 'Branding', '📝', '#8b5cf6', false, 31, 'Episode-specific subtitle'),
    (NEW.id, 'BRAND_WATERMARK', 'Watermark', 'Branding', '🔖', '#8b5cf6', false, 32, 'Brand watermark overlay'),
    (NEW.id, 'BACKGROUND_MAIN', 'Background', 'Background', '🌄', '#10b981', true, 40, 'Primary background image'),
    (NEW.id, 'BACKGROUND_OVERLAY', 'Background Overlay', 'Background', '🎨', '#10b981', false, 41, 'Background texture/overlay')
  ON CONFLICT (show_id, role_key) DO NOTHING;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.create_default_roles_for_show() OWNER TO postgres;

--
-- Name: update_episode_scripts_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_episode_scripts_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$;


ALTER FUNCTION public.update_episode_scripts_timestamp() OWNER TO postgres;

--
-- Name: update_episode_wardrobe_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_episode_wardrobe_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_episode_wardrobe_updated_at() OWNER TO postgres;

--
-- Name: update_template_studio_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_template_studio_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$;


ALTER FUNCTION public.update_template_studio_updated_at() OWNER TO postgres;

--
-- Name: update_wardrobe_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_wardrobe_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_wardrobe_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: SequelizeMeta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SequelizeMeta" (
    name character varying(255) NOT NULL
);


ALTER TABLE public."SequelizeMeta" OWNER TO postgres;

--
-- Name: asset_label_map; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_label_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    label_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.asset_label_map OWNER TO postgres;

--
-- Name: asset_labels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_labels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    color character varying(7) DEFAULT '#6366f1'::character varying NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.asset_labels OWNER TO postgres;

--
-- Name: asset_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    show_id uuid,
    role_key character varying(100) NOT NULL,
    role_label character varying(255) NOT NULL,
    category character varying(100),
    icon character varying(50),
    color character varying(20),
    is_required boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.asset_roles OWNER TO postgres;

--
-- Name: TABLE asset_roles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.asset_roles IS 'Show-level asset role registry defining semantic slots for assets';


--
-- Name: assets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    asset_type character varying(100),
    approval_status character varying(50) DEFAULT 'APPROVED'::character varying,
    s3_key_raw character varying(500),
    s3_url_raw character varying(500),
    file_size_bytes integer,
    s3_key_processed character varying(500),
    s3_url_processed character varying(500),
    processed_file_size_bytes integer,
    width integer,
    height integer,
    media_type character varying(20) DEFAULT 'image'::character varying,
    duration_seconds integer,
    video_codec character varying(50),
    audio_codec character varying(50),
    bitrate integer,
    description text,
    processing_job_id character varying(255),
    processing_error text,
    processed_at timestamp with time zone,
    s3_key character varying(500),
    url character varying(500),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    asset_group character varying(50),
    purpose character varying(50),
    allowed_uses text[],
    is_global boolean DEFAULT false,
    file_name character varying(500),
    content_type character varying(100),
    asset_role character varying(100),
    show_id uuid,
    episode_id uuid,
    asset_scope public.asset_scope_enum DEFAULT 'GLOBAL'::public.asset_scope_enum NOT NULL,
    s3_url_no_bg text,
    s3_url_enhanced text,
    processing_status character varying(50) DEFAULT 'none'::character varying,
    processing_metadata jsonb DEFAULT '{}'::jsonb,
    role_key character varying(100),
    file_hash character varying(64)
);


ALTER TABLE public.assets OWNER TO postgres;

--
-- Name: COLUMN assets.asset_role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.assets.asset_role IS 'Role-based identifier (e.g., CHAR.HOST.PRIMARY, BG.MAIN)';


--
-- Name: COLUMN assets.s3_url_no_bg; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.assets.s3_url_no_bg IS 'S3 URL for version with background removed';


--
-- Name: COLUMN assets.s3_url_enhanced; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.assets.s3_url_enhanced IS 'S3 URL for enhanced version (skin smoothing, etc)';


--
-- Name: COLUMN assets.processing_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.assets.processing_status IS 'Status: none, processing_bg_removal, bg_removed, processing_enhancement, enhanced, failed';


--
-- Name: COLUMN assets.processing_metadata; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.assets.processing_metadata IS 'Processing parameters and results (JSON)';


--
-- Name: COLUMN assets.role_key; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.assets.role_key IS 'Semantic role assignment (references asset_roles.role_key)';


--
-- Name: composition_assets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.composition_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    composition_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    asset_role character varying(100) NOT NULL,
    role_category character varying(50),
    role_name character varying(50),
    role_variant character varying(50),
    layer_order integer DEFAULT 0,
    transform jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now(),
    deleted_at timestamp without time zone
);


ALTER TABLE public.composition_assets OWNER TO postgres;

--
-- Name: COLUMN composition_assets.asset_role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.composition_assets.asset_role IS 'Role in this composition (e.g., CHAR.HOST.PRIMARY)';


--
-- Name: COLUMN composition_assets.role_category; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.composition_assets.role_category IS 'Parsed from role (e.g., CHAR)';


--
-- Name: COLUMN composition_assets.role_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.composition_assets.role_name IS 'Parsed from role (e.g., HOST)';


--
-- Name: COLUMN composition_assets.role_variant; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.composition_assets.role_variant IS 'Parsed from role (e.g., PRIMARY)';


--
-- Name: COLUMN composition_assets.deleted_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.composition_assets.deleted_at IS 'Soft delete timestamp - null means record is active';


--
-- Name: composition_outputs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.composition_outputs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    composition_id uuid NOT NULL,
    format character varying(100) NOT NULL,
    status character varying(50) DEFAULT 'PROCESSING'::character varying,
    image_url text,
    width integer,
    height integer,
    file_size integer,
    error_message text,
    generated_at timestamp without time zone DEFAULT now(),
    generated_by character varying(255),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    deleted_at timestamp without time zone,
    CONSTRAINT composition_outputs_status_check CHECK (((status)::text = ANY ((ARRAY['PROCESSING'::character varying, 'READY'::character varying, 'FAILED'::character varying])::text[])))
);


ALTER TABLE public.composition_outputs OWNER TO postgres;

--
-- Name: COLUMN composition_outputs.deleted_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.composition_outputs.deleted_at IS 'Soft delete timestamp - null means record is active';


--
-- Name: episode_assets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.episode_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    episode_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    usage_type character varying(50) DEFAULT 'general'::character varying NOT NULL,
    scene_number integer,
    display_order integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    folder character varying(100),
    sort_order integer DEFAULT 0,
    tags text[],
    added_at timestamp with time zone DEFAULT now(),
    added_by character varying(100)
);


ALTER TABLE public.episode_assets OWNER TO postgres;

--
-- Name: episode_outfit_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.episode_outfit_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    episode_outfit_id uuid NOT NULL,
    wardrobe_item_id uuid NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    required boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.episode_outfit_items OWNER TO postgres;

--
-- Name: TABLE episode_outfit_items; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.episode_outfit_items IS 'Items that make up episode outfit instances';


--
-- Name: COLUMN episode_outfit_items.required; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.episode_outfit_items.required IS 'Whether this item is required for the outfit';


--
-- Name: episode_outfits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.episode_outfits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    episode_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    source_outfit_set_id integer,
    "character" character varying(255) NOT NULL,
    scene_ids jsonb DEFAULT '[]'::jsonb,
    occasion character varying(255),
    notes text,
    is_favorite boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.episode_outfits OWNER TO postgres;

--
-- Name: TABLE episode_outfits; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.episode_outfits IS 'Episode-specific outfit instances - copied from defaults or custom';


--
-- Name: COLUMN episode_outfits.source_outfit_set_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.episode_outfits.source_outfit_set_id IS 'Default set this was copied from (null if custom)';


--
-- Name: episode_scenes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.episode_scenes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    episode_id uuid NOT NULL,
    scene_library_id uuid,
    scene_order integer DEFAULT 0 NOT NULL,
    trim_start numeric(10,3) DEFAULT 0,
    trim_end numeric(10,3),
    scene_type character varying(50) DEFAULT 'main'::character varying,
    episode_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp without time zone,
    type public.enum_episode_scenes_type DEFAULT 'clip'::public.enum_episode_scenes_type NOT NULL,
    manual_duration_seconds numeric(10,3),
    title_override character varying(500),
    note_text text,
    added_by character varying(255),
    last_edited_at timestamp with time zone,
    start_time_seconds numeric(10,3) DEFAULT 0
);


ALTER TABLE public.episode_scenes OWNER TO postgres;

--
-- Name: COLUMN episode_scenes.scene_library_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.episode_scenes.scene_library_id IS 'Reference to the scene in the library (nullable for notes)';


--
-- Name: COLUMN episode_scenes.type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.episode_scenes.type IS 'Type of sequence item: clip from library or manual note';


--
-- Name: COLUMN episode_scenes.manual_duration_seconds; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.episode_scenes.manual_duration_seconds IS 'Manual duration for notes or missing clips';


--
-- Name: COLUMN episode_scenes.title_override; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.episode_scenes.title_override IS 'Override title for this sequence item';


--
-- Name: COLUMN episode_scenes.note_text; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.episode_scenes.note_text IS 'Text content for note-type items';


--
-- Name: COLUMN episode_scenes.added_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.episode_scenes.added_by IS 'User who added this item to the sequence';


--
-- Name: COLUMN episode_scenes.last_edited_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.episode_scenes.last_edited_at IS 'Last time this item was edited';


--
-- Name: episode_scripts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.episode_scripts (
    id integer NOT NULL,
    episode_id uuid NOT NULL,
    script_type character varying(50) NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    version_label character varying(255),
    author character varying(255),
    status character varying(50) DEFAULT 'draft'::character varying,
    duration integer,
    scene_count integer DEFAULT 0,
    content text,
    file_format character varying(20),
    file_url character varying(1024),
    file_size bigint,
    is_primary boolean DEFAULT false,
    is_latest boolean DEFAULT true,
    scene_markers jsonb DEFAULT '[]'::jsonb,
    created_by character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone,
    CONSTRAINT episode_scripts_file_format_check CHECK (((file_format)::text = ANY ((ARRAY['txt'::character varying, 'pdf'::character varying, 'docx'::character varying, 'fountain'::character varying])::text[]))),
    CONSTRAINT episode_scripts_script_type_check CHECK (((script_type)::text = ANY ((ARRAY['trailer'::character varying, 'main'::character varying, 'shorts'::character varying, 'teaser'::character varying, 'behind-the-scenes'::character varying, 'bonus-content'::character varying])::text[]))),
    CONSTRAINT episode_scripts_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'final'::character varying, 'approved'::character varying])::text[])))
);


ALTER TABLE public.episode_scripts OWNER TO postgres;

--
-- Name: episode_scripts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.episode_scripts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.episode_scripts_id_seq OWNER TO postgres;

--
-- Name: episode_scripts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.episode_scripts_id_seq OWNED BY public.episode_scripts.id;


--
-- Name: episode_wardrobe; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.episode_wardrobe (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    episode_id uuid NOT NULL,
    wardrobe_id uuid NOT NULL,
    scene character varying(255),
    worn_at timestamp with time zone DEFAULT now(),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    approval_status character varying(50) DEFAULT 'pending'::character varying,
    approved_by character varying(255),
    approved_at timestamp without time zone,
    rejection_reason text,
    scene_id uuid,
    is_episode_favorite boolean DEFAULT false NOT NULL,
    times_worn integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.episode_wardrobe OWNER TO postgres;

--
-- Name: TABLE episode_wardrobe; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.episode_wardrobe IS 'Tracks which wardrobe items are used in which episodes (usage tracking)';


--
-- Name: COLUMN episode_wardrobe.scene; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.episode_wardrobe.scene IS 'Scene where this wardrobe item was worn';


--
-- Name: COLUMN episode_wardrobe.worn_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.episode_wardrobe.worn_at IS 'Date when this item was worn/linked to the episode';


--
-- Name: COLUMN episode_wardrobe.is_episode_favorite; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.episode_wardrobe.is_episode_favorite IS 'Favorite look from this episode';


--
-- Name: COLUMN episode_wardrobe.times_worn; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.episode_wardrobe.times_worn IS 'Times worn in this episode';


--
-- Name: episodes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.episodes (
    id uuid NOT NULL,
    episode_number integer,
    title character varying(255) NOT NULL,
    description text,
    air_date timestamp with time zone,
    status character varying(50) DEFAULT 'draft'::character varying,
    categories json DEFAULT '[]'::json,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    show_id uuid,
    thumbnail_url character varying(1024)
);


ALTER TABLE public.episodes OWNER TO postgres;

--
-- Name: COLUMN episodes.categories; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.episodes.categories IS 'Array of category/tag strings for the episode';


--
-- Name: COLUMN episodes.thumbnail_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.episodes.thumbnail_url IS 'URL to episode cover image, typically from primary composition';


--
-- Name: metadata_storage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.metadata_storage (
    id integer NOT NULL,
    episode_id uuid,
    extracted_text text,
    scenes_detected json,
    sentiment_analysis json,
    visual_objects json,
    transcription text,
    tags json,
    categories json,
    extraction_timestamp timestamp with time zone,
    processing_duration_seconds integer
);


ALTER TABLE public.metadata_storage OWNER TO postgres;

--
-- Name: COLUMN metadata_storage.extracted_text; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.metadata_storage.extracted_text IS 'Text extracted via OCR from episode';


--
-- Name: COLUMN metadata_storage.scenes_detected; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.metadata_storage.scenes_detected IS 'Array of detected scenes with timestamps and descriptions';


--
-- Name: COLUMN metadata_storage.sentiment_analysis; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.metadata_storage.sentiment_analysis IS 'Sentiment analysis results by scene';


--
-- Name: COLUMN metadata_storage.visual_objects; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.metadata_storage.visual_objects IS 'Detected objects, people, and visual elements';


--
-- Name: COLUMN metadata_storage.transcription; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.metadata_storage.transcription IS 'Speech-to-text transcription';


--
-- Name: COLUMN metadata_storage.tags; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.metadata_storage.tags IS 'User-defined tags as JSON array';


--
-- Name: COLUMN metadata_storage.categories; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.metadata_storage.categories IS 'Categories, warnings, and classifications';


--
-- Name: COLUMN metadata_storage.extraction_timestamp; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.metadata_storage.extraction_timestamp IS 'When metadata was extracted';


--
-- Name: COLUMN metadata_storage.processing_duration_seconds; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.metadata_storage.processing_duration_seconds IS 'How long extraction took in seconds';


--
-- Name: metadata_storage_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.metadata_storage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.metadata_storage_id_seq OWNER TO postgres;

--
-- Name: metadata_storage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.metadata_storage_id_seq OWNED BY public.metadata_storage.id;


--
-- Name: outfit_set_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.outfit_set_items (
    id integer NOT NULL,
    outfit_set_id integer NOT NULL,
    wardrobe_item_id integer NOT NULL,
    "position" integer DEFAULT 0,
    layer character varying(50),
    is_optional boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    required_flag boolean DEFAULT true NOT NULL
);


ALTER TABLE public.outfit_set_items OWNER TO postgres;

--
-- Name: TABLE outfit_set_items; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.outfit_set_items IS 'Items that make up default outfit sets';


--
-- Name: COLUMN outfit_set_items.required_flag; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.outfit_set_items.required_flag IS 'Whether this item is required in the outfit';


--
-- Name: outfit_set_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.outfit_set_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.outfit_set_items_id_seq OWNER TO postgres;

--
-- Name: outfit_set_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.outfit_set_items_id_seq OWNED BY public.outfit_set_items.id;


--
-- Name: outfit_sets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.outfit_sets (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    "character" character varying(255),
    occasion character varying(100),
    season character varying(50),
    items json DEFAULT '[]'::json,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone,
    show_id uuid,
    created_by character varying(255)
);


ALTER TABLE public.outfit_sets OWNER TO postgres;

--
-- Name: TABLE outfit_sets; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.outfit_sets IS 'Default outfit sets at Show level - templates for complete looks';


--
-- Name: COLUMN outfit_sets.show_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.outfit_sets.show_id IS 'Show that owns this default outfit set';


--
-- Name: COLUMN outfit_sets.created_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.outfit_sets.created_by IS 'User who created this set';


--
-- Name: outfit_sets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.outfit_sets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.outfit_sets_id_seq OWNER TO postgres;

--
-- Name: outfit_sets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.outfit_sets_id_seq OWNED BY public.outfit_sets.id;


--
-- Name: pgmigrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pgmigrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


ALTER TABLE public.pgmigrations OWNER TO postgres;

--
-- Name: pgmigrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pgmigrations_id_seq OWNER TO postgres;

--
-- Name: pgmigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pgmigrations_id_seq OWNED BY public.pgmigrations.id;


--
-- Name: scene_assets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scene_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scene_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    usage_type character varying(50) DEFAULT 'overlay'::character varying NOT NULL,
    start_timecode character varying(20),
    end_timecode character varying(20),
    layer_order integer DEFAULT 0,
    opacity numeric(3,2) DEFAULT 1.00,
    "position" jsonb DEFAULT '{"x": 0, "y": 0, "width": "100%", "height": "100%"}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);


ALTER TABLE public.scene_assets OWNER TO postgres;

--
-- Name: TABLE scene_assets; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.scene_assets IS 'Junction table linking scenes to assets with positioning and timing';


--
-- Name: COLUMN scene_assets.usage_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.scene_assets.usage_type IS 'How asset is used: overlay, background, promo, watermark';


--
-- Name: COLUMN scene_assets.start_timecode; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.scene_assets.start_timecode IS 'When asset appears in scene (HH:MM:SS:FF)';


--
-- Name: COLUMN scene_assets.end_timecode; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.scene_assets.end_timecode IS 'When asset disappears from scene (HH:MM:SS:FF)';


--
-- Name: COLUMN scene_assets.layer_order; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.scene_assets.layer_order IS 'Z-index/stacking order (higher = on top)';


--
-- Name: COLUMN scene_assets.opacity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.scene_assets.opacity IS 'Asset opacity 0.00-1.00';


--
-- Name: COLUMN scene_assets."position"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.scene_assets."position" IS 'Asset position/size: {x, y, width, height}';


--
-- Name: scene_library; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scene_library (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    show_id uuid NOT NULL,
    video_asset_url text,
    thumbnail_url text,
    title character varying(255),
    description text,
    characters text[],
    tags text[],
    duration_seconds numeric(10,3),
    resolution character varying(50),
    file_size_bytes bigint,
    processing_status character varying(20) DEFAULT 'uploading'::character varying NOT NULL,
    processing_error text,
    s3_key text,
    created_by character varying(255),
    updated_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp without time zone
);


ALTER TABLE public.scene_library OWNER TO postgres;

--
-- Name: scene_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scene_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    scene_type character varying(50) DEFAULT 'main'::character varying,
    mood character varying(50),
    location character varying(255),
    duration_seconds integer,
    structure jsonb DEFAULT '{}'::jsonb,
    default_settings jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    is_public boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.scene_templates OWNER TO postgres;

--
-- Name: scenes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scenes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    episode_id uuid NOT NULL,
    scene_number integer NOT NULL,
    title character varying(255),
    description text,
    duration_seconds integer,
    location character varying(255),
    scene_type character varying(50),
    production_status character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    mood character varying(100),
    script_notes text,
    start_timecode character varying(20),
    end_timecode character varying(20),
    is_locked boolean DEFAULT false,
    locked_at timestamp with time zone,
    locked_by character varying(255),
    characters jsonb DEFAULT '[]'::jsonb,
    created_by character varying(255),
    updated_by character varying(255),
    thumbnail_id uuid,
    assets jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT scenes_production_status_check CHECK (((production_status)::text = ANY ((ARRAY['draft'::character varying, 'storyboarded'::character varying, 'recorded'::character varying, 'edited'::character varying, 'complete'::character varying])::text[]))),
    CONSTRAINT scenes_scene_number_check CHECK ((scene_number >= 1)),
    CONSTRAINT scenes_scene_type_check CHECK (((scene_type)::text = ANY ((ARRAY['intro'::character varying, 'main'::character varying, 'outro'::character varying, 'transition'::character varying])::text[])))
);


ALTER TABLE public.scenes OWNER TO postgres;

--
-- Name: TABLE scenes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.scenes IS 'Individual scenes within episodes';


--
-- Name: COLUMN scenes.scene_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.scenes.scene_type IS 'Type of scene: intro, main, outro, transition';


--
-- Name: COLUMN scenes.production_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.scenes.production_status IS 'Production status: draft, storyboarded, recorded, edited, complete';


--
-- Name: COLUMN scenes.mood; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.scenes.mood IS 'Scene mood or tone';


--
-- Name: COLUMN scenes.script_notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.scenes.script_notes IS 'Script or direction notes';


--
-- Name: COLUMN scenes.characters; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.scenes.characters IS 'Array of character names appearing in scene';


--
-- Name: COLUMN scenes.assets; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.scenes.assets IS 'DEPRECATED: Use scene_assets table instead';


--
-- Name: script_edits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.script_edits (
    id integer NOT NULL,
    script_id integer NOT NULL,
    user_id character varying(255),
    changes jsonb NOT NULL,
    edit_type character varying(50) NOT NULL,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT script_edits_edit_type_check CHECK (((edit_type)::text = ANY ((ARRAY['create'::character varying, 'update'::character varying, 'delete'::character varying, 'restore'::character varying, 'set_primary'::character varying])::text[])))
);


ALTER TABLE public.script_edits OWNER TO postgres;

--
-- Name: script_edits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.script_edits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.script_edits_id_seq OWNER TO postgres;

--
-- Name: script_edits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.script_edits_id_seq OWNED BY public.script_edits.id;


--
-- Name: search_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.search_history (
    id integer NOT NULL,
    user_id character varying(255) NOT NULL,
    query text NOT NULL,
    search_type character varying(50) NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb,
    result_count integer DEFAULT 0,
    clicked_result_id uuid,
    search_duration_ms integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.search_history OWNER TO postgres;

--
-- Name: TABLE search_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.search_history IS 'Tracks user search queries for analytics and recent searches';


--
-- Name: COLUMN search_history.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.search_history.user_id IS 'User who performed the search';


--
-- Name: COLUMN search_history.query; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.search_history.query IS 'Search query text';


--
-- Name: COLUMN search_history.search_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.search_history.search_type IS 'Type: episodes, scripts, or activities';


--
-- Name: COLUMN search_history.filters; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.search_history.filters IS 'JSON object of applied filters';


--
-- Name: COLUMN search_history.result_count; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.search_history.result_count IS 'Number of results returned';


--
-- Name: COLUMN search_history.clicked_result_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.search_history.clicked_result_id IS 'UUID of result clicked (if any)';


--
-- Name: COLUMN search_history.search_duration_ms; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.search_history.search_duration_ms IS 'Search execution time in milliseconds';


--
-- Name: search_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.search_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.search_history_id_seq OWNER TO postgres;

--
-- Name: search_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.search_history_id_seq OWNED BY public.search_history.id;


--
-- Name: show_assets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.show_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    show_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    usage_context text,
    display_order integer,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


ALTER TABLE public.show_assets OWNER TO postgres;

--
-- Name: shows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    description text,
    genre character varying(255),
    status character varying(50) DEFAULT 'active'::character varying,
    creator_name character varying(255),
    network character varying(255),
    episode_count integer DEFAULT 0,
    season_count integer DEFAULT 1,
    premiere_date timestamp without time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    icon character varying(10) DEFAULT '📺'::character varying,
    color character varying(7) DEFAULT '#667eea'::character varying,
    cover_image_url text,
    cover_s3_key character varying(512)
);


ALTER TABLE public.shows OWNER TO postgres;

--
-- Name: template_studio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.template_studio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    version integer DEFAULT 1 NOT NULL,
    status character varying(50) DEFAULT 'DRAFT'::character varying,
    locked boolean DEFAULT false,
    canvas_config jsonb DEFAULT '{"width": 1280, "height": 720, "background_color": "#000000"}'::jsonb NOT NULL,
    role_slots jsonb DEFAULT '[]'::jsonb NOT NULL,
    safe_zones jsonb DEFAULT '{}'::jsonb,
    required_roles text[] DEFAULT ARRAY[]::text[],
    optional_roles text[] DEFAULT ARRAY[]::text[],
    formats_supported text[] DEFAULT ARRAY['YOUTUBE'::text],
    created_by uuid,
    published_at timestamp without time zone,
    locked_at timestamp without time zone,
    parent_template_id uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT template_studio_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'PUBLISHED'::character varying, 'ARCHIVED'::character varying])::text[])))
);


ALTER TABLE public.template_studio OWNER TO postgres;

--
-- Name: thumbnail_compositions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.thumbnail_compositions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    episode_id uuid,
    template_id uuid,
    name character varying(255),
    description text,
    status character varying(50) DEFAULT 'draft'::character varying,
    created_by character varying(255),
    template_version integer,
    frozen_layout_config jsonb,
    frozen_required_roles jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    selected_formats jsonb DEFAULT '[]'::jsonb,
    current_version integer DEFAULT 1,
    version_history jsonb DEFAULT '{}'::jsonb,
    last_modified_by character varying(100),
    modification_timestamp timestamp without time zone DEFAULT now(),
    background_frame_asset_id uuid,
    lala_asset_id uuid,
    guest_asset_id uuid,
    justawomen_asset_id uuid,
    layout_overrides jsonb DEFAULT '{}'::jsonb,
    draft_overrides jsonb,
    draft_updated_at timestamp without time zone,
    draft_updated_by character varying(255),
    has_unsaved_changes boolean DEFAULT false,
    is_primary boolean DEFAULT false,
    composition_config jsonb DEFAULT '{}'::jsonb,
    template_studio_id uuid,
    deleted_at timestamp without time zone,
    justawomaninherprime_asset_id uuid
);


ALTER TABLE public.thumbnail_compositions OWNER TO postgres;

--
-- Name: COLUMN thumbnail_compositions.template_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.thumbnail_compositions.template_id IS 'UUID referencing either thumbnail_templates (legacy) or template_studio (new system)';


--
-- Name: COLUMN thumbnail_compositions.template_version; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.thumbnail_compositions.template_version IS 'Frozen version of template used';


--
-- Name: COLUMN thumbnail_compositions.frozen_layout_config; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.thumbnail_compositions.frozen_layout_config IS 'Snapshot of layout at creation time';


--
-- Name: COLUMN thumbnail_compositions.frozen_required_roles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.thumbnail_compositions.frozen_required_roles IS 'Snapshot of required roles at creation time';


--
-- Name: COLUMN thumbnail_compositions.is_primary; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.thumbnail_compositions.is_primary IS 'Whether this is the primary/canonical composition for the episode';


--
-- Name: COLUMN thumbnail_compositions.composition_config; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.thumbnail_compositions.composition_config IS 'Stores visibility toggles, text field values, and per-composition overrides';


--
-- Name: COLUMN thumbnail_compositions.deleted_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.thumbnail_compositions.deleted_at IS 'Soft delete timestamp - null means record is active';


--
-- Name: thumbnail_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.thumbnail_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    show_id uuid,
    name character varying(255) NOT NULL,
    description text,
    version integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    required_roles jsonb DEFAULT '[]'::jsonb NOT NULL,
    optional_roles jsonb DEFAULT '[]'::jsonb NOT NULL,
    conditional_roles jsonb DEFAULT '{}'::jsonb NOT NULL,
    paired_roles jsonb DEFAULT '{}'::jsonb NOT NULL,
    layout_config jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.thumbnail_templates OWNER TO postgres;

--
-- Name: timeline_placements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.timeline_placements (
    id uuid NOT NULL,
    episode_id uuid NOT NULL,
    placement_type public.placement_type_enum NOT NULL,
    asset_id uuid,
    wardrobe_item_id uuid,
    scene_id uuid,
    attachment_point public.attachment_point_enum DEFAULT 'scene-start'::public.attachment_point_enum,
    offset_seconds numeric(10,3) DEFAULT 0,
    absolute_timestamp numeric(10,3),
    track_number integer DEFAULT 2 NOT NULL,
    duration numeric(10,3),
    z_index integer DEFAULT 10,
    properties jsonb DEFAULT '{}'::jsonb,
    "character" character varying(100),
    label character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone,
    visual_role character varying(20) DEFAULT 'overlay'::character varying,
    CONSTRAINT timeline_placements_visual_role_check CHECK (((visual_role)::text = ANY ((ARRAY['primary-visual'::character varying, 'overlay'::character varying])::text[])))
);


ALTER TABLE public.timeline_placements OWNER TO postgres;

--
-- Name: COLUMN timeline_placements.episode_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.timeline_placements.episode_id IS 'Episode this placement belongs to';


--
-- Name: COLUMN timeline_placements.placement_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.timeline_placements.placement_type IS 'Type of item being placed';


--
-- Name: COLUMN timeline_placements.asset_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.timeline_placements.asset_id IS 'Asset reference (for asset placements)';


--
-- Name: COLUMN timeline_placements.wardrobe_item_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.timeline_placements.wardrobe_item_id IS 'Wardrobe reference (for wardrobe placements)';


--
-- Name: COLUMN timeline_placements.scene_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.timeline_placements.scene_id IS 'Scene this placement is attached to (null for time-based)';


--
-- Name: COLUMN timeline_placements.attachment_point; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.timeline_placements.attachment_point IS 'Where in the scene this attaches';


--
-- Name: COLUMN timeline_placements.offset_seconds; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.timeline_placements.offset_seconds IS 'Offset from attachment point (seconds)';


--
-- Name: COLUMN timeline_placements.absolute_timestamp; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.timeline_placements.absolute_timestamp IS 'Absolute time in episode (for time-based placements)';


--
-- Name: COLUMN timeline_placements.track_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.timeline_placements.track_number IS 'Timeline track (1=scenes, 2=assets, 3=audio)';


--
-- Name: COLUMN timeline_placements.duration; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.timeline_placements.duration IS 'Display duration (seconds, null for wardrobe events)';


--
-- Name: COLUMN timeline_placements.z_index; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.timeline_placements.z_index IS 'Layering order within track';


--
-- Name: COLUMN timeline_placements.properties; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.timeline_placements.properties IS 'Custom properties (opacity, position, effects, etc.)';


--
-- Name: COLUMN timeline_placements."character"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.timeline_placements."character" IS 'Character name (for wardrobe placements)';


--
-- Name: COLUMN timeline_placements.label; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.timeline_placements.label IS 'User-friendly label for this placement';


--
-- Name: COLUMN timeline_placements.visual_role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.timeline_placements.visual_role IS 'Visual hierarchy: primary-visual (replaces main video) or overlay (layers on top)';


--
-- Name: video_compositions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.video_compositions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    episode_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying,
    scenes jsonb DEFAULT '[]'::jsonb,
    assets jsonb DEFAULT '[]'::jsonb,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT video_compositions_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'processing'::character varying, 'complete'::character varying, 'error'::character varying])::text[])))
);


ALTER TABLE public.video_compositions OWNER TO postgres;

--
-- Name: wardrobe; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wardrobe (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    "character" character varying(50) NOT NULL,
    clothing_category character varying(50) NOT NULL,
    s3_key character varying(500),
    s3_url text,
    thumbnail_url text,
    brand character varying(255),
    price numeric(10,2),
    purchase_link text,
    website character varying(500),
    color character varying(100),
    size character varying(50),
    season character varying(50),
    occasion character varying(100),
    outfit_set_id character varying(100),
    outfit_set_name character varying(255),
    scene_description text,
    outfit_notes text,
    times_worn integer DEFAULT 0 NOT NULL,
    last_worn_date timestamp with time zone,
    is_favorite boolean DEFAULT false NOT NULL,
    tags jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    s3_key_processed character varying(500),
    s3_url_processed text,
    description text,
    notes text,
    library_item_id integer,
    show_id uuid,
    CONSTRAINT check_price_positive CHECK (((price IS NULL) OR (price >= (0)::numeric))),
    CONSTRAINT check_times_worn_positive CHECK ((times_worn >= 0))
);


ALTER TABLE public.wardrobe OWNER TO postgres;

--
-- Name: TABLE wardrobe; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.wardrobe IS 'Wardrobe items - can be used across multiple shows and episodes';


--
-- Name: COLUMN wardrobe."character"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.wardrobe."character" IS 'Character who wears this: lala, justawoman, guest';


--
-- Name: COLUMN wardrobe.clothing_category; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.wardrobe.clothing_category IS 'Category: dress, top, bottom, shoes, accessories, jewelry, perfume';


--
-- Name: COLUMN wardrobe.tags; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.wardrobe.tags IS 'JSON array of tags for filtering and search';


--
-- Name: COLUMN wardrobe.show_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.wardrobe.show_id IS 'Primary show that owns this wardrobe item';


--
-- Name: wardrobe_library; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wardrobe_library (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    type character varying(50) NOT NULL,
    item_type character varying(100),
    image_url text NOT NULL,
    thumbnail_url text,
    s3_key character varying(500),
    default_character character varying(255),
    default_occasion character varying(255),
    default_season character varying(100),
    color character varying(100),
    tags jsonb DEFAULT '[]'::jsonb,
    website text,
    price numeric(10,2),
    vendor character varying(255),
    show_id uuid,
    total_usage_count integer DEFAULT 0,
    last_used_at timestamp without time zone,
    view_count integer DEFAULT 0,
    selection_count integer DEFAULT 0,
    created_by character varying(255),
    updated_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp without time zone
);


ALTER TABLE public.wardrobe_library OWNER TO postgres;

--
-- Name: wardrobe_library_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wardrobe_library_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wardrobe_library_id_seq OWNER TO postgres;

--
-- Name: wardrobe_library_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wardrobe_library_id_seq OWNED BY public.wardrobe_library.id;


--
-- Name: wardrobe_library_references; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wardrobe_library_references (
    id integer NOT NULL,
    library_item_id integer NOT NULL,
    s3_key character varying(500) NOT NULL,
    reference_count integer DEFAULT 1,
    file_size bigint,
    content_type character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.wardrobe_library_references OWNER TO postgres;

--
-- Name: wardrobe_library_references_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wardrobe_library_references_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wardrobe_library_references_id_seq OWNER TO postgres;

--
-- Name: wardrobe_library_references_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wardrobe_library_references_id_seq OWNED BY public.wardrobe_library_references.id;


--
-- Name: wardrobe_usage_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wardrobe_usage_history (
    id integer NOT NULL,
    library_item_id integer NOT NULL,
    episode_id uuid,
    scene_id uuid,
    show_id uuid,
    usage_type character varying(50) NOT NULL,
    "character" character varying(255),
    occasion character varying(255),
    user_id character varying(255),
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.wardrobe_usage_history OWNER TO postgres;

--
-- Name: wardrobe_usage_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wardrobe_usage_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wardrobe_usage_history_id_seq OWNER TO postgres;

--
-- Name: wardrobe_usage_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wardrobe_usage_history_id_seq OWNED BY public.wardrobe_usage_history.id;


--
-- Name: episode_scripts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_scripts ALTER COLUMN id SET DEFAULT nextval('public.episode_scripts_id_seq'::regclass);


--
-- Name: metadata_storage id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metadata_storage ALTER COLUMN id SET DEFAULT nextval('public.metadata_storage_id_seq'::regclass);


--
-- Name: outfit_set_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.outfit_set_items ALTER COLUMN id SET DEFAULT nextval('public.outfit_set_items_id_seq'::regclass);


--
-- Name: outfit_sets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.outfit_sets ALTER COLUMN id SET DEFAULT nextval('public.outfit_sets_id_seq'::regclass);


--
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


--
-- Name: script_edits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.script_edits ALTER COLUMN id SET DEFAULT nextval('public.script_edits_id_seq'::regclass);


--
-- Name: search_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.search_history ALTER COLUMN id SET DEFAULT nextval('public.search_history_id_seq'::regclass);


--
-- Name: wardrobe_library id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe_library ALTER COLUMN id SET DEFAULT nextval('public.wardrobe_library_id_seq'::regclass);


--
-- Name: wardrobe_library_references id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe_library_references ALTER COLUMN id SET DEFAULT nextval('public.wardrobe_library_references_id_seq'::regclass);


--
-- Name: wardrobe_usage_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe_usage_history ALTER COLUMN id SET DEFAULT nextval('public.wardrobe_usage_history_id_seq'::regclass);


--
-- Data for Name: SequelizeMeta; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SequelizeMeta" (name) FROM stdin;
\.


--
-- Data for Name: asset_label_map; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_label_map (id, asset_id, label_id, created_at) FROM stdin;
\.


--
-- Data for Name: asset_labels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_labels (id, name, color, description, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: asset_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_roles (id, show_id, role_key, role_label, category, icon, color, is_required, sort_order, description, created_at, updated_at) FROM stdin;
4340ce4b-2737-4973-b884-1448befb8f32	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	HOST	Host (Lala)	Characters	👩	#ec4899	t	1	Primary show host	2026-01-30 13:01:44.421	2026-01-30 13:01:44.421
b5017081-1834-4e02-9f37-998ea5005015	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	CO_HOST	Co-Host	Characters	👤	#f472b6	f	2	Secondary host or regular guest	2026-01-30 13:01:44.421	2026-01-30 13:01:44.421
0f2d565a-5667-47bc-b18a-fe989a483c10	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	GUEST_1	Guest 1	Characters	🎤	#a855f7	f	3	Featured guest slot 1	2026-01-30 13:01:44.421	2026-01-30 13:01:44.421
533b3077-ccd2-48ed-b607-7138e143d880	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	GUEST_2	Guest 2	Characters	🎤	#a855f7	f	4	Featured guest slot 2	2026-01-30 13:01:44.421	2026-01-30 13:01:44.421
553db3b2-29d4-4fa9-b6c8-68a69b458fa6	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	GUEST_3	Guest 3	Characters	🎤	#a855f7	f	5	Featured guest slot 3	2026-01-30 13:01:44.421	2026-01-30 13:01:44.421
29b09f03-4758-42bd-92ea-647413571fb3	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	ICON_CLOSET	Closet Icon	UI Icons	👗	#3b82f6	f	10	Wardrobe/closet UI element	2026-01-30 13:01:44.421	2026-01-30 13:01:44.421
435cfbfe-99fd-4038-8809-2a3bb6351285	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	ICON_JEWELRY	Jewelry Box Icon	UI Icons	💎	#3b82f6	f	11	Jewelry/accessories UI element	2026-01-30 13:01:44.421	2026-01-30 13:01:44.421
f16b6a14-d17f-4e25-bdb6-f4f19de06cdf	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	ICON_SHOES	Shoes Icon	UI Icons	👠	#3b82f6	f	12	Footwear UI element	2026-01-30 13:01:44.421	2026-01-30 13:01:44.421
05b5b646-8e17-42e9-ae07-a1a8c73a84e6	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	ICON_MAKEUP	Makeup Icon	UI Icons	💄	#3b82f6	f	13	Beauty/makeup UI element	2026-01-30 13:01:44.421	2026-01-30 13:01:44.421
fdcc7476-1505-4082-98e3-6dd33ed39e42	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	CHROME_CURSOR	Cursor/Pointer	UI Chrome	👆	#6b7280	f	20	Custom cursor design	2026-01-30 13:01:44.421	2026-01-30 13:01:44.421
abcc4f06-cae8-47b4-ab97-c4de35973418	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	CHROME_EXIT	Exit Button	UI Chrome	❌	#6b7280	f	21	Exit/close button	2026-01-30 13:01:44.421	2026-01-30 13:01:44.421
88dea6de-cf33-4c89-939f-800d703ff764	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	CHROME_MINIMIZE	Minimize Button	UI Chrome	➖	#6b7280	f	22	Minimize button	2026-01-30 13:01:44.421	2026-01-30 13:01:44.421
63b23c45-5d33-4a0e-b4b2-7358b6a200ce	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	BRAND_SHOW_TITLE	Show Title Logo	Branding	✨	#8b5cf6	t	30	Main show title/logo	2026-01-30 13:01:44.421	2026-01-30 13:01:44.421
b36a2e79-6470-4e7f-8f0a-f33530f7c5c2	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	BRAND_SUBTITLE	Episode Subtitle	Branding	📝	#8b5cf6	f	31	Episode-specific subtitle	2026-01-30 13:01:44.421	2026-01-30 13:01:44.421
6716e3e4-1b2a-478f-83a9-dc03cf281e03	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	BRAND_WATERMARK	Watermark	Branding	🔖	#8b5cf6	f	32	Brand watermark overlay	2026-01-30 13:01:44.421	2026-01-30 13:01:44.421
b10539e1-8742-44ef-8f05-339c1dfb7d66	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	BACKGROUND_MAIN	Background	Background	🌄	#10b981	t	40	Primary background image	2026-01-30 13:01:44.421	2026-01-30 13:01:44.421
976a7e71-95b1-4e4e-bf19-d14005a7e5c9	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	BACKGROUND_OVERLAY	Background Overlay	Background	🎨	#10b981	f	41	Background texture/overlay	2026-01-30 13:01:44.421	2026-01-30 13:01:44.421
\.


--
-- Data for Name: assets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.assets (id, name, asset_type, approval_status, s3_key_raw, s3_url_raw, file_size_bytes, s3_key_processed, s3_url_processed, processed_file_size_bytes, width, height, media_type, duration_seconds, video_codec, audio_codec, bitrate, description, processing_job_id, processing_error, processed_at, s3_key, url, metadata, created_at, updated_at, deleted_at, asset_group, purpose, allowed_uses, is_global, file_name, content_type, asset_role, show_id, episode_id, asset_scope, s3_url_no_bg, s3_url_enhanced, processing_status, processing_metadata, role_key, file_hash) FROM stdin;
c4d220b5-fe8b-4815-a0e8-1e8fb4815575	Game iconsgrahics.png	PROMO_JUSTAWOMANINHERPRIME	APPROVED	promotional/justawomaninherprime/raw/1769788947096-c4d220b5-fe8b-4815-a0e8-1e8fb4815575.png	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/justawomaninherprime/raw/1769788947096-c4d220b5-fe8b-4815-a0e8-1e8fb4815575.png	44124	\N	\N	\N	1080	1080	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-30T16:02:27.693Z", "uploaded_by": "dev-user", "content_type": "image/png", "thumbnail_key": "promotional/justawomaninherprime/raw/thumbnails/1769788947096-c4d220b5-fe8b-4815-a0e8-1e8fb4815575-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/justawomaninherprime/raw/thumbnails/1769788947096-c4d220b5-fe8b-4815-a0e8-1e8fb4815575-thumb.jpg", "original_filename": "Game iconsgrahics.png"}	2026-01-30 11:02:27.703-05	2026-01-30 11:02:27.703-05	2026-01-30 11:35:23.611-05	SHOW	MAIN	{THUMBNAIL,SOCIAL,SCENE}	f	Game iconsgrahics.png	image/png	BRAND.SHOW.TITLE_GRAPHIC	\N	2b7065de-f599-4c5b-95a7-61df8f91cffa	EPISODE	\N	\N	none	{}	\N	\N
3083ff68-fd92-45bc-b208-6f4ecb5d4c31	6b803d45-e361-4055-bcac-f49a9865fd20.jpg	BRAND_LOGO	APPROVED	promotional/brands/1769392571137-3083ff68-fd92-45bc-b208-6f4ecb5d4c31.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/brands/1769392571137-3083ff68-fd92-45bc-b208-6f4ecb5d4c31.jpg	90682	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/brands/1769392571137-3083ff68-fd92-45bc-b208-6f4ecb5d4c31.jpg	\N	1024	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-26T01:56:11.671Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/brands/thumbnails/1769392571137-3083ff68-fd92-45bc-b208-6f4ecb5d4c31-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/brands/thumbnails/1769392571137-3083ff68-fd92-45bc-b208-6f4ecb5d4c31-thumb.jpg", "needs_processing": true, "original_filename": "6b803d45-e361-4055-bcac-f49a9865fd20.jpg", "processing_status": "copied_from_raw"}	2026-01-25 20:56:11.671-05	2026-01-25 20:56:11.671-05	2026-01-30 12:32:14.168-05	SHOW	ICON	{UI,SOCIAL,SCENE}	t	6b803d45-e361-4055-bcac-f49a9865fd20.jpg	image/jpeg	UI.ICON.CLOSET	\N	2b7065de-f599-4c5b-95a7-61df8f91cffa	GLOBAL	\N	\N	none	{}	\N	\N
8d4afaac-5faf-46fe-b7e1-f37cc57a4cfb	Game iconsgrahics.png	PROMO_JUSTAWOMANINHERPRIME	APPROVED	promotional/justawomaninherprime/raw/1769791078804-8d4afaac-5faf-46fe-b7e1-f37cc57a4cfb.png	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/justawomaninherprime/raw/1769791078804-8d4afaac-5faf-46fe-b7e1-f37cc57a4cfb.png	44124	\N	\N	\N	1080	1080	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-30T16:37:59.289Z", "uploaded_by": "dev-user", "content_type": "image/png", "thumbnail_key": "promotional/justawomaninherprime/raw/thumbnails/1769791078804-8d4afaac-5faf-46fe-b7e1-f37cc57a4cfb-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/justawomaninherprime/raw/thumbnails/1769791078804-8d4afaac-5faf-46fe-b7e1-f37cc57a4cfb-thumb.jpg", "original_filename": "Game iconsgrahics.png"}	2026-01-30 11:37:59.29-05	2026-01-30 11:37:59.29-05	2026-01-30 12:32:44.996-05	SHOW	MAIN	{THUMBNAIL,SOCIAL,SCENE}	f	Game iconsgrahics.png	image/png	BRAND.SHOW.TITLE_GRAPHIC	\N	2b7065de-f599-4c5b-95a7-61df8f91cffa	EPISODE	\N	\N	none	{}	\N	\N
fc5027f2-3d35-4ac4-b16b-7fe1706b0130	Purple Sequin Blazer	CLOTHING_LALA	APPROVED	\N	\N	\N	\N	\N	\N	\N	\N	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"size": "S", "tags": ["sparkly", "designer", "statement-piece"], "brand": "Balmain", "color": "Purple", "price": "2450.00", "scene": "Opening Interview", "reason": "Metadata-only record - no actual file uploaded yet", "season": "all-season", "website": "balmain.com", "lastWorn": "2024-01-15", "occasion": "red-carpet", "character": "lala", "episodeId": "7ed50b54-2eb3-425a-830a-6704648c4635", "marked_at": "2026-01-30T13:46:51.949681+00:00", "timesWorn": 3, "isFavorite": true, "file_status": "missing", "outfitNotes": "Pair with black leather pants and gold heels. Make sure to steam before use.", "outfitSetId": "set-001", "purchaseLink": "https://www.balmain.com", "outfitSetName": "Purple Power Look", "clothingCategory": "top", "previousEpisodes": ["ep-001", "ep-003"], "needs_file_upload": true, "plannedForEpisodes": [], "exclude_from_gallery": true}	2026-01-19 02:21:40.577522-05	2026-01-25 20:47:25.392-05	2026-01-30 12:32:45.005-05	WARDROBE	MAIN	{THUMBNAIL,SOCIAL,UI}	t	\N	\N	WARDROBE.HOST.PRIMARY	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	\N	SHOW	\N	\N	none	{}	\N	\N
5dd49813-c3ad-4b54-af56-2e2da254b9ef	1ff6613a-830f-4513-aec3-a9b07ce752f5.jpg	BRAND_LOGO	APPROVED	promotional/brands/1769396645019-5dd49813-c3ad-4b54-af56-2e2da254b9ef.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/brands/1769396645019-5dd49813-c3ad-4b54-af56-2e2da254b9ef.jpg	81163	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/brands/1769396645019-5dd49813-c3ad-4b54-af56-2e2da254b9ef.jpg	\N	1024	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-26T03:04:05.625Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/brands/thumbnails/1769396645019-5dd49813-c3ad-4b54-af56-2e2da254b9ef-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/brands/thumbnails/1769396645019-5dd49813-c3ad-4b54-af56-2e2da254b9ef-thumb.jpg", "needs_processing": true, "original_filename": "1ff6613a-830f-4513-aec3-a9b07ce752f5.jpg", "processing_status": "copied_from_raw"}	2026-01-25 22:04:05.625-05	2026-01-25 22:04:05.625-05	2026-01-30 12:32:07.059-05	SHOW	ICON	{UI,SOCIAL,SCENE}	t	1ff6613a-830f-4513-aec3-a9b07ce752f5.jpg	image/jpeg	UI.ICON.JEWELRY_BOX	\N	2b7065de-f599-4c5b-95a7-61df8f91cffa	GLOBAL	\N	\N	none	{}	\N	\N
3be68abb-8a1b-4d44-8a4f-4a7c53ab7708	518281709_10238842252621649_7803248841376928855_n.jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1769392398605-3be68abb-8a1b-4d44-8a4f-4a7c53ab7708.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769392398605-3be68abb-8a1b-4d44-8a4f-4a7c53ab7708.jpg	702704	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769392398605-3be68abb-8a1b-4d44-8a4f-4a7c53ab7708.jpg	\N	1536	2048	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-26T01:53:20.191Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1769392398605-3be68abb-8a1b-4d44-8a4f-4a7c53ab7708-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1769392398605-3be68abb-8a1b-4d44-8a4f-4a7c53ab7708-thumb.jpg", "needs_processing": true, "original_filename": "518281709_10238842252621649_7803248841376928855_n.jpg", "processing_status": "copied_from_raw"}	2026-01-25 20:53:20.192-05	2026-01-25 20:53:20.192-05	2026-01-30 12:32:44.999-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	518281709_10238842252621649_7803248841376928855_n.jpg	image/jpeg	CHAR.HOST.LALA	\N	2b7065de-f599-4c5b-95a7-61df8f91cffa	GLOBAL	\N	\N	none	{}	\N	\N
c9f2dcbc-1717-4590-8d21-0a030b4492c7	518281709_10238842252621649_7803248841376928855_n (1).jpg	PROMO_GUEST	APPROVED	promotional/guests/raw/1768834486396-c9f2dcbc-1717-4590-8d21-0a030b4492c7.jpg	https://mock-s3.dev/promotional/guests/raw/1768834486396-c9f2dcbc-1717-4590-8d21-0a030b4492c7.jpg	702704	\N	\N	\N	1536	2048	image	\N	\N	\N	\N	\N	\N	\N	\N	promotional/guests/raw/1768834486396-c9f2dcbc-1717-4590-8d21-0a030b4492c7.jpg	https://mock-s3.dev/promotional/guests/raw/1768834486396-c9f2dcbc-1717-4590-8d21-0a030b4492c7.jpg	{"tags": [], "character": "lala", "uploaded_at": "2026-01-19T14:54:47.702Z", "uploaded_by": "system", "content_type": "image/jpeg", "mainCategory": "GUEST", "thumbnail_key": "promotional/guests/raw/thumbnails/1768834486396-c9f2dcbc-1717-4590-8d21-0a030b4492c7-thumb.jpg", "thumbnail_url": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22150%22%20height%3D%22150%22%3E%3Crect%20fill%3D%22%23e0e0e0%22%20width%3D%22150%22%20height%3D%22150%22%2F%3E%3Ctext%20x%3D%2275%22%20y%3D%2275%22%20text-anchor%3D%22middle%22%20fill%3D%22%23999%22%20font-size%3D%2214%22%20dy%3D%22.3em%22%20dominant-baseline%3D%22middle%22%3E%F0%9F%93%A6%3C%2Ftext%3E%3C%2Fsvg%3E", "previousEpisodes": [], "original_filename": "518281709_10238842252621649_7803248841376928855_n (1).jpg", "plannedForEpisodes": []}	2026-01-19 09:54:47.703-05	2026-01-19 09:54:47.704-05	2026-01-30 12:32:45.004-05	GUEST	MAIN	{THUMBNAIL,SCENE}	f	1768834486396-c9f2dcbc-1717-4590-8d21-0a030b4492c7.jpg	image/jpeg	CHAR.GUEST	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	\N	SHOW	\N	\N	none	{}	\N	\N
6497dbed-a014-4b62-b500-604e03122fd5	Diamond Stud Earrings	CLOTHING_LALA	APPROVED	\N	\N	\N	\N	\N	\N	\N	\N	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"size": "1ct", "tags": ["signature", "diamonds", "luxury", "go-to"], "brand": "Tiffany & Co", "color": "Silver", "price": "3500.00", "scene": "Multiple Scenes", "reason": "Metadata-only record - no actual file uploaded yet", "season": "all-season", "website": "tiffany.com", "lastWorn": "2024-01-15", "occasion": "formal", "character": "lala", "episodeId": "7ed50b54-2eb3-425a-830a-6704648c4635", "marked_at": "2026-01-30T13:46:51.949681+00:00", "timesWorn": 10, "isFavorite": true, "file_status": "missing", "outfitNotes": "Signature jewelry. Wear with almost everything.", "outfitSetId": "", "purchaseLink": "https://www.tiffany.com", "outfitSetName": "", "clothingCategory": "jewelry", "previousEpisodes": ["ep-001", "ep-002", "ep-003", "ep-004", "ep-005"], "needs_file_upload": true, "plannedForEpisodes": ["ep-010", "ep-011"], "exclude_from_gallery": true}	2026-01-19 02:21:40.594504-05	2026-01-25 20:47:25.403-05	2026-01-30 12:32:45.004-05	WARDROBE	MAIN	{THUMBNAIL,SOCIAL,UI}	t	\N	\N	WARDROBE.HOST.PRIMARY	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	\N	SHOW	\N	\N	none	{}	\N	\N
6191f74f-72a6-4768-930e-dfd08a04b226	Styling Adventures Logo [PLACEHOLDER - NEEDS UPLOAD]	LOGO	APPROVED	\N	\N	\N	\N	data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==	\N	\N	\N	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"marked_at": "2026-01-30T13:46:51.949681+00:00", "is_placeholder": true, "needs_real_upload": true, "placeholder_reason": "Seeded data - replace with actual file"}	2026-01-24 21:39:23.950673-05	2026-01-25 20:47:25.414-05	2026-01-30 12:32:45.003-05	SHOW	\N	\N	f	\N	\N	BRAND.SHOW.TITLE	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	\N	SHOW	\N	\N	none	{}	\N	\N
8a42c514-502e-4ad0-8eeb-0a9a531f20a6	Episode Title Card [PLACEHOLDER - NEEDS UPLOAD]	TITLE_CARD	APPROVED	\N	\N	\N	\N	data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==	\N	\N	\N	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"marked_at": "2026-01-30T13:46:51.949681+00:00", "is_placeholder": true, "needs_real_upload": true, "placeholder_reason": "Seeded data - replace with actual file"}	2026-01-24 21:39:23.937802-05	2026-01-25 20:47:25.41-05	2026-01-30 12:32:45.003-05	EPISODE	\N	\N	f	\N	\N	TEXT.TITLE.PRIMARY	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	51299ab6-1f9a-41af-951e-cd76cd9272a6	EPISODE	\N	\N	none	{}	\N	\N
6b8dc7e1-c1b2-4184-be07-87c5b7359f12	Chanel No. 5 Perfume	CLOTHING_LALA	APPROVED	\N	\N	\N	\N	\N	\N	\N	\N	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"size": "3.4oz", "tags": ["signature-scent", "luxury", "iconic"], "brand": "Chanel", "color": "N/A", "price": "135.00", "scene": "All Scenes", "reason": "Metadata-only record - no actual file uploaded yet", "season": "all-season", "website": "chanel.com", "lastWorn": "2024-01-15", "occasion": "everyday", "character": "lala", "episodeId": "7ed50b54-2eb3-425a-830a-6704648c4635", "marked_at": "2026-01-30T13:46:51.949681+00:00", "timesWorn": 20, "isFavorite": true, "file_status": "missing", "outfitNotes": "Signature scent. Essential for character consistency.", "outfitSetId": "", "purchaseLink": "https://www.chanel.com", "outfitSetName": "", "clothingCategory": "perfume", "previousEpisodes": ["ep-001", "ep-002", "ep-003", "ep-004", "ep-005", "ep-006"], "needs_file_upload": true, "plannedForEpisodes": ["ep-010", "ep-011", "ep-012"], "exclude_from_gallery": true}	2026-01-19 02:21:40.595472-05	2026-01-25 20:47:25.406-05	2026-01-30 12:32:45.004-05	WARDROBE	MAIN	{THUMBNAIL,SOCIAL,UI}	t	\N	\N	WARDROBE.HOST.PRIMARY	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	\N	SHOW	\N	\N	none	{}	\N	\N
e213aedc-fd7b-4e7e-9b8e-a97e43e59e96	77fcd54b-0cfb-427a-8b70-ad63e053402f.jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1769731781209-e213aedc-fd7b-4e7e-9b8e-a97e43e59e96.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769731781209-e213aedc-fd7b-4e7e-9b8e-a97e43e59e96.jpg	90562	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769731781209-e213aedc-fd7b-4e7e-9b8e-a97e43e59e96.jpg	\N	1024	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-30T00:09:41.731Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1769731781209-e213aedc-fd7b-4e7e-9b8e-a97e43e59e96-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1769731781209-e213aedc-fd7b-4e7e-9b8e-a97e43e59e96-thumb.jpg", "needs_processing": true, "original_filename": "77fcd54b-0cfb-427a-8b70-ad63e053402f.jpg", "processing_status": "copied_from_raw"}	2026-01-29 19:09:41.736-05	2026-01-29 19:09:41.736-05	2026-01-30 11:35:29.454-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	77fcd54b-0cfb-427a-8b70-ad63e053402f.jpg	image/jpeg	CHAR.HOST.LALA	\N	2b7065de-f599-4c5b-95a7-61df8f91cffa	GLOBAL	\N	\N	none	{}	\N	\N
468373f2-1efc-459b-a061-f43233da3629	e923d58c-31e2-472c-9be3-2f06c7ba5d39.jpg	BRAND_LOGO	APPROVED	promotional/brands/1769424602421-468373f2-1efc-459b-a061-f43233da3629.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/brands/1769424602421-468373f2-1efc-459b-a061-f43233da3629.jpg	85039	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/brands/1769424602421-468373f2-1efc-459b-a061-f43233da3629.jpg	\N	1024	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-26T10:50:02.976Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/brands/thumbnails/1769424602421-468373f2-1efc-459b-a061-f43233da3629-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/brands/thumbnails/1769424602421-468373f2-1efc-459b-a061-f43233da3629-thumb.jpg", "needs_processing": true, "original_filename": "e923d58c-31e2-472c-9be3-2f06c7ba5d39.jpg", "processing_status": "copied_from_raw"}	2026-01-26 05:50:02.977-05	2026-01-26 05:50:02.977-05	2026-01-30 12:32:44.997-05	SHOW	ICON	{UI,SOCIAL,SCENE}	t	e923d58c-31e2-472c-9be3-2f06c7ba5d39.jpg	image/jpeg	UI.ICON.POSE	\N	2b7065de-f599-4c5b-95a7-61df8f91cffa	GLOBAL	\N	\N	none	{}	\N	\N
9d4268c4-2d73-4d72-8ca9-cc9803392354	Game iconsgrahics.png	PROMO_JUSTAWOMANINHERPRIME	APPROVED	branding/show/raw/1769794400183-9d4268c4-2d73-4d72-8ca9-cc9803392354.png	https://episode-metadata-storage-dev.s3.amazonaws.com/branding/show/raw/1769794400183-9d4268c4-2d73-4d72-8ca9-cc9803392354.png	44124	\N	\N	\N	1080	1080	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-30T17:33:20.694Z", "uploaded_by": "dev-user", "content_type": "image/png", "thumbnail_key": "branding/show/raw/thumbnails/1769794400183-9d4268c4-2d73-4d72-8ca9-cc9803392354-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/branding/show/raw/thumbnails/1769794400183-9d4268c4-2d73-4d72-8ca9-cc9803392354-thumb.jpg", "original_filename": "Game iconsgrahics.png"}	2026-01-30 12:33:20.695-05	2026-01-30 12:33:20.695-05	\N	SHOW	MAIN	{THUMBNAIL,SOCIAL,SCENE}	f	Game iconsgrahics.png	image/png	BRAND.SHOW.TITLE_GRAPHIC	\N	2b7065de-f599-4c5b-95a7-61df8f91cffa	EPISODE	\N	\N	none	{}	\N	\N
4ff7e468-9e19-4fd3-88e1-25a3158d63b7	518281709_10238842252621649_7803248841376928855_n.jpg	PROMO_JUSTAWOMANINHERPRIME	APPROVED	characters/host/raw/1769813075624-4ff7e468-9e19-4fd3-88e1-25a3158d63b7.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/characters/host/raw/1769813075624-4ff7e468-9e19-4fd3-88e1-25a3158d63b7.jpg	702704	\N	\N	\N	1536	2048	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-30T22:44:36.430Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "characters/host/raw/thumbnails/1769813075624-4ff7e468-9e19-4fd3-88e1-25a3158d63b7-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/characters/host/raw/thumbnails/1769813075624-4ff7e468-9e19-4fd3-88e1-25a3158d63b7-thumb.jpg", "original_filename": "518281709_10238842252621649_7803248841376928855_n.jpg"}	2026-01-30 17:44:36.431-05	2026-01-30 17:44:36.431-05	\N	SHOW	MAIN	{THUMBNAIL,SOCIAL,SCENE}	f	518281709_10238842252621649_7803248841376928855_n.jpg	image/jpeg	CHAR.HOST.JUSTAWOMANINHERPRIME	\N	2b7065de-f599-4c5b-95a7-61df8f91cffa	EPISODE	\N	\N	none	{}	\N	\N
e53d2a46-c19c-4730-b65e-f5026bf37f48	e923d58c-31e2-472c-9be3-2f06c7ba5d39.jpg	BRAND_LOGO	APPROVED	ui/icons/raw/1769813096010-e53d2a46-c19c-4730-b65e-f5026bf37f48.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/ui/icons/raw/1769813096010-e53d2a46-c19c-4730-b65e-f5026bf37f48.jpg	85039	\N	\N	\N	1024	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-30T22:44:56.399Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "ui/icons/raw/thumbnails/1769813096010-e53d2a46-c19c-4730-b65e-f5026bf37f48-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/ui/icons/raw/thumbnails/1769813096010-e53d2a46-c19c-4730-b65e-f5026bf37f48-thumb.jpg", "original_filename": "e923d58c-31e2-472c-9be3-2f06c7ba5d39.jpg"}	2026-01-30 17:44:56.399-05	2026-01-30 17:44:56.399-05	\N	SHOW	ICON	{UI,SOCIAL,SCENE}	t	e923d58c-31e2-472c-9be3-2f06c7ba5d39.jpg	image/jpeg	UI.ICON.TODO_LIST	\N	2b7065de-f599-4c5b-95a7-61df8f91cffa	GLOBAL	\N	\N	none	{}	\N	\N
e280ed0b-aabe-4704-b110-3af3482d27b7	bfb6252b-71a6-4b53-afc7-282bc7c745cb.jpg	BRAND_LOGO	APPROVED	ui/icons/raw/1769813116809-e280ed0b-aabe-4704-b110-3af3482d27b7.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/ui/icons/raw/1769813116809-e280ed0b-aabe-4704-b110-3af3482d27b7.jpg	260245	\N	\N	\N	1792	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-30T22:45:17.315Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "ui/icons/raw/thumbnails/1769813116809-e280ed0b-aabe-4704-b110-3af3482d27b7-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/ui/icons/raw/thumbnails/1769813116809-e280ed0b-aabe-4704-b110-3af3482d27b7-thumb.jpg", "original_filename": "bfb6252b-71a6-4b53-afc7-282bc7c745cb.jpg"}	2026-01-30 17:45:17.315-05	2026-01-30 17:45:17.315-05	\N	SHOW	ICON	{UI,SOCIAL,SCENE}	t	bfb6252b-71a6-4b53-afc7-282bc7c745cb.jpg	image/jpeg	UI.ICON.HOLDER.MAIN	\N	2b7065de-f599-4c5b-95a7-61df8f91cffa	GLOBAL	\N	\N	none	{}	\N	\N
f00a082b-a7ba-4e3d-80c8-e0ec01324e24	518281709_10238842252621649_7803248841376928855_n (1).jpg	PROMO_JUSTAWOMANINHERPRIME	APPROVED	characters/host/raw/1769813159910-f00a082b-a7ba-4e3d-80c8-e0ec01324e24.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/characters/host/raw/1769813159910-f00a082b-a7ba-4e3d-80c8-e0ec01324e24.jpg	702704	\N	\N	\N	1536	2048	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-30T22:46:00.529Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "characters/host/raw/thumbnails/1769813159910-f00a082b-a7ba-4e3d-80c8-e0ec01324e24-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/characters/host/raw/thumbnails/1769813159910-f00a082b-a7ba-4e3d-80c8-e0ec01324e24-thumb.jpg", "original_filename": "518281709_10238842252621649_7803248841376928855_n (1).jpg"}	2026-01-30 17:46:00.53-05	2026-01-30 17:46:00.53-05	\N	SHOW	MAIN	{THUMBNAIL,SOCIAL,SCENE}	f	518281709_10238842252621649_7803248841376928855_n (1).jpg	image/jpeg	CHAR.HOST.JUSTAWOMANINHERPRIME	\N	2b7065de-f599-4c5b-95a7-61df8f91cffa	EPISODE	\N	\N	none	{}	\N	\N
f5fb22da-31a0-4015-92cf-b7eb853cfb3e	sunny closet	BACKGROUND_IMAGE	APPROVED	backgrounds/main/raw/1769813190962-f5fb22da-31a0-4015-92cf-b7eb853cfb3e.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/backgrounds/main/raw/1769813190962-f5fb22da-31a0-4015-92cf-b7eb853cfb3e.jpg	122833	\N	\N	\N	1536	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-30T22:46:31.503Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "backgrounds/main/raw/thumbnails/1769813190962-f5fb22da-31a0-4015-92cf-b7eb853cfb3e-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/backgrounds/main/raw/thumbnails/1769813190962-f5fb22da-31a0-4015-92cf-b7eb853cfb3e-thumb.jpg", "original_filename": "b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg"}	2026-01-30 17:46:31.504-05	2026-01-31 05:23:08.772-05	\N	EPISODE	MAIN	{SCENE,THUMBNAIL}	f	b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg	image/jpeg	BG.MAIN	\N	2b7065de-f599-4c5b-95a7-61df8f91cffa	EPISODE	\N	\N	none	{}	\N	\N
b98cfb7b-fc19-4461-9c2d-d2c15128ed61	bfb6252b-71a6-4b53-afc7-282bc7c745cb.jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1769381420569-b98cfb7b-fc19-4461-9c2d-d2c15128ed61.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769381420569-b98cfb7b-fc19-4461-9c2d-d2c15128ed61.jpg	260245	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769381420569-b98cfb7b-fc19-4461-9c2d-d2c15128ed61.jpg	\N	1792	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-25T22:50:21.508Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1769381420569-b98cfb7b-fc19-4461-9c2d-d2c15128ed61-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1769381420569-b98cfb7b-fc19-4461-9c2d-d2c15128ed61-thumb.jpg", "needs_processing": true, "original_filename": "bfb6252b-71a6-4b53-afc7-282bc7c745cb.jpg", "processing_status": "copied_from_raw"}	2026-01-25 17:50:21.508-05	2026-01-25 17:50:21.508-05	2026-01-30 12:32:45-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	bfb6252b-71a6-4b53-afc7-282bc7c745cb.jpg	image/jpeg	CHAR.HOST.LALA	\N	\N	GLOBAL	\N	\N	none	{}	\N	\N
4ae76644-f87a-4b19-991f-5a776dae7002	test-image.png	BACKGROUND_IMAGE	APPROVED	backgrounds/images/raw/1770293894340-4ae76644-f87a-4b19-991f-5a776dae7002.png	https://episode-metadata-storage-dev.s3.amazonaws.com/backgrounds/images/raw/1770293894340-4ae76644-f87a-4b19-991f-5a776dae7002.png	34	\N	\N	\N	\N	\N	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"uploaded_at": "2026-02-05T12:18:14.608Z", "uploaded_by": "system", "content_type": "image/png", "thumbnail_key": null, "thumbnail_url": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22150%22%20height%3D%22150%22%3E%3Crect%20fill%3D%22%23e0e0e0%22%20width%3D%22150%22%20height%3D%22150%22%2F%3E%3Ctext%20x%3D%2275%22%20y%3D%2275%22%20text-anchor%3D%22middle%22%20fill%3D%22%23999%22%20font-size%3D%2214%22%20dy%3D%22.3em%22%20dominant-baseline%3D%22middle%22%3E%F0%9F%93%A6%3C%2Ftext%3E%3C%2Fsvg%3E", "original_filename": "test-image.png"}	2026-02-05 07:18:14.61-05	2026-02-05 07:18:14.61-05	\N	EPISODE	MAIN	{SCENE,THUMBNAIL}	f	test-image.png	image/png	\N	\N	\N	EPISODE	\N	\N	none	{}	\N	\N
a4062229-d625-4d62-b086-7914923fdd02	518281709_10238842252621649_7803248841376928855_n (1).jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1769381480946-a4062229-d625-4d62-b086-7914923fdd02.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769381480946-a4062229-d625-4d62-b086-7914923fdd02.jpg	702704	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769381480946-a4062229-d625-4d62-b086-7914923fdd02.jpg	\N	1536	2048	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-25T22:51:22.212Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1769381480946-a4062229-d625-4d62-b086-7914923fdd02-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1769381480946-a4062229-d625-4d62-b086-7914923fdd02-thumb.jpg", "needs_processing": true, "original_filename": "518281709_10238842252621649_7803248841376928855_n (1).jpg", "processing_status": "copied_from_raw"}	2026-01-25 17:51:22.213-05	2026-01-25 17:51:22.213-05	2026-01-30 12:32:45-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	518281709_10238842252621649_7803248841376928855_n (1).jpg	image/jpeg	CHAR.HOST.LALA	\N	\N	GLOBAL	\N	\N	none	{}	\N	\N
ef935113-2f4c-480f-9769-452d9725cab8	test-thumbnail.png	BACKGROUND_IMAGE	APPROVED	backgrounds/images/raw/1770294424753-ef935113-2f4c-480f-9769-452d9725cab8.png	https://episode-metadata-storage-dev.s3.amazonaws.com/backgrounds/images/raw/1770294424753-ef935113-2f4c-480f-9769-452d9725cab8.png	65	\N	\N	\N	\N	\N	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"uploaded_at": "2026-02-05T12:27:04.958Z", "uploaded_by": "system", "content_type": "image/png", "thumbnail_key": null, "thumbnail_url": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22150%22%20height%3D%22150%22%3E%3Crect%20fill%3D%22%23e0e0e0%22%20width%3D%22150%22%20height%3D%22150%22%2F%3E%3Ctext%20x%3D%2275%22%20y%3D%2275%22%20text-anchor%3D%22middle%22%20fill%3D%22%23999%22%20font-size%3D%2214%22%20dy%3D%22.3em%22%20dominant-baseline%3D%22middle%22%3E%F0%9F%93%A6%3C%2Ftext%3E%3C%2Fsvg%3E", "original_filename": "test-thumbnail.png"}	2026-02-05 07:27:04.959-05	2026-02-05 07:27:04.959-05	\N	EPISODE	MAIN	{SCENE,THUMBNAIL}	f	test-thumbnail.png	image/png	\N	\N	\N	EPISODE	\N	\N	none	{}	\N	\N
b2328c0e-b16e-490c-b127-6e00d1f25e74	bfb6252b-71a6-4b53-afc7-282bc7c745cb.jpg	BRAND_LOGO	APPROVED	promotional/brands/1769387704929-b2328c0e-b16e-490c-b127-6e00d1f25e74.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/brands/1769387704929-b2328c0e-b16e-490c-b127-6e00d1f25e74.jpg	260245	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/brands/1769387704929-b2328c0e-b16e-490c-b127-6e00d1f25e74.jpg	\N	1792	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-26T00:35:05.585Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/brands/thumbnails/1769387704929-b2328c0e-b16e-490c-b127-6e00d1f25e74-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/brands/thumbnails/1769387704929-b2328c0e-b16e-490c-b127-6e00d1f25e74-thumb.jpg", "needs_processing": true, "original_filename": "bfb6252b-71a6-4b53-afc7-282bc7c745cb.jpg", "processing_status": "copied_from_raw"}	2026-01-25 19:35:05.586-05	2026-01-25 20:47:25.43-05	2026-01-30 12:32:44.999-05	SHOW	ICON	{UI,SOCIAL,SCENE}	t	bfb6252b-71a6-4b53-afc7-282bc7c745cb.jpg	image/jpeg	UI.ICON.HOLDER.MAIN	\N	\N	GLOBAL	\N	\N	none	{}	\N	\N
f028c460-5853-42a5-a687-655ebbd48223	Gold Strappy Heels	CLOTHING_LALA	APPROVED	\N	\N	\N	\N	\N	\N	\N	\N	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"size": "7", "tags": ["heels", "evening", "gold-tone"], "brand": "Jimmy Choo", "color": "Gold", "price": "795.00", "scene": "Opening Interview", "reason": "Metadata-only record - no actual file uploaded yet", "season": "all-season", "website": "jimmychoo.com", "lastWorn": "2024-01-15", "occasion": "formal", "character": "lala", "episodeId": "7ed50b54-2eb3-425a-830a-6704648c4635", "marked_at": "2026-01-30T13:46:51.949681+00:00", "timesWorn": 2, "isFavorite": false, "file_status": "missing", "outfitNotes": "Comfortable for long shoots. Add heel grips.", "outfitSetId": "set-001", "purchaseLink": "https://www.jimmychoo.com", "outfitSetName": "Purple Power Look", "clothingCategory": "shoes", "previousEpisodes": ["ep-003"], "needs_file_upload": true, "plannedForEpisodes": [], "exclude_from_gallery": true}	2026-01-19 02:21:40.590835-05	2026-01-25 20:47:25.4-05	2026-01-30 12:32:45.005-05	WARDROBE	MAIN	{THUMBNAIL,SOCIAL,UI}	t	\N	\N	WARDROBE.HOST.PRIMARY	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	\N	SHOW	\N	\N	none	{}	\N	\N
f78a79b2-c83c-4ea1-992b-2639a19c3ce3	518281709_10238842252621649_7803248841376928855_n.jpg	PROMO_GUEST	APPROVED	promotional/guests/raw/1769392484053-f78a79b2-c83c-4ea1-992b-2639a19c3ce3.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/guests/raw/1769392484053-f78a79b2-c83c-4ea1-992b-2639a19c3ce3.jpg	702704	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/guests/raw/1769392484053-f78a79b2-c83c-4ea1-992b-2639a19c3ce3.jpg	\N	1536	2048	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-26T01:54:45.805Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/guests/raw/thumbnails/1769392484053-f78a79b2-c83c-4ea1-992b-2639a19c3ce3-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/guests/raw/thumbnails/1769392484053-f78a79b2-c83c-4ea1-992b-2639a19c3ce3-thumb.jpg", "needs_processing": true, "original_filename": "518281709_10238842252621649_7803248841376928855_n.jpg", "processing_status": "copied_from_raw"}	2026-01-25 20:54:45.805-05	2026-01-25 20:54:45.805-05	2026-01-30 12:32:21.225-05	GUEST	MAIN	{THUMBNAIL,SCENE}	f	518281709_10238842252621649_7803248841376928855_n.jpg	image/jpeg	CHAR.GUEST.2	\N	2b7065de-f599-4c5b-95a7-61df8f91cffa	EPISODE	\N	\N	none	{}	\N	\N
0db17cae-7f1c-4a24-b5e3-e8a73b7d1c2a	518281709_10238842252621649_7803248841376928855_n (1).jpg	PROMO_JUSTAWOMANINHERPRIME	APPROVED	promotional/justawomaninherprime/raw/1769392422084-0db17cae-7f1c-4a24-b5e3-e8a73b7d1c2a.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/justawomaninherprime/raw/1769392422084-0db17cae-7f1c-4a24-b5e3-e8a73b7d1c2a.jpg	702704	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/justawomaninherprime/raw/1769392422084-0db17cae-7f1c-4a24-b5e3-e8a73b7d1c2a.jpg	\N	1536	2048	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-26T01:53:44.379Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/justawomaninherprime/raw/thumbnails/1769392422084-0db17cae-7f1c-4a24-b5e3-e8a73b7d1c2a-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/justawomaninherprime/raw/thumbnails/1769392422084-0db17cae-7f1c-4a24-b5e3-e8a73b7d1c2a-thumb.jpg", "needs_processing": true, "original_filename": "518281709_10238842252621649_7803248841376928855_n (1).jpg", "processing_status": "copied_from_raw"}	2026-01-25 20:53:44.38-05	2026-01-25 20:53:44.38-05	2026-01-30 12:32:44.998-05	SHOW	MAIN	{THUMBNAIL,SOCIAL,SCENE}	f	518281709_10238842252621649_7803248841376928855_n (1).jpg	image/jpeg	CHAR.HOST.JUSTAWOMANINHERPRIME	\N	2b7065de-f599-4c5b-95a7-61df8f91cffa	EPISODE	\N	\N	none	{}	\N	\N
e6db6102-ca61-4253-920a-558fb2ecd612	Game iconsgrahics.png	PROMO_JUSTAWOMANINHERPRIME	APPROVED	promotional/justawomaninherprime/raw/1769623310155-e6db6102-ca61-4253-920a-558fb2ecd612.png	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/justawomaninherprime/raw/1769623310155-e6db6102-ca61-4253-920a-558fb2ecd612.png	44124	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/justawomaninherprime/raw/1769623310155-e6db6102-ca61-4253-920a-558fb2ecd612.png	\N	1080	1080	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-28T18:01:50.868Z", "uploaded_by": "dev-user", "content_type": "image/png", "thumbnail_key": "promotional/justawomaninherprime/raw/thumbnails/1769623310155-e6db6102-ca61-4253-920a-558fb2ecd612-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/justawomaninherprime/raw/thumbnails/1769623310155-e6db6102-ca61-4253-920a-558fb2ecd612-thumb.jpg", "needs_processing": true, "original_filename": "Game iconsgrahics.png", "processing_status": "copied_from_raw"}	2026-01-28 13:01:50.868-05	2026-01-28 13:01:50.868-05	2026-01-30 11:35:34.923-05	SHOW	MAIN	{THUMBNAIL,SOCIAL,SCENE}	f	Game iconsgrahics.png	image/png	BRAND.SHOW.TITLE_GRAPHIC	\N	2b7065de-f599-4c5b-95a7-61df8f91cffa	EPISODE	\N	\N	none	{}	\N	\N
587984ad-7c19-4adf-9957-ff02c5539bcb	b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg	BACKGROUND_IMAGE	APPROVED	backgrounds/images/1769399396679-587984ad-7c19-4adf-9957-ff02c5539bcb.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/backgrounds/images/1769399396679-587984ad-7c19-4adf-9957-ff02c5539bcb.jpg	122833	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/backgrounds/images/1769399396679-587984ad-7c19-4adf-9957-ff02c5539bcb.jpg	\N	1536	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-26T03:49:57.334Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "backgrounds/images/thumbnails/1769399396679-587984ad-7c19-4adf-9957-ff02c5539bcb-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/backgrounds/images/thumbnails/1769399396679-587984ad-7c19-4adf-9957-ff02c5539bcb-thumb.jpg", "needs_processing": true, "original_filename": "b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg", "processing_status": "copied_from_raw"}	2026-01-25 22:49:57.335-05	2026-01-25 22:49:57.335-05	2026-01-30 12:32:44.998-05	EPISODE	MAIN	{SCENE,THUMBNAIL}	f	b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg	image/jpeg	BG.MAIN	\N	2b7065de-f599-4c5b-95a7-61df8f91cffa	EPISODE	\N	\N	none	{}	\N	\N
30fce6c4-7033-4802-8b4c-21d9d95ccc50	6b803d45-e361-4055-bcac-f49a9865fd20.jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1769361576047-30fce6c4-7033-4802-8b4c-21d9d95ccc50.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769361576047-30fce6c4-7033-4802-8b4c-21d9d95ccc50.jpg	90682	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769361576047-30fce6c4-7033-4802-8b4c-21d9d95ccc50.jpg	\N	1024	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-25T17:19:36.423Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1769361576047-30fce6c4-7033-4802-8b4c-21d9d95ccc50-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1769361576047-30fce6c4-7033-4802-8b4c-21d9d95ccc50-thumb.jpg", "needs_processing": true, "original_filename": "6b803d45-e361-4055-bcac-f49a9865fd20.jpg", "processing_status": "copied_from_raw"}	2026-01-25 12:19:36.424-05	2026-01-25 12:19:36.424-05	2026-01-30 12:32:45.001-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	6b803d45-e361-4055-bcac-f49a9865fd20.jpg	image/jpeg	CHAR.HOST.LALA	\N	\N	GLOBAL	\N	\N	none	{}	\N	\N
7d8e6512-b579-4977-a6f0-ddeb0aff255a	e923d58c-31e2-472c-9be3-2f06c7ba5d39.jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1769361548562-7d8e6512-b579-4977-a6f0-ddeb0aff255a.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769361548562-7d8e6512-b579-4977-a6f0-ddeb0aff255a.jpg	85039	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769361548562-7d8e6512-b579-4977-a6f0-ddeb0aff255a.jpg	\N	1024	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-25T17:19:09.016Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1769361548562-7d8e6512-b579-4977-a6f0-ddeb0aff255a-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1769361548562-7d8e6512-b579-4977-a6f0-ddeb0aff255a-thumb.jpg", "needs_processing": true, "original_filename": "e923d58c-31e2-472c-9be3-2f06c7ba5d39.jpg", "processing_status": "copied_from_raw"}	2026-01-25 12:19:09.016-05	2026-01-25 12:19:09.016-05	2026-01-30 12:32:45.001-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	e923d58c-31e2-472c-9be3-2f06c7ba5d39.jpg	image/jpeg	CHAR.HOST.LALA	\N	\N	GLOBAL	\N	\N	none	{}	\N	\N
c0672f00-2b2c-4296-97b3-c4868c427b25	1ff6613a-830f-4513-aec3-a9b07ce752f5.jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1769361519217-c0672f00-2b2c-4296-97b3-c4868c427b25.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769361519217-c0672f00-2b2c-4296-97b3-c4868c427b25.jpg	81163	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769361519217-c0672f00-2b2c-4296-97b3-c4868c427b25.jpg	\N	1024	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-25T17:18:39.673Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1769361519217-c0672f00-2b2c-4296-97b3-c4868c427b25-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1769361519217-c0672f00-2b2c-4296-97b3-c4868c427b25-thumb.jpg", "needs_processing": true, "original_filename": "1ff6613a-830f-4513-aec3-a9b07ce752f5.jpg", "processing_status": "copied_from_raw"}	2026-01-25 12:18:39.673-05	2026-01-25 12:18:39.673-05	2026-01-30 12:32:45.002-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	1ff6613a-830f-4513-aec3-a9b07ce752f5.jpg	image/jpeg	CHAR.HOST.LALA	\N	\N	GLOBAL	\N	\N	none	{}	\N	\N
64df5053-e904-4819-947e-f861928f5d48	b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1769387193872-64df5053-e904-4819-947e-f861928f5d48.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769387193872-64df5053-e904-4819-947e-f861928f5d48.jpg	122833	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769387193872-64df5053-e904-4819-947e-f861928f5d48.jpg	\N	1536	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-26T00:26:34.550Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1769387193872-64df5053-e904-4819-947e-f861928f5d48-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1769387193872-64df5053-e904-4819-947e-f861928f5d48-thumb.jpg", "needs_processing": true, "original_filename": "b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg", "processing_status": "copied_from_raw"}	2026-01-25 19:26:34.551-05	2026-01-25 20:47:25.422-05	2026-01-30 12:32:45-05	EPISODE	MAIN	{THUMBNAIL,SOCIAL,UI}	t	b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg	image/jpeg	BG.MAIN	\N	\N	GLOBAL	\N	\N	none	{}	\N	\N
942f1645-3514-4096-95d2-46c608cc3be0	Blue Denim Jeans	CLOTHING_JUSTAWOMAN	APPROVED	\N	\N	\N	\N	\N	\N	\N	\N	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"size": "M", "tags": ["denim", "casual", "comfortable"], "brand": "Levi's", "color": "Blue", "price": "98.00", "scene": "Coffee Shop Scene", "reason": "Metadata-only record - no actual file uploaded yet", "season": "all-season", "website": "levis.com", "lastWorn": "2024-01-10", "occasion": "casual", "character": "justawoman", "episodeId": "7ed50b54-2eb3-425a-830a-6704648c4635", "marked_at": "2026-01-30T13:46:51.949681+00:00", "timesWorn": 4, "isFavorite": true, "file_status": "missing", "outfitNotes": "Perfect fit. Reliable go-to.", "outfitSetId": "set-002", "purchaseLink": "https://www.levis.com", "outfitSetName": "Casual Chic", "clothingCategory": "bottom", "previousEpisodes": ["ep-002", "ep-004"], "needs_file_upload": true, "plannedForEpisodes": [], "exclude_from_gallery": true}	2026-01-19 02:21:40.592683-05	2026-01-25 20:47:25.388-05	2026-01-30 12:32:45.004-05	WARDROBE	MAIN	{THUMBNAIL,SOCIAL,SCENE}	f	\N	\N	WARDROBE.CO_HOST.JUST_A_WOMAN	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	\N	SHOW	\N	\N	none	{}	\N	\N
5aebccf5-7abd-47c6-9c6f-37f63787356c	White Linen Shirt	CLOTHING_JUSTAWOMAN	APPROVED	\N	\N	\N	\N	\N	\N	\N	\N	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"size": "M", "tags": ["casual-chic", "classic", "easy"], "brand": "Everlane", "color": "White", "price": "78.00", "scene": "Coffee Shop Scene", "reason": "Metadata-only record - no actual file uploaded yet", "season": "spring", "website": "everlane.com", "lastWorn": "2024-01-10", "occasion": "casual", "character": "justawoman", "episodeId": "7ed50b54-2eb3-425a-830a-6704648c4635", "marked_at": "2026-01-30T13:46:51.949681+00:00", "timesWorn": 1, "isFavorite": true, "file_status": "missing", "outfitNotes": "Classic and clean. Keep crisp and pressed.", "outfitSetId": "set-002", "purchaseLink": "https://www.everlane.com", "outfitSetName": "Casual Chic", "clothingCategory": "top", "previousEpisodes": [], "needs_file_upload": true, "plannedForEpisodes": ["ep-012"], "exclude_from_gallery": true}	2026-01-19 02:21:40.59173-05	2026-01-25 20:47:25.361-05	2026-01-30 12:32:45.004-05	WARDROBE	MAIN	{THUMBNAIL,SOCIAL,SCENE}	f	\N	\N	WARDROBE.CO_HOST.JUST_A_WOMAN	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	\N	SHOW	\N	\N	none	{}	\N	\N
d55a4529-2991-4b39-88a8-d9faea4bd8a3	Black Leather Pants	CLOTHING_LALA	APPROVED	\N	\N	\N	\N	\N	\N	\N	\N	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"size": "S", "tags": ["versatile", "leather", "go-to"], "brand": "The Kooples", "color": "Black", "price": "495.00", "scene": "Opening Interview", "reason": "Metadata-only record - no actual file uploaded yet", "season": "all-season", "website": "thekooples.com", "lastWorn": "2024-01-15", "occasion": "casual", "character": "lala", "episodeId": "7ed50b54-2eb3-425a-830a-6704648c4635", "marked_at": "2026-01-30T13:46:51.949681+00:00", "timesWorn": 5, "isFavorite": true, "file_status": "missing", "outfitNotes": "Goes with everything. Ultra versatile.", "outfitSetId": "set-001", "purchaseLink": "https://www.thekooples.com", "outfitSetName": "Purple Power Look", "clothingCategory": "bottom", "previousEpisodes": ["ep-001", "ep-002", "ep-003"], "needs_file_upload": true, "plannedForEpisodes": ["ep-010"], "exclude_from_gallery": true}	2026-01-19 02:21:40.58985-05	2026-01-25 20:47:25.397-05	2026-01-30 12:32:45.005-05	WARDROBE	MAIN	{THUMBNAIL,SOCIAL,UI}	t	\N	\N	WARDROBE.HOST.PRIMARY	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	\N	SHOW	\N	\N	none	{}	\N	\N
365bf2e7-dab9-4e2f-95bf-af72a053ec20	b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1769361381887-365bf2e7-dab9-4e2f-95bf-af72a053ec20.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769361381887-365bf2e7-dab9-4e2f-95bf-af72a053ec20.jpg	122833	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769361381887-365bf2e7-dab9-4e2f-95bf-af72a053ec20.jpg	\N	1536	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-25T17:16:22.612Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1769361381887-365bf2e7-dab9-4e2f-95bf-af72a053ec20-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1769361381887-365bf2e7-dab9-4e2f-95bf-af72a053ec20-thumb.jpg", "deletion_reason": "duplicate", "needs_processing": true, "deleted_by_script": "fix-all-corrupted-assets.js", "original_filename": "b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg", "processing_status": "copied_from_raw", "deleted_at_timestamp": "2026-01-30T13:46:51.949681+00:00"}	2026-01-25 12:16:22.614-05	2026-01-25 12:16:22.614-05	2026-01-30 08:46:51.949681-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg	image/jpeg	CHAR.HOST.LALA	\N	\N	GLOBAL	\N	\N	none	{}	\N	\N
b9e98f46-a79a-4aff-8a37-e8ccf21e718a	77fcd54b-0cfb-427a-8b70-ad63e053402f.jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1769381444551-b9e98f46-a79a-4aff-8a37-e8ccf21e718a.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769381444551-b9e98f46-a79a-4aff-8a37-e8ccf21e718a.jpg	90562	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769381444551-b9e98f46-a79a-4aff-8a37-e8ccf21e718a.jpg	\N	1024	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-25T22:50:45.037Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1769381444551-b9e98f46-a79a-4aff-8a37-e8ccf21e718a-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1769381444551-b9e98f46-a79a-4aff-8a37-e8ccf21e718a-thumb.jpg", "deletion_reason": "duplicate", "needs_processing": true, "deleted_by_script": "fix-all-corrupted-assets.js", "original_filename": "77fcd54b-0cfb-427a-8b70-ad63e053402f.jpg", "processing_status": "copied_from_raw", "deleted_at_timestamp": "2026-01-30T13:46:51.949681+00:00"}	2026-01-25 17:50:45.037-05	2026-01-25 17:50:45.037-05	2026-01-30 08:46:51.949681-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	77fcd54b-0cfb-427a-8b70-ad63e053402f.jpg	image/jpeg	CHAR.HOST.LALA	\N	\N	GLOBAL	\N	\N	none	{}	\N	\N
098224b7-ac2c-420e-b194-6be1ee63a47c	b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1769381400307-098224b7-ac2c-420e-b194-6be1ee63a47c.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769381400307-098224b7-ac2c-420e-b194-6be1ee63a47c.jpg	122833	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769381400307-098224b7-ac2c-420e-b194-6be1ee63a47c.jpg	\N	1536	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-25T22:50:00.985Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1769381400307-098224b7-ac2c-420e-b194-6be1ee63a47c-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1769381400307-098224b7-ac2c-420e-b194-6be1ee63a47c-thumb.jpg", "deletion_reason": "duplicate", "needs_processing": true, "deleted_by_script": "fix-all-corrupted-assets.js", "original_filename": "b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg", "processing_status": "copied_from_raw", "deleted_at_timestamp": "2026-01-30T13:46:51.949681+00:00"}	2026-01-25 17:50:00.988-05	2026-01-25 17:50:00.988-05	2026-01-30 08:46:51.949681-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg	image/jpeg	CHAR.HOST.LALA	\N	\N	GLOBAL	\N	\N	none	{}	\N	\N
4862df7a-d095-4aa3-a129-ee71003820e6	b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1769383045212-4862df7a-d095-4aa3-a129-ee71003820e6.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769383045212-4862df7a-d095-4aa3-a129-ee71003820e6.jpg	122833	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769383045212-4862df7a-d095-4aa3-a129-ee71003820e6.jpg	\N	1536	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-25T23:17:25.847Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1769383045212-4862df7a-d095-4aa3-a129-ee71003820e6-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1769383045212-4862df7a-d095-4aa3-a129-ee71003820e6-thumb.jpg", "deletion_reason": "duplicate", "needs_processing": true, "deleted_by_script": "fix-all-corrupted-assets.js", "original_filename": "b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg", "processing_status": "copied_from_raw", "deleted_at_timestamp": "2026-01-30T13:46:51.949681+00:00"}	2026-01-25 18:17:25.849-05	2026-01-25 18:17:25.849-05	2026-01-30 08:46:51.949681-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg	image/jpeg	\N	\N	\N	GLOBAL	\N	\N	none	{}	\N	\N
a64890f7-36f9-4a7c-8334-3e0212e1806d	b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg	BACKGROUND_IMAGE	APPROVED	backgrounds/images/1769387563033-a64890f7-36f9-4a7c-8334-3e0212e1806d.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/backgrounds/images/1769387563033-a64890f7-36f9-4a7c-8334-3e0212e1806d.jpg	122833	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/backgrounds/images/1769387563033-a64890f7-36f9-4a7c-8334-3e0212e1806d.jpg	\N	1536	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-26T00:32:43.429Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "backgrounds/images/thumbnails/1769387563033-a64890f7-36f9-4a7c-8334-3e0212e1806d-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/backgrounds/images/thumbnails/1769387563033-a64890f7-36f9-4a7c-8334-3e0212e1806d-thumb.jpg", "deletion_reason": "duplicate", "needs_processing": true, "deleted_by_script": "fix-all-corrupted-assets.js", "original_filename": "b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg", "processing_status": "copied_from_raw", "deleted_at_timestamp": "2026-01-30T13:46:51.949681+00:00"}	2026-01-25 19:32:43.43-05	2026-01-25 19:32:43.43-05	2026-01-30 08:46:51.949681-05	EPISODE	MAIN	{SCENE,THUMBNAIL}	f	b45710f8-b863-45ca-a7fe-4c7441bcd9b0.jpg	image/jpeg	BG.MAIN	\N	\N	GLOBAL	\N	\N	none	{}	\N	\N
32ebf875-7587-4612-86c8-3f5f1f36ae19	518281709_10238842252621649_7803248841376928855_n (1).jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1769381465792-32ebf875-7587-4612-86c8-3f5f1f36ae19.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769381465792-32ebf875-7587-4612-86c8-3f5f1f36ae19.jpg	702704	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769381465792-32ebf875-7587-4612-86c8-3f5f1f36ae19.jpg	\N	1536	2048	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-25T22:51:07.118Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1769381465792-32ebf875-7587-4612-86c8-3f5f1f36ae19-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1769381465792-32ebf875-7587-4612-86c8-3f5f1f36ae19-thumb.jpg", "deletion_reason": "duplicate", "needs_processing": true, "deleted_by_script": "fix-all-corrupted-assets.js", "original_filename": "518281709_10238842252621649_7803248841376928855_n (1).jpg", "processing_status": "copied_from_raw", "deleted_at_timestamp": "2026-01-30T13:46:51.949681+00:00"}	2026-01-25 17:51:07.118-05	2026-01-25 20:47:25.417-05	2026-01-30 08:46:51.949681-05	EPISODE	MAIN	{THUMBNAIL,SOCIAL,UI}	t	518281709_10238842252621649_7803248841376928855_n (1).jpg	image/jpeg	BG.MAIN	\N	\N	GLOBAL	\N	\N	none	{}	\N	\N
cedcb952-f763-47f4-be19-ec8f13fa16f2	1ff6613a-830f-4513-aec3-a9b07ce752f5.jpg	BRAND_LOGO	APPROVED	promotional/brands/1769387675763-cedcb952-f763-47f4-be19-ec8f13fa16f2.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/brands/1769387675763-cedcb952-f763-47f4-be19-ec8f13fa16f2.jpg	81163	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/brands/1769387675763-cedcb952-f763-47f4-be19-ec8f13fa16f2.jpg	\N	1024	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-26T00:34:36.150Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/brands/thumbnails/1769387675763-cedcb952-f763-47f4-be19-ec8f13fa16f2-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/brands/thumbnails/1769387675763-cedcb952-f763-47f4-be19-ec8f13fa16f2-thumb.jpg", "deletion_reason": "duplicate", "needs_processing": true, "deleted_by_script": "fix-all-corrupted-assets.js", "original_filename": "1ff6613a-830f-4513-aec3-a9b07ce752f5.jpg", "processing_status": "copied_from_raw", "deleted_at_timestamp": "2026-01-30T13:46:51.949681+00:00"}	2026-01-25 19:34:36.151-05	2026-01-25 20:47:25.426-05	2026-01-30 08:46:51.949681-05	SHOW	ICON	{UI,SOCIAL,SCENE}	t	1ff6613a-830f-4513-aec3-a9b07ce752f5.jpg	image/jpeg	UI.ICON.JEWELRY_BOX	\N	\N	GLOBAL	\N	\N	none	{}	\N	\N
b29219aa-2727-41ea-abcb-dba185d1264b	518281709_10238842252621649_7803248841376928855_n.jpg	PROMO_GUEST	APPROVED	promotional/guests/raw/1769392455473-b29219aa-2727-41ea-abcb-dba185d1264b.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/guests/raw/1769392455473-b29219aa-2727-41ea-abcb-dba185d1264b.jpg	702704	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/guests/raw/1769392455473-b29219aa-2727-41ea-abcb-dba185d1264b.jpg	\N	1536	2048	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-26T01:54:16.884Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/guests/raw/thumbnails/1769392455473-b29219aa-2727-41ea-abcb-dba185d1264b-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/guests/raw/thumbnails/1769392455473-b29219aa-2727-41ea-abcb-dba185d1264b-thumb.jpg", "deletion_reason": "duplicate", "needs_processing": true, "deleted_by_script": "fix-all-corrupted-assets.js", "original_filename": "518281709_10238842252621649_7803248841376928855_n.jpg", "processing_status": "copied_from_raw", "deleted_at_timestamp": "2026-01-30T13:46:51.949681+00:00"}	2026-01-25 20:54:16.884-05	2026-01-25 20:54:16.884-05	2026-01-30 08:46:51.949681-05	GUEST	MAIN	{THUMBNAIL,SCENE}	f	518281709_10238842252621649_7803248841376928855_n.jpg	image/jpeg	CHAR.GUEST.1	\N	2b7065de-f599-4c5b-95a7-61df8f91cffa	EPISODE	\N	\N	none	{}	\N	\N
30463b9e-16c8-4ee1-9b6e-205f86d50964	518281709_10238842252621649_7803248841376928855_n (1).jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1768979812548-30463b9e-16c8-4ee1-9b6e-205f86d50964.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1768979812548-30463b9e-16c8-4ee1-9b6e-205f86d50964.jpg	702704	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1768979812548-30463b9e-16c8-4ee1-9b6e-205f86d50964.jpg	\N	1536	2048	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"tags": [], "fixed_at": "2026-01-30T13:46:51.949681+00:00", "character": "lala", "uploaded_at": "2026-01-21T07:16:54.040Z", "uploaded_by": "system", "content_type": "image/jpeg", "mainCategory": "LALA", "thumbnail_key": "promotional/lala/raw/thumbnails/1768979812548-30463b9e-16c8-4ee1-9b6e-205f86d50964-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1768979812548-30463b9e-16c8-4ee1-9b6e-205f86d50964-thumb.jpg", "deletion_reason": "duplicate", "needs_processing": true, "previousEpisodes": [], "deleted_by_script": "fix-all-corrupted-assets.js", "original_filename": "518281709_10238842252621649_7803248841376928855_n (1).jpg", "processing_status": "copied_from_raw", "plannedForEpisodes": [], "deleted_at_timestamp": "2026-01-30T13:46:51.949681+00:00"}	2026-01-21 02:16:54.042-05	2026-01-26 13:45:22.645-05	2026-01-30 08:46:51.949681-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	\N	\N	CHAR.HOST.LALA	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	\N	SHOW	\N	\N	none	{}	\N	\N
18f034a5-b62c-4102-84ab-87d333191d23	77fcd54b-0cfb-427a-8b70-ad63e053402f.jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1769726049122-18f034a5-b62c-4102-84ab-87d333191d23.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769726049122-18f034a5-b62c-4102-84ab-87d333191d23.jpg	90562	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769726049122-18f034a5-b62c-4102-84ab-87d333191d23.jpg	\N	1024	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "51299ab6-1f9a-41af-951e-cd76cd9272a6", "uploaded_at": "2026-01-29T22:34:09.652Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1769726049122-18f034a5-b62c-4102-84ab-87d333191d23-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1769726049122-18f034a5-b62c-4102-84ab-87d333191d23-thumb.jpg", "deletion_reason": "duplicate", "needs_processing": true, "deleted_by_script": "fix-all-corrupted-assets.js", "original_filename": "77fcd54b-0cfb-427a-8b70-ad63e053402f.jpg", "processing_status": "copied_from_raw", "deleted_at_timestamp": "2026-01-30T13:46:51.949681+00:00"}	2026-01-29 17:34:09.653-05	2026-01-29 17:34:09.653-05	2026-01-30 08:46:51.949681-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	77fcd54b-0cfb-427a-8b70-ad63e053402f.jpg	image/jpeg	CHAR.HOST.LALA	\N	51299ab6-1f9a-41af-951e-cd76cd9272a6	GLOBAL	\N	\N	none	{}	\N	\N
22ab4fde-8cbc-4e17-89d4-dea76622ab5a	1ff6613a-830f-4513-aec3-a9b07ce752f5.jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1769361463586-22ab4fde-8cbc-4e17-89d4-dea76622ab5a.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769361463586-22ab4fde-8cbc-4e17-89d4-dea76622ab5a.jpg	81163	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769361463586-22ab4fde-8cbc-4e17-89d4-dea76622ab5a.jpg	\N	1024	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-25T17:17:44.067Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1769361463586-22ab4fde-8cbc-4e17-89d4-dea76622ab5a-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1769361463586-22ab4fde-8cbc-4e17-89d4-dea76622ab5a-thumb.jpg", "deletion_reason": "duplicate", "needs_processing": true, "deleted_by_script": "fix-all-corrupted-assets.js", "original_filename": "1ff6613a-830f-4513-aec3-a9b07ce752f5.jpg", "processing_status": "copied_from_raw", "deleted_at_timestamp": "2026-01-30T13:46:51.949681+00:00"}	2026-01-25 12:17:44.068-05	2026-01-25 12:17:44.068-05	2026-01-30 08:46:51.949681-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	1ff6613a-830f-4513-aec3-a9b07ce752f5.jpg	image/jpeg	CHAR.HOST.LALA	\N	\N	GLOBAL	\N	\N	none	{}	\N	\N
a61cda6c-05cb-4663-b528-3b0b9d2d8763	77fcd54b-0cfb-427a-8b70-ad63e053402f.jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1769361596512-a61cda6c-05cb-4663-b528-3b0b9d2d8763.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769361596512-a61cda6c-05cb-4663-b528-3b0b9d2d8763.jpg	90562	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769361596512-a61cda6c-05cb-4663-b528-3b0b9d2d8763.jpg	\N	1024	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-25T17:19:57.624Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1769361596512-a61cda6c-05cb-4663-b528-3b0b9d2d8763-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1769361596512-a61cda6c-05cb-4663-b528-3b0b9d2d8763-thumb.jpg", "deletion_reason": "duplicate", "needs_processing": true, "deleted_by_script": "fix-all-corrupted-assets.js", "original_filename": "77fcd54b-0cfb-427a-8b70-ad63e053402f.jpg", "processing_status": "copied_from_raw", "deleted_at_timestamp": "2026-01-30T13:46:51.949681+00:00"}	2026-01-25 12:19:57.624-05	2026-01-25 12:19:57.624-05	2026-01-30 08:46:51.949681-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	77fcd54b-0cfb-427a-8b70-ad63e053402f.jpg	image/jpeg	CHAR.HOST.LALA	\N	\N	GLOBAL	\N	\N	none	{}	\N	\N
49d5d73f-7391-4ba3-b46b-c84717be6112	bfb6252b-71a6-4b53-afc7-282bc7c745cb.jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1769361627045-49d5d73f-7391-4ba3-b46b-c84717be6112.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769361627045-49d5d73f-7391-4ba3-b46b-c84717be6112.jpg	260245	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769361627045-49d5d73f-7391-4ba3-b46b-c84717be6112.jpg	\N	1792	1024	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-25T17:20:27.787Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1769361627045-49d5d73f-7391-4ba3-b46b-c84717be6112-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1769361627045-49d5d73f-7391-4ba3-b46b-c84717be6112-thumb.jpg", "deletion_reason": "duplicate", "needs_processing": true, "deleted_by_script": "fix-all-corrupted-assets.js", "original_filename": "bfb6252b-71a6-4b53-afc7-282bc7c745cb.jpg", "processing_status": "copied_from_raw", "deleted_at_timestamp": "2026-01-30T13:46:51.949681+00:00"}	2026-01-25 12:20:27.787-05	2026-01-25 12:20:27.787-05	2026-01-30 08:46:51.949681-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	bfb6252b-71a6-4b53-afc7-282bc7c745cb.jpg	image/jpeg	CHAR.HOST.LALA	\N	\N	GLOBAL	\N	\N	none	{}	\N	\N
8f745a57-a5b5-42aa-ae51-4d4fd3bcbcbc	518281709_10238842252621649_7803248841376928855_n (1).jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1769361827748-8f745a57-a5b5-42aa-ae51-4d4fd3bcbcbc.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769361827748-8f745a57-a5b5-42aa-ae51-4d4fd3bcbcbc.jpg	702704	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769361827748-8f745a57-a5b5-42aa-ae51-4d4fd3bcbcbc.jpg	\N	1536	2048	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-25T17:23:49.122Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1769361827748-8f745a57-a5b5-42aa-ae51-4d4fd3bcbcbc-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1769361827748-8f745a57-a5b5-42aa-ae51-4d4fd3bcbcbc-thumb.jpg", "deletion_reason": "duplicate", "needs_processing": true, "deleted_by_script": "fix-all-corrupted-assets.js", "original_filename": "518281709_10238842252621649_7803248841376928855_n (1).jpg", "processing_status": "copied_from_raw", "deleted_at_timestamp": "2026-01-30T13:46:51.949681+00:00"}	2026-01-25 12:23:49.123-05	2026-01-25 12:23:49.123-05	2026-01-30 08:46:51.949681-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	518281709_10238842252621649_7803248841376928855_n (1).jpg	image/jpeg	CHAR.HOST.LALA	\N	\N	GLOBAL	\N	\N	none	{}	\N	\N
4c5b28c5-d014-4f1b-9ea1-14b9baaf2eab	518281709_10238842252621649_7803248841376928855_n (1).jpg	PROMO_LALA	APPROVED	promotional/lala/raw/1769361859069-4c5b28c5-d014-4f1b-9ea1-14b9baaf2eab.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769361859069-4c5b28c5-d014-4f1b-9ea1-14b9baaf2eab.jpg	702704	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1769361859069-4c5b28c5-d014-4f1b-9ea1-14b9baaf2eab.jpg	\N	1536	2048	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "uploaded_at": "2026-01-25T17:24:19.927Z", "uploaded_by": "dev-user", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1769361859069-4c5b28c5-d014-4f1b-9ea1-14b9baaf2eab-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1769361859069-4c5b28c5-d014-4f1b-9ea1-14b9baaf2eab-thumb.jpg", "deletion_reason": "duplicate", "needs_processing": true, "deleted_by_script": "fix-all-corrupted-assets.js", "original_filename": "518281709_10238842252621649_7803248841376928855_n (1).jpg", "processing_status": "copied_from_raw", "deleted_at_timestamp": "2026-01-30T13:46:51.949681+00:00"}	2026-01-25 12:24:19.927-05	2026-01-25 12:24:19.927-05	2026-01-30 08:46:51.949681-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	518281709_10238842252621649_7803248841376928855_n (1).jpg	image/jpeg	CHAR.HOST.LALA	\N	\N	GLOBAL	\N	\N	none	{}	\N	\N
b6473b61-f326-4993-8245-0c11d3a292d9	blah	EPISODE_FRAME	APPROVED	thumbnails/auto/1769011547870-b6473b61-f326-4993-8245-0c11d3a292d9.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/thumbnails/auto/1769011547870-b6473b61-f326-4993-8245-0c11d3a292d9.jpg	702704	\N	https://episode-metadata-storage-dev.s3.us-east-1.amazonaws.com/thumbnails/auto/1769011547870-b6473b61-f326-4993-8245-0c11d3a292d9_processed.png	\N	1536	2048	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"episodeId": "51299ab6-1f9a-41af-951e-cd76cd9272a6", "uploaded_at": "2026-01-21T16:05:49.279Z", "uploaded_by": "system", "content_type": "image/jpeg", "thumbnail_key": "thumbnails/auto/thumbnails/1769011547870-b6473b61-f326-4993-8245-0c11d3a292d9-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/thumbnails/auto/thumbnails/1769011547870-b6473b61-f326-4993-8245-0c11d3a292d9-thumb.jpg", "original_filename": "518281709_10238842252621649_7803248841376928855_n.jpg"}	2026-01-21 11:05:49.281-05	2026-01-21 11:21:30.549-05	2026-01-30 12:32:45.003-05	EPISODE	MAIN	{THUMBNAIL,SOCIAL}	f	1769011547870-b6473b61-f326-4993-8245-0c11d3a292d9.jpg	image/jpeg	BG.EPISODE.FRAME	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	\N	EPISODE	\N	\N	none	{}	\N	\N
ca89b03b-f5bc-4203-9db8-4ce490b98ab0	test_upload_video.mp4	BACKGROUND_VIDEO	APPROVED	backgrounds/videos/1769011285424-ca89b03b-f5bc-4203-9db8-4ce490b98ab0.mp4	https://episode-metadata-storage-dev.s3.amazonaws.com/backgrounds/videos/1769011285424-ca89b03b-f5bc-4203-9db8-4ce490b98ab0.mp4	18643	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/backgrounds/videos/1769011285424-ca89b03b-f5bc-4203-9db8-4ce490b98ab0.mp4	\N	\N	\N	video	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "51299ab6-1f9a-41af-951e-cd76cd9272a6", "uploaded_at": "2026-01-21T16:01:25.580Z", "uploaded_by": "system", "content_type": "video/mp4", "thumbnail_key": null, "thumbnail_url": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22150%22%20height%3D%22150%22%3E%3Crect%20fill%3D%22%23e0e0e0%22%20width%3D%22150%22%20height%3D%22150%22%2F%3E%3Ctext%20x%3D%2275%22%20y%3D%2275%22%20text-anchor%3D%22middle%22%20fill%3D%22%23999%22%20font-size%3D%2214%22%20dy%3D%22.3em%22%20dominant-baseline%3D%22middle%22%3E%F0%9F%93%A6%3C%2Ftext%3E%3C%2Fsvg%3E", "needs_processing": true, "original_filename": "test_upload_video.mp4", "processing_status": "copied_from_raw"}	2026-01-21 11:01:25.581-05	2026-01-21 11:01:25.581-05	2026-01-30 12:32:45.003-05	EPISODE	BACKGROUND	{SCENE,BACKGROUND_PLATE}	f	1769011285424-ca89b03b-f5bc-4203-9db8-4ce490b98ab0.mp4	video/mp4	BG.MAIN	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	\N	GLOBAL	\N	\N	none	{}	\N	\N
c10d86b6-a7b1-4701-8e5c-8bdd67a8dfa5	blah blah	PROMO_GUEST	APPROVED	promotional/guests/raw/1769001447437-c10d86b6-a7b1-4701-8e5c-8bdd67a8dfa5.mp4	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/guests/raw/1769001447437-c10d86b6-a7b1-4701-8e5c-8bdd67a8dfa5.mp4	18643	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/guests/raw/1769001447437-c10d86b6-a7b1-4701-8e5c-8bdd67a8dfa5.mp4	\N	\N	\N	video	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "51299ab6-1f9a-41af-951e-cd76cd9272a6", "uploaded_at": "2026-01-21T13:17:27.953Z", "uploaded_by": "system", "content_type": "video/mp4", "thumbnail_key": null, "thumbnail_url": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22150%22%20height%3D%22150%22%3E%3Crect%20fill%3D%22%23e0e0e0%22%20width%3D%22150%22%20height%3D%22150%22%2F%3E%3Ctext%20x%3D%2275%22%20y%3D%2275%22%20text-anchor%3D%22middle%22%20fill%3D%22%23999%22%20font-size%3D%2214%22%20dy%3D%22.3em%22%20dominant-baseline%3D%22middle%22%3E%F0%9F%93%A6%3C%2Ftext%3E%3C%2Fsvg%3E", "needs_processing": true, "original_filename": "test_upload_video.mp4", "processing_status": "copied_from_raw"}	2026-01-21 08:17:27.954-05	2026-01-21 09:03:24.656-05	2026-01-30 12:32:45.003-05	GUEST	MAIN	{THUMBNAIL,SCENE}	f	1769001447437-c10d86b6-a7b1-4701-8e5c-8bdd67a8dfa5.mp4	video/mp4	CHAR.GUEST	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	\N	SHOW	\N	\N	none	{}	\N	\N
9fb56c1b-3649-42e4-9daf-3e561cb56ec4	test_upload_video.mp4	PROMO_LALA	APPROVED	promotional/lala/raw/1768999111843-9fb56c1b-3649-42e4-9daf-3e561cb56ec4.mp4	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1768999111843-9fb56c1b-3649-42e4-9daf-3e561cb56ec4.mp4	18643	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1768999111843-9fb56c1b-3649-42e4-9daf-3e561cb56ec4.mp4	\N	\N	\N	video	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "51299ab6-1f9a-41af-951e-cd76cd9272a6", "uploaded_at": "2026-01-21T12:38:32.255Z", "uploaded_by": "system", "content_type": "video/mp4", "thumbnail_key": null, "thumbnail_url": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22150%22%20height%3D%22150%22%3E%3Crect%20fill%3D%22%23e0e0e0%22%20width%3D%22150%22%20height%3D%22150%22%2F%3E%3Ctext%20x%3D%2275%22%20y%3D%2275%22%20text-anchor%3D%22middle%22%20fill%3D%22%23999%22%20font-size%3D%2214%22%20dy%3D%22.3em%22%20dominant-baseline%3D%22middle%22%3E%F0%9F%93%A6%3C%2Ftext%3E%3C%2Fsvg%3E", "needs_processing": true, "original_filename": "test_upload_video.mp4", "processing_status": "copied_from_raw"}	2026-01-21 07:38:32.258-05	2026-01-26 13:45:22.645-05	2026-01-30 12:32:45.003-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	1768999111843-9fb56c1b-3649-42e4-9daf-3e561cb56ec4.mp4	video/mp4	CHAR.HOST.LALA	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	\N	SHOW	\N	\N	none	{}	\N	\N
3c31e094-bbae-4c34-b948-d16ca5a584d4	this is it!	PROMO_LALA	APPROVED	promotional/lala/raw/1768980485952-3c31e094-bbae-4c34-b948-d16ca5a584d4.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1768980485952-3c31e094-bbae-4c34-b948-d16ca5a584d4.jpg	702704	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/1768980485952-3c31e094-bbae-4c34-b948-d16ca5a584d4.jpg	\N	1536	2048	image	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"fixed_at": "2026-01-30T13:46:51.949681+00:00", "episodeId": "51299ab6-1f9a-41af-951e-cd76cd9272a6", "uploaded_at": "2026-01-21T07:28:08.034Z", "uploaded_by": "system", "content_type": "image/jpeg", "thumbnail_key": "promotional/lala/raw/thumbnails/1768980485952-3c31e094-bbae-4c34-b948-d16ca5a584d4-thumb.jpg", "thumbnail_url": "https://episode-metadata-storage-dev.s3.amazonaws.com/promotional/lala/raw/thumbnails/1768980485952-3c31e094-bbae-4c34-b948-d16ca5a584d4-thumb.jpg", "needs_processing": true, "original_filename": "518281709_10238842252621649_7803248841376928855_n (1).jpg", "processing_status": "copied_from_raw"}	2026-01-21 02:28:08.035-05	2026-01-26 13:45:22.645-05	2026-01-30 12:32:45.004-05	LALA	MAIN	{THUMBNAIL,SOCIAL,UI}	t	1768980485952-3c31e094-bbae-4c34-b948-d16ca5a584d4.jpg	image/jpeg	CHAR.HOST.LALA	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	\N	SHOW	\N	\N	none	{}	\N	\N
\.


--
-- Data for Name: composition_assets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.composition_assets (id, composition_id, asset_id, asset_role, role_category, role_name, role_variant, layer_order, transform, created_at, updated_at, deleted_at) FROM stdin;
ab3007ca-a850-4e99-b071-7f3fdafc1c4e	74e52b78-11ff-470a-8a16-c45400e07a36	3be68abb-8a1b-4d44-8a4f-4a7c53ab7708	CHAR.HOST.LALA	\N	\N	\N	0	{}	2026-01-27 14:10:19.3	2026-01-27 14:10:19.3	\N
f9f3e35d-1512-4507-886e-c5966d38a9cf	74e52b78-11ff-470a-8a16-c45400e07a36	0db17cae-7f1c-4a24-b5e3-e8a73b7d1c2a	CHAR.HOST.JUSTAWOMANINHERPRIME	\N	\N	\N	0	{}	2026-01-27 14:10:19.3	2026-01-27 14:10:19.3	\N
c693c7bd-6588-4ef5-acbe-3f6fe75368af	74e52b78-11ff-470a-8a16-c45400e07a36	587984ad-7c19-4adf-9957-ff02c5539bcb	BG.MAIN	\N	\N	\N	0	{}	2026-01-27 14:10:19.3	2026-01-27 14:10:19.3	\N
1ee349cb-2f29-44d5-9576-a0ea4d65e630	4a33f3b6-0cd4-43c4-9d85-0b758c67f045	3be68abb-8a1b-4d44-8a4f-4a7c53ab7708	CHAR.HOST.LALA	\N	\N	\N	0	{}	2026-01-27 14:16:49.368	2026-01-27 14:16:49.368	\N
754b6341-f864-4d72-9d5a-ede6c80b2cb0	4a33f3b6-0cd4-43c4-9d85-0b758c67f045	0db17cae-7f1c-4a24-b5e3-e8a73b7d1c2a	CHAR.HOST.JUSTAWOMANINHERPRIME	\N	\N	\N	0	{}	2026-01-27 14:16:49.368	2026-01-27 14:16:49.368	\N
56f9caf7-820f-4cc2-b0fa-c453aa3c29ed	4a33f3b6-0cd4-43c4-9d85-0b758c67f045	587984ad-7c19-4adf-9957-ff02c5539bcb	BG.MAIN	\N	\N	\N	0	{}	2026-01-27 14:16:49.368	2026-01-27 14:16:49.368	\N
2fbe00a4-0774-4ac9-8b8b-20e9796fa5e8	e695a531-da39-4697-976d-00af6511728f	3be68abb-8a1b-4d44-8a4f-4a7c53ab7708	CHAR.HOST.LALA	\N	\N	\N	0	{}	2026-01-27 14:29:54.182	2026-01-27 14:29:54.182	\N
4f13b014-741e-428d-bf45-9b6200724249	e695a531-da39-4697-976d-00af6511728f	0db17cae-7f1c-4a24-b5e3-e8a73b7d1c2a	CHAR.HOST.JUSTAWOMANINHERPRIME	\N	\N	\N	0	{}	2026-01-27 14:29:54.182	2026-01-27 14:29:54.182	\N
20d79cb5-2e44-40c5-a3e0-93758c589770	e695a531-da39-4697-976d-00af6511728f	587984ad-7c19-4adf-9957-ff02c5539bcb	BG.MAIN	\N	\N	\N	0	{}	2026-01-27 14:29:54.182	2026-01-27 14:29:54.182	\N
61efd17a-4e9f-4aed-b85e-12166b354779	e71991a1-e9ca-49c9-80f8-35fcb1387800	3be68abb-8a1b-4d44-8a4f-4a7c53ab7708	CHAR.HOST.LALA	\N	\N	\N	0	{}	2026-01-27 14:32:20.127	2026-01-27 14:32:20.127	\N
cf76486d-a23b-4bfb-a8c0-6ca96401611e	e71991a1-e9ca-49c9-80f8-35fcb1387800	0db17cae-7f1c-4a24-b5e3-e8a73b7d1c2a	CHAR.HOST.JUSTAWOMANINHERPRIME	\N	\N	\N	0	{}	2026-01-27 14:32:20.127	2026-01-27 14:32:20.127	\N
6840e4ad-9ab7-4fc9-a231-43d7e408428f	e71991a1-e9ca-49c9-80f8-35fcb1387800	587984ad-7c19-4adf-9957-ff02c5539bcb	BG.MAIN	\N	\N	\N	0	{}	2026-01-27 14:32:20.127	2026-01-27 14:32:20.127	\N
5bcf8ddf-4bdc-475e-a301-3cc8dd0338e4	1ef9f5ba-a6b8-4d00-ac8a-c33a3662896b	3be68abb-8a1b-4d44-8a4f-4a7c53ab7708	CHAR.HOST.LALA	\N	\N	\N	0	{}	2026-01-27 14:37:31.502	2026-01-27 14:37:31.502	\N
c32b7923-ea99-4505-9c97-82c8975ef63b	1ef9f5ba-a6b8-4d00-ac8a-c33a3662896b	0db17cae-7f1c-4a24-b5e3-e8a73b7d1c2a	CHAR.HOST.JUSTAWOMANINHERPRIME	\N	\N	\N	0	{}	2026-01-27 14:37:31.502	2026-01-27 14:37:31.502	\N
7083c465-03ef-42bc-97b9-26057c8fed9b	1ef9f5ba-a6b8-4d00-ac8a-c33a3662896b	587984ad-7c19-4adf-9957-ff02c5539bcb	BG.MAIN	\N	\N	\N	0	{}	2026-01-27 14:37:31.502	2026-01-27 14:37:31.502	\N
cf21dbef-4231-473f-8961-1a7de4ccb3c2	70ef4f42-6935-4961-a6f5-055cfbda9bbb	3be68abb-8a1b-4d44-8a4f-4a7c53ab7708	CHAR.HOST.LALA	\N	\N	\N	0	{}	2026-01-27 14:37:45.061	2026-01-27 14:37:45.061	\N
4ad45f40-cf36-4ca7-b277-18897b668d96	70ef4f42-6935-4961-a6f5-055cfbda9bbb	0db17cae-7f1c-4a24-b5e3-e8a73b7d1c2a	CHAR.HOST.JUSTAWOMANINHERPRIME	\N	\N	\N	0	{}	2026-01-27 14:37:45.061	2026-01-27 14:37:45.061	\N
21f29027-1dfa-4b23-898c-e39766c4cdf6	70ef4f42-6935-4961-a6f5-055cfbda9bbb	587984ad-7c19-4adf-9957-ff02c5539bcb	BG.MAIN	\N	\N	\N	0	{}	2026-01-27 14:37:45.061	2026-01-27 14:37:45.061	\N
65efb372-7eb2-4226-aa6a-444669a4d2e5	e3afb0ea-08a9-4f67-9376-98610c2a9745	3be68abb-8a1b-4d44-8a4f-4a7c53ab7708	CHAR.HOST.LALA	\N	\N	\N	0	{}	2026-01-27 14:38:21.602	2026-01-27 14:38:21.602	\N
4de09fae-455c-4849-8ecc-91a077e70de3	e3afb0ea-08a9-4f67-9376-98610c2a9745	0db17cae-7f1c-4a24-b5e3-e8a73b7d1c2a	CHAR.HOST.JUSTAWOMANINHERPRIME	\N	\N	\N	0	{}	2026-01-27 14:38:21.602	2026-01-27 14:38:21.602	\N
a292f223-c63f-4fbf-a3bf-5228ca217ce9	e3afb0ea-08a9-4f67-9376-98610c2a9745	587984ad-7c19-4adf-9957-ff02c5539bcb	BG.MAIN	\N	\N	\N	0	{}	2026-01-27 14:38:21.602	2026-01-27 14:38:21.602	\N
44deab69-b625-4021-9ad8-6a5bdc58a613	cadf01a8-afe9-473b-b813-0962bfc9064b	3be68abb-8a1b-4d44-8a4f-4a7c53ab7708	CHAR.HOST.LALA	\N	\N	\N	0	{}	2026-01-27 14:41:13.6	2026-01-27 14:41:13.6	\N
12eb4c68-4a73-4517-9121-59fd4aac15bd	cadf01a8-afe9-473b-b813-0962bfc9064b	0db17cae-7f1c-4a24-b5e3-e8a73b7d1c2a	CHAR.HOST.JUSTAWOMANINHERPRIME	\N	\N	\N	0	{}	2026-01-27 14:41:13.6	2026-01-27 14:41:13.6	\N
9d2e343f-76a3-4c2f-9cdd-2faddcd42434	cadf01a8-afe9-473b-b813-0962bfc9064b	587984ad-7c19-4adf-9957-ff02c5539bcb	BG.MAIN	\N	\N	\N	0	{}	2026-01-27 14:41:13.6	2026-01-27 14:41:13.6	\N
5100ac09-47c7-40d9-81d0-cc3e259f6062	9cfcc3c8-9183-4511-a276-a266de18c406	3be68abb-8a1b-4d44-8a4f-4a7c53ab7708	CHAR.HOST.LALA	\N	\N	\N	0	{}	2026-01-27 16:10:14.201	2026-01-27 16:10:14.201	\N
274c6580-0972-49ee-ae19-6917aebde3cc	9cfcc3c8-9183-4511-a276-a266de18c406	0db17cae-7f1c-4a24-b5e3-e8a73b7d1c2a	CHAR.HOST.JUSTAWOMANINHERPRIME	\N	\N	\N	0	{}	2026-01-27 16:10:14.201	2026-01-27 16:10:14.201	\N
afb6edd1-3ef2-4321-ae3d-fb4fa896d380	9cfcc3c8-9183-4511-a276-a266de18c406	587984ad-7c19-4adf-9957-ff02c5539bcb	BG.MAIN	\N	\N	\N	0	{}	2026-01-27 16:10:14.201	2026-01-27 16:10:14.201	\N
4784e6f9-d111-4a1f-8fad-e9ba9df52c54	f0b20fff-2c73-43cc-bf8e-c30e2dd06500	3be68abb-8a1b-4d44-8a4f-4a7c53ab7708	CHAR.HOST.LALA	\N	\N	\N	0	{}	2026-01-27 17:07:01.518	2026-01-27 17:07:01.518	\N
2bdb423e-745c-47b7-9a15-3fe916db0775	f0b20fff-2c73-43cc-bf8e-c30e2dd06500	0db17cae-7f1c-4a24-b5e3-e8a73b7d1c2a	CHAR.HOST.JUSTAWOMANINHERPRIME	\N	\N	\N	0	{}	2026-01-27 17:07:01.518	2026-01-27 17:07:01.518	\N
5c10cf52-c55e-42c1-8d0d-762aa704eb73	f0b20fff-2c73-43cc-bf8e-c30e2dd06500	587984ad-7c19-4adf-9957-ff02c5539bcb	BG.MAIN	\N	\N	\N	0	{}	2026-01-27 17:07:01.518	2026-01-27 17:07:01.518	\N
2e4aa919-7bbe-4821-b6e6-43fb2ecb7ff3	f0b20fff-2c73-43cc-bf8e-c30e2dd06500	b29219aa-2727-41ea-abcb-dba185d1264b	CHAR.GUEST.1	\N	\N	\N	0	{}	2026-01-27 21:33:41.234	2026-01-27 21:33:41.234	\N
04cfbcf7-5d3a-4ad0-8451-526546bb3aa7	f0b20fff-2c73-43cc-bf8e-c30e2dd06500	3083ff68-fd92-45bc-b208-6f4ecb5d4c31	BRAND.SHOW.TITLE_GRAPHIC	\N	\N	\N	0	{}	2026-01-27 21:33:41.263	2026-01-27 21:33:41.263	\N
178f26f9-c0d9-48ce-bb2f-dea018f40df1	db0988b8-6f6c-44ec-8555-a59a80e9c48a	0db17cae-7f1c-4a24-b5e3-e8a73b7d1c2a	CHAR.HOST.JUSTAWOMANINHERPRIME	\N	\N	\N	0	{}	2026-01-28 11:58:53.662	2026-01-28 11:58:53.662	\N
78386da9-c85d-4f2b-a137-6fe8847698e9	db0988b8-6f6c-44ec-8555-a59a80e9c48a	587984ad-7c19-4adf-9957-ff02c5539bcb	BG.MAIN	\N	\N	\N	0	{}	2026-01-28 12:11:20.651	2026-01-28 12:11:20.651	\N
135a417a-1dd7-4d32-9ca2-71ee47ca312d	db0988b8-6f6c-44ec-8555-a59a80e9c48a	3be68abb-8a1b-4d44-8a4f-4a7c53ab7708	CHAR.HOST.LALA	\N	\N	\N	0	{}	2026-01-28 12:36:21.688	2026-01-28 12:36:28.555	\N
3863dbbd-2b2e-445d-89ea-af5ec4b03cd8	db0988b8-6f6c-44ec-8555-a59a80e9c48a	b29219aa-2727-41ea-abcb-dba185d1264b	CHAR.GUEST.1	\N	\N	\N	0	{}	2026-01-28 12:11:15.22	2026-01-28 13:20:00.326	\N
036a8861-472c-4a8c-b16e-521616b2be71	db0988b8-6f6c-44ec-8555-a59a80e9c48a	0db17cae-7f1c-4a24-b5e3-e8a73b7d1c2a	TEXT.SHOW.TITLE	\N	\N	\N	0	{}	2026-01-28 13:12:29.531	2026-01-28 17:21:06.168	\N
466261c4-36f0-4e7e-9647-a489b2bfbadf	db0988b8-6f6c-44ec-8555-a59a80e9c48a	3083ff68-fd92-45bc-b208-6f4ecb5d4c31	BRAND.SHOW.TITLE_GRAPHIC	\N	\N	\N	0	{}	2026-01-28 18:00:29.061	2026-01-28 18:00:29.061	\N
\.


--
-- Data for Name: composition_outputs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.composition_outputs (id, composition_id, format, status, image_url, width, height, file_size, error_message, generated_at, generated_by, created_at, updated_at, deleted_at) FROM stdin;
7bba6e5b-483a-42ba-a511-9542bd82d1d4	e695a531-da39-4697-976d-00af6511728f	YOUTUBE	PROCESSING	\N	\N	\N	\N	\N	2026-01-27 14:29:54.194	dev-user	2026-01-27 14:29:54.193	2026-01-27 14:29:54.193	\N
f404f61e-fdb4-4ac1-95fb-22cf91fcce18	e71991a1-e9ca-49c9-80f8-35fcb1387800	YOUTUBE	PROCESSING	\N	\N	\N	\N	\N	2026-01-27 14:32:20.133	dev-user	2026-01-27 14:32:20.132	2026-01-27 14:32:20.132	\N
40dd5010-3272-433d-93ce-1c06ca243538	1ef9f5ba-a6b8-4d00-ac8a-c33a3662896b	YOUTUBE	PROCESSING	\N	\N	\N	\N	\N	2026-01-27 14:37:31.51	dev-user	2026-01-27 14:37:31.51	2026-01-27 14:37:31.51	\N
3f3f204e-d1b7-4f8d-b96e-7b91e0496065	70ef4f42-6935-4961-a6f5-055cfbda9bbb	YOUTUBE	PROCESSING	\N	\N	\N	\N	\N	2026-01-27 14:37:45.07	dev-user	2026-01-27 14:37:45.07	2026-01-27 14:37:45.07	\N
94c618bb-887c-433b-9ef4-86487b5a268a	e3afb0ea-08a9-4f67-9376-98610c2a9745	YOUTUBE	PROCESSING	\N	\N	\N	\N	\N	2026-01-27 14:38:21.61	dev-user	2026-01-27 14:38:21.61	2026-01-27 14:38:21.61	\N
652e2f82-f8ad-485d-a87a-afa9791d6176	cadf01a8-afe9-473b-b813-0962bfc9064b	YOUTUBE	PROCESSING	\N	\N	\N	\N	\N	2026-01-27 14:41:13.605	dev-user	2026-01-27 14:41:13.605	2026-01-27 14:41:13.605	\N
656e91f6-cb96-473b-ba13-118f8400288b	9cfcc3c8-9183-4511-a276-a266de18c406	YOUTUBE	PROCESSING	\N	\N	\N	\N	\N	2026-01-27 16:10:14.212	dev-user	2026-01-27 16:10:14.212	2026-01-27 16:10:14.212	\N
d5904b15-b5a5-4657-8416-b25284d6b9e4	f0b20fff-2c73-43cc-bf8e-c30e2dd06500	YOUTUBE	PROCESSING	\N	\N	\N	\N	\N	2026-01-27 17:07:01.523	dev-user	2026-01-27 17:07:01.523	2026-01-27 17:07:01.523	\N
e7fe8ea2-5cdc-44bb-8984-c0e875b684b6	204b388a-d783-4d7e-bc62-1b0b7c83e4d7	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-27 22:17:25.193	dev-user	2026-01-27 22:17:25.193	2026-01-27 22:17:25.193	\N
623698d0-1ed7-4666-a84c-53a82ef43f5e	b60e8537-ddc1-4717-9bae-7493b62fe1d5	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-27 22:22:04.504	dev-user	2026-01-27 22:22:04.504	2026-01-27 22:22:04.504	\N
6dea5868-e0ec-48c3-bd0f-76ac88b0283b	b29e9e2b-69d4-4a22-b3e0-c4251bbb3d3b	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 00:06:33.049	dev-user	2026-01-28 00:06:33.049	2026-01-28 00:06:33.049	\N
775c38c3-2b30-4616-a325-124313bde9fe	63d49f6e-f419-4061-9035-a4e78d36b4ec	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 00:10:54.573	dev-user	2026-01-28 00:10:54.573	2026-01-28 00:10:54.573	\N
25cd2c31-ed6f-403b-9356-3270c726c38d	53fa7d27-251d-45c8-92be-3033fb2c5b64	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 00:45:51.22	dev-user	2026-01-28 00:45:51.22	2026-01-28 00:45:51.22	\N
79ddf7e5-7ea2-4b79-9bb7-f962fc22ecb8	ce67e508-db38-4ebb-bd7a-0ff75e84c60f	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 00:50:32.124	dev-user	2026-01-28 00:50:32.124	2026-01-28 00:50:32.124	\N
8ffa341c-254a-4ae9-86de-f6643354a6b6	c09f6058-c4f8-4b90-aecc-c6bcff38ff8b	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 00:51:24.868	dev-user	2026-01-28 00:51:24.868	2026-01-28 00:51:24.868	\N
5e12712a-c508-4ca3-8256-56d89d69c464	e197fc11-da65-4225-9f97-b67a95ed6c4a	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 00:51:31.707	dev-user	2026-01-28 00:51:31.707	2026-01-28 00:51:31.707	\N
fdfc1ca1-ef07-4af3-9190-fc9ea0bc6f66	66c5eba4-cf63-498d-a602-9bd659c5536c	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 00:54:51.127	dev-user	2026-01-28 00:54:51.127	2026-01-28 00:54:51.127	\N
ba788580-b3c8-4226-b038-cfb9c0ea71e2	7b98aa1d-be7d-45b9-806e-0e2beef42419	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 00:56:41.331	dev-user	2026-01-28 00:56:41.331	2026-01-28 00:56:41.331	\N
0d668ba8-0b9b-4060-b431-fde88f94e3c7	a02dc671-107f-40e5-b8a2-ae6621c6a230	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 00:56:49.297	dev-user	2026-01-28 00:56:49.297	2026-01-28 00:56:49.297	\N
8d1309b3-9ffc-4cfe-b173-5b70aa539dba	69076e90-9cc8-4dff-a0aa-f53e2c6f75d3	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:00:05.151	dev-user	2026-01-28 01:00:05.151	2026-01-28 01:00:05.151	\N
e7bdffcd-f1ea-41c4-9b8c-b19d2c1d31fb	24062589-12b6-4408-a973-c83f2432e3cc	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:00:36.989	dev-user	2026-01-28 01:00:36.989	2026-01-28 01:00:36.989	\N
d851ab54-f278-4883-bb61-f1d2f90a709d	669b8490-5459-404b-b0b3-d21a16e450b1	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:01:25.935	dev-user	2026-01-28 01:01:25.935	2026-01-28 01:01:25.935	\N
5606c3d9-aedc-466e-953c-bc36cd3f0fd9	00d5ee71-3271-4484-b7f3-f7ec8f5d098c	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:01:34.26	dev-user	2026-01-28 01:01:34.26	2026-01-28 01:01:34.26	\N
129a1043-9aaa-4d72-9a5c-fcfa947d4a44	a479fee3-1d1b-4888-9e06-3426d360d52a	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:03:35.696	dev-user	2026-01-28 01:03:35.696	2026-01-28 01:03:35.696	\N
64a110d7-1da3-4306-a346-ac10cd68480d	dfbe1c99-0385-4e9a-8ad5-84c41488764c	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:03:39.511	dev-user	2026-01-28 01:03:39.511	2026-01-28 01:03:39.511	\N
dee99c3c-0a15-4c14-aef9-9da28f60772f	a2da3f4d-a1e2-4ca1-9042-33241faafba1	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:04:59.413	dev-user	2026-01-28 01:04:59.413	2026-01-28 01:04:59.413	\N
c378f39e-b100-4b28-bd7d-45baac48cd1e	e06dc282-9d41-4526-bedf-18cf2ef5edd4	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:05:17.404	dev-user	2026-01-28 01:05:17.404	2026-01-28 01:05:17.404	\N
bb5a5947-df35-497a-bcba-90a29d8af19b	56ecf272-31de-4749-bff9-84bd8dcd42e7	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:18:54.052	dev-user	2026-01-28 01:18:54.052	2026-01-28 01:18:54.052	\N
15e491a4-5e47-4875-b25c-5d5104b49051	80b1cb57-ec0d-4863-bc95-fe172d95e354	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:18:58.548	dev-user	2026-01-28 01:18:58.548	2026-01-28 01:18:58.548	\N
eb4d038c-0ca8-4537-8107-a4c18d99e972	0c675867-b0be-4b2e-97ed-dc4d0207b0ee	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:21:01.987	dev-user	2026-01-28 01:21:01.987	2026-01-28 01:21:01.987	\N
b603cebc-edb1-4879-8ebd-5ed5030eba82	71c68194-7544-4020-957b-f8e6282cd0d0	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:24:02.95	dev-user	2026-01-28 01:24:02.95	2026-01-28 01:24:02.95	\N
c7a3a389-45e3-4a17-be07-806debc6eb70	962cddf4-55c3-4729-ae70-a34a372d848f	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:24:09.11	dev-user	2026-01-28 01:24:09.11	2026-01-28 01:24:09.11	\N
07b02ab7-b930-43ac-8ed5-839e7476e080	49bd9226-da1f-4352-9237-b8cb76a46bcd	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:25:58.141	dev-user	2026-01-28 01:25:58.141	2026-01-28 01:25:58.141	\N
2f0cec3f-1a6b-43c8-95d5-5826df5a2a1a	b4a35461-5587-4eef-8873-b25c11421a0d	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:38:45.663	dev-user	2026-01-28 01:38:45.662	2026-01-28 01:38:45.662	\N
9208dc01-8a5c-440c-9f9b-3deff99ea5c7	b1636f03-5016-4cf2-81dc-6a2589dfc6d3	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:39:54.017	dev-user	2026-01-28 01:39:54.017	2026-01-28 01:39:54.017	\N
ca0a3c9f-0bea-4620-b6fb-d04ab2c57816	fafc32e3-8c97-4f74-aef2-e2c057bef8cd	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:44:02.122	dev-user	2026-01-28 01:44:02.122	2026-01-28 01:44:02.122	\N
1dea9850-bde4-4d56-a2a5-e0bc1829392f	a2473583-ea26-4d47-968c-70c036b5416f	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:50:11.026	dev-user	2026-01-28 01:50:11.026	2026-01-28 01:50:11.026	\N
a9294121-4cc6-4d30-a0fe-35d6b7da7243	acacefab-2e82-411e-9a70-43a3fb8ffd7e	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:50:18.449	dev-user	2026-01-28 01:50:18.449	2026-01-28 01:50:18.449	\N
3c76d264-b1d5-4577-b5d3-35df4e040a9b	ee495232-5af3-4c7e-8cbf-76cc23ca8971	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:55:34.302	dev-user	2026-01-28 01:55:34.302	2026-01-28 01:55:34.302	\N
a79dc798-6a22-4a04-890c-539708534ee4	e432ef96-8947-43a8-b98d-eb78dbe8b905	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:56:46.9	dev-user	2026-01-28 01:56:46.9	2026-01-28 01:56:46.9	\N
95424cbc-a288-4d2d-98c8-c2bd724aeb2d	35875e36-1ce2-43a1-b1f3-316d513b707b	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 01:58:29.811	dev-user	2026-01-28 01:58:29.811	2026-01-28 01:58:29.811	\N
30cd7c33-ad52-4dfc-b6e9-913cf44f8224	61b738f1-dd44-48d7-bbff-f01091c19155	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 02:01:48.995	dev-user	2026-01-28 02:01:48.995	2026-01-28 02:01:48.995	\N
5f8be971-0b7c-4871-ae42-7a7af7e40f95	1db483ba-62ab-4acf-b9b1-da3b4ff7820c	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 02:03:12.477	dev-user	2026-01-28 02:03:12.477	2026-01-28 02:03:12.477	\N
6ef45008-3981-4774-9e3d-58daf5d541d8	c8f435b0-794b-462f-a416-cd1c4302ad35	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 02:05:34.498	dev-user	2026-01-28 02:05:34.498	2026-01-28 02:05:34.498	\N
bc1c298c-b531-48b3-a2a7-88546add0268	db0988b8-6f6c-44ec-8555-a59a80e9c48a	youtube_hero	PROCESSING	\N	\N	\N	\N	\N	2026-01-28 02:09:37.648	dev-user	2026-01-28 02:09:37.648	2026-01-28 02:09:37.648	\N
\.


--
-- Data for Name: episode_assets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.episode_assets (id, episode_id, asset_id, usage_type, scene_number, display_order, metadata, created_at, updated_at, deleted_at, folder, sort_order, tags, added_at, added_by) FROM stdin;
b5ef87ad-acbc-473b-8bc4-78bd713a92ba	51299ab6-1f9a-41af-951e-cd76cd9272a6	ca89b03b-f5bc-4203-9db8-4ce490b98ab0	general	\N	0	{}	2026-01-21 11:01:25.638-05	2026-01-21 11:01:25.638-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
a9f0b65f-63c2-421c-8928-ea1b990d97fa	51299ab6-1f9a-41af-951e-cd76cd9272a6	b6473b61-f326-4993-8245-0c11d3a292d9	general	\N	0	{}	2026-01-21 11:05:49.316-05	2026-01-21 11:05:49.316-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
25438b04-255c-423d-9936-5e42bdceefd7	2b7065de-f599-4c5b-95a7-61df8f91cffa	3be68abb-8a1b-4d44-8a4f-4a7c53ab7708	general	\N	0	{}	2026-01-25 20:53:20.233-05	2026-01-25 20:53:20.233-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
f7c991a5-e979-4ff3-bc51-57e9ba01f006	2b7065de-f599-4c5b-95a7-61df8f91cffa	0db17cae-7f1c-4a24-b5e3-e8a73b7d1c2a	general	\N	0	{}	2026-01-25 20:53:44.393-05	2026-01-25 20:53:44.393-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
dbefd13f-a4d9-4ed3-b839-bdfc91cd40b3	2b7065de-f599-4c5b-95a7-61df8f91cffa	b29219aa-2727-41ea-abcb-dba185d1264b	general	\N	0	{}	2026-01-25 20:54:16.9-05	2026-01-25 20:54:16.9-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
4ecce68a-f2d8-4a33-b932-7a90edc47f37	2b7065de-f599-4c5b-95a7-61df8f91cffa	f78a79b2-c83c-4ea1-992b-2639a19c3ce3	general	\N	0	{}	2026-01-25 20:54:45.818-05	2026-01-25 20:54:45.818-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
37b81121-9db2-4495-82f5-9ecd9a121ae9	2b7065de-f599-4c5b-95a7-61df8f91cffa	3083ff68-fd92-45bc-b208-6f4ecb5d4c31	general	\N	0	{}	2026-01-25 20:56:11.694-05	2026-01-25 20:56:11.694-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
12ea740a-b24e-4cb9-95be-26ac7c9534b2	2b7065de-f599-4c5b-95a7-61df8f91cffa	5dd49813-c3ad-4b54-af56-2e2da254b9ef	general	\N	0	{}	2026-01-25 22:04:05.651-05	2026-01-25 22:04:05.651-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
d240e31c-8c3e-4cfd-9420-62c0fcda7095	2b7065de-f599-4c5b-95a7-61df8f91cffa	587984ad-7c19-4adf-9957-ff02c5539bcb	general	\N	0	{}	2026-01-25 22:49:57.395-05	2026-01-25 22:49:57.395-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
9b7dfe1c-f823-4bc3-a073-7afe6565b12c	2b7065de-f599-4c5b-95a7-61df8f91cffa	468373f2-1efc-459b-a061-f43233da3629	general	\N	0	{}	2026-01-26 05:50:03.026-05	2026-01-26 05:50:03.026-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
283d8fc7-79c7-4891-85bd-75749181d484	2b7065de-f599-4c5b-95a7-61df8f91cffa	e6db6102-ca61-4253-920a-558fb2ecd612	general	\N	0	{}	2026-01-28 13:01:50.893-05	2026-01-28 13:01:50.893-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
d366f98a-c407-413b-ae89-a84b94bac941	51299ab6-1f9a-41af-951e-cd76cd9272a6	18f034a5-b62c-4102-84ab-87d333191d23	general	\N	0	{}	2026-01-29 17:34:09.712-05	2026-01-29 17:34:09.712-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
51e07916-f3ed-4249-9f77-d2220392a2cb	2b7065de-f599-4c5b-95a7-61df8f91cffa	e213aedc-fd7b-4e7e-9b8e-a97e43e59e96	general	\N	0	{}	2026-01-29 19:09:41.791-05	2026-01-29 19:09:41.792-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
2283315f-bac0-4f20-8b98-22fda47a0c36	2b7065de-f599-4c5b-95a7-61df8f91cffa	c4d220b5-fe8b-4815-a0e8-1e8fb4815575	general	\N	0	{}	2026-01-30 11:02:27.75-05	2026-01-30 11:02:27.75-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
294293f0-6b8b-4fa9-a2c8-5bdcb09e084a	2b7065de-f599-4c5b-95a7-61df8f91cffa	8d4afaac-5faf-46fe-b7e1-f37cc57a4cfb	general	\N	0	{}	2026-01-30 11:37:59.314-05	2026-01-30 11:37:59.314-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
7f24a1bc-d261-43e1-b365-37748af24c37	2b7065de-f599-4c5b-95a7-61df8f91cffa	9d4268c4-2d73-4d72-8ca9-cc9803392354	general	\N	0	{}	2026-01-30 12:33:20.72-05	2026-01-30 12:33:20.721-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
12e33fc6-18d9-4dbd-86a8-b1218c1c2554	2b7065de-f599-4c5b-95a7-61df8f91cffa	4ff7e468-9e19-4fd3-88e1-25a3158d63b7	general	\N	0	{}	2026-01-30 17:44:36.467-05	2026-01-30 17:44:36.468-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
09e00596-3209-43d2-bf77-f7857d8e5c6e	2b7065de-f599-4c5b-95a7-61df8f91cffa	e53d2a46-c19c-4730-b65e-f5026bf37f48	general	\N	0	{}	2026-01-30 17:44:56.416-05	2026-01-30 17:44:56.416-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
58585668-0b65-4e86-8315-295949a70b0a	2b7065de-f599-4c5b-95a7-61df8f91cffa	e280ed0b-aabe-4704-b110-3af3482d27b7	general	\N	0	{}	2026-01-30 17:45:17.333-05	2026-01-30 17:45:17.333-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
5e809b87-eac0-43ab-b407-2186831e07f7	2b7065de-f599-4c5b-95a7-61df8f91cffa	f00a082b-a7ba-4e3d-80c8-e0ec01324e24	general	\N	0	{}	2026-01-30 17:46:00.546-05	2026-01-30 17:46:00.546-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
49458cdf-924f-415a-ae13-830f4305f503	2b7065de-f599-4c5b-95a7-61df8f91cffa	f5fb22da-31a0-4015-92cf-b7eb853cfb3e	general	\N	0	{}	2026-01-30 17:46:31.528-05	2026-01-30 17:46:31.528-05	\N	\N	0	\N	2026-02-01 23:15:56.324361-05	\N
\.


--
-- Data for Name: episode_outfit_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.episode_outfit_items (id, episode_outfit_id, wardrobe_item_id, "position", required, notes, created_at) FROM stdin;
\.


--
-- Data for Name: episode_outfits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.episode_outfits (id, episode_id, name, description, source_outfit_set_id, "character", scene_ids, occasion, notes, is_favorite, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: episode_scenes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.episode_scenes (id, episode_id, scene_library_id, scene_order, trim_start, trim_end, scene_type, episode_notes, created_at, updated_at, deleted_at, type, manual_duration_seconds, title_override, note_text, added_by, last_edited_at, start_time_seconds) FROM stdin;
eb0d8699-7431-49fb-b640-cf676c7e7b39	2b7065de-f599-4c5b-95a7-61df8f91cffa	9e3aee02-448a-4107-9de9-55f7e6d67772	1	0.000	5.000	standard	\N	2026-02-02 03:49:28.543	2026-02-02 03:49:28.544	\N	clip	\N	\N	\N	\N	\N	0.000
4b97fc00-ba1d-495c-bab3-0aafc0edf953	51299ab6-1f9a-41af-951e-cd76cd9272a6	a9e3c6f7-dc86-4248-b3ed-b0b92ba1c305	4	0.000	0.300	standard	\N	2026-01-24 22:13:07.505	2026-01-24 22:17:51.59	2026-01-24 22:17:51.59	clip	\N	\N	\N	\N	\N	10.000
7bff63a5-81fb-4f49-a46e-ba79db053317	51299ab6-1f9a-41af-951e-cd76cd9272a6	\N	9999	0.000	\N	main	\N	2026-01-24 21:02:16.604	2026-01-24 21:02:16.627	2026-01-24 21:02:16.627	note	5.000	Backend Test Note	Test note created by Phase 1 backend test	test-script	2026-01-24 16:02:16.604-05	20.000
e694e2df-76fc-45fb-aed9-c34d5db0d122	51299ab6-1f9a-41af-951e-cd76cd9272a6	bcd98c6c-b2f7-471b-a3f9-4de65bf6c2ed	1	0.000	\N	standard	\N	2026-01-24 17:41:55.585	2026-02-05 12:27:27.108	\N	clip	\N	\N	\N	\N	2026-02-05 07:27:27.107-05	0.000
ddc763da-c80d-457f-9aac-c68aae85d890	51299ab6-1f9a-41af-951e-cd76cd9272a6	\N	2	0.000	\N	main	\N	2026-01-24 22:18:29.406	2026-02-05 12:27:27.113	\N	note	0.000	\N	hello 	dev-user	2026-02-05 07:27:27.113-05	0.000
29a06dd7-48d8-4d2a-8806-e75d45169f50	51299ab6-1f9a-41af-951e-cd76cd9272a6	82e5f92f-173b-4679-928b-29fc474a74cb	3	0.000	\N	standard	\N	2026-01-24 19:14:24.117	2026-02-05 12:27:27.115	\N	clip	\N	\N	\N	\N	2026-02-05 07:27:27.115-05	5.000
54079e4c-d848-4c63-8fb7-cc236da7a56a	51299ab6-1f9a-41af-951e-cd76cd9272a6	bcd98c6c-b2f7-471b-a3f9-4de65bf6c2ed	4	0.000	4.700	standard	\N	2026-01-24 22:06:57.136	2026-02-05 12:27:27.116	\N	clip	\N	\N	\N	\N	2026-02-05 07:27:27.116-05	10.300
16d62dd5-60dd-4066-8290-648e48ec04eb	51299ab6-1f9a-41af-951e-cd76cd9272a6	9e3aee02-448a-4107-9de9-55f7e6d67772	5	0.000	0.000	standard	\N	2026-01-28 22:31:18.142	2026-02-05 12:27:27.118	\N	clip	\N	\N	\N	\N	2026-02-05 07:27:27.117-05	15.000
\.


--
-- Data for Name: episode_scripts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.episode_scripts (id, episode_id, script_type, version_number, version_label, author, status, duration, scene_count, content, file_format, file_url, file_size, is_primary, is_latest, scene_markers, created_by, created_at, updated_at, deleted_at) FROM stdin;
4	51299ab6-1f9a-41af-951e-cd76cd9272a6	main	4	\N	\N	draft	\N	\N	ojijijikkmkm	\N	\N	\N	f	t	[]	system	2026-01-21 23:54:57.25698-05	2026-01-22 00:00:32.904371-05	2026-01-22 00:00:32.904371-05
5	51299ab6-1f9a-41af-951e-cd76cd9272a6	behind-the-scenes	1	\N	gyygvyhhyb	draft	\N	\N	jnujnbbh y h	\N	\N	\N	f	t	[]	system	2026-01-22 00:01:02.432631-05	2026-01-22 00:11:50.679902-05	\N
1	51299ab6-1f9a-41af-951e-cd76cd9272a6	main	1	First Draft	Test Writer	draft	1800	15	INT. TESTING FACILITY - DAY\n\nWe see a developer testing the scripts API...	\N	\N	\N	f	f	[]	system	2026-01-21 23:28:27.887696-05	2026-01-22 00:12:56.077721-05	\N
2	51299ab6-1f9a-41af-951e-cd76cd9272a6	main	2	First Draft	Test Writer	final	1920	15	INT. TESTING FACILITY - DAY\n\nWe see a developer testing the scripts API...	\N	\N	\N	t	f	[]	system	2026-01-21 23:29:11.54349-05	2026-01-22 00:12:56.077721-05	\N
3	51299ab6-1f9a-41af-951e-cd76cd9272a6	main	3	Second Draft	Test Writer	draft	1800	15	INT. TESTING FACILITY - DAY\n\nThe API test continues with version 2...	\N	\N	\N	f	f	[]	system	2026-01-21 23:29:11.579528-05	2026-01-22 00:12:56.077721-05	\N
6	51299ab6-1f9a-41af-951e-cd76cd9272a6	main	4	\N	\N	draft	\N	\N	juuhgygygygy	\N	\N	\N	f	t	[]	system	2026-01-22 00:12:56.077721-05	2026-01-22 00:12:56.077721-05	\N
7	2b7065de-f599-4c5b-95a7-61df8f91cffa	main	1	\N	evoni	final	\N	\N	Lala: Bestie come style me. Princess at the fair vibes... yeah\n\nMe: time to vibes out with Lala, besties and new friends. Make sure you hit that subscribe button and notification button, so you know when it's time to play Adventures with Lala. So princess at the fair vibes huh (Clicks to-do icon) we have to choose our main fit. So let's go into the closet (Clicks closet icon).\n\nMe: Ooh, look at all your clothes, Lala! We need something flowy and elegant, but also playful—like a princess having the best day at the fair. Let’s see… this one right here. (pulls out a pink gingham dress). This is super freakin cute. What do you think, Lala? (Clicks Lala's voice icon)\n\nLala: Yesss bestie! This dress is giving fairytale vibes! Im ready to spin around with everyone watching! Watch out humans, Lala's coming!\n\nMe: I knew you’d love it, Lala. In the comments let me know what you think of this dress cause baby!! It's a slay for me. Alright, let’s pick out some jewelry— (clicks jewelry icon) something with a little sparkle but still keeping it light and fun. (Picks a pearl necklace and earrings). What do you think, Lala? Too much or just enough? (Clicks Lala's voice icon)\n\nLala: Bestie, nothing in fashion is ever too much for me! I’m loving this sparkle! But can we add something to my hair, like a cute ribbon or hair beret?\n\nMe: Oh, you’re so right! (Clicks jewelry icon) Let’s add this pretty gold ribbon to complete the look! (Adds clip). Perfect! Now, let’s style with some layers to add that princess flair. (Clicks closet icon).\n\nMe: A fluffy petticoat is just what we need to add volume to this dress! I know we have one. Oh here it is (Adds petticoat). Now you’re almost ready to walk around the fair like the princess you just need shoes! (Clicks shoe icon).\n\nMe: Hmm, let’s go with these blue boots. They’re comfy enough for walking but still have that cute princess charm. (Puts shoes on Lala). What do you think? (Clicks Lala's speech icon)\n\nLala: Oh, I love them! I can totally see myself enjoying the fair in these!\n\nMe: Now, every princess needs a purse. Let’s see… (Clicks purse icon). I think this small blue purse matches your outfit and shoes perfectly. And it’s just big enough to carry your essentials for a fun day out! (Clicks Lala's speech command)\n\nLala: You have really outdone yourself, bestie! I’m ready for my princess moment!\n\nMe: My true fragrance lovers already know the look is not complete without the perfume! (Clicks perfume icon). How about smelling how you look and we go with a chocolate scent? Something that says, “I’m elegant but ready for fun!” (Sprays perfume on Lala). (Clicks Lala's speech icon)\n\nLala: Yesss! Now I’m feeling myself, bestie! Let’s go make this money, bestie!\n\nMe: You’re going to have everyone waiting on their toes for these results! Let's go get this money, Lala! (Clicks travel icon)\n\n*Transitions to fair photoshoot*\n\nMe: Alright, besties, Lala’s ready for her princess day at the fair photoshoot! Make sure to leave a comment and let us know which part of Lala’s look is your favorite! Don’t forget to like, subscribe, and hit that notification bell so you can join us for more Adventures with Lala! See you next time! I'm out, Lala pose!\n\nLala: Photoshoot time. Make sure you keep an eye out for my photos, besties!\n\nHey, I'm Lala and I'm ready for my photoshoot\n\n(Goes into posing for the camera)	\N	\N	\N	f	t	[]	dev-user	2026-01-25 09:07:28.204794-05	2026-01-28 15:58:31.320064-05	\N
\.


--
-- Data for Name: episode_wardrobe; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.episode_wardrobe (id, episode_id, wardrobe_id, scene, worn_at, notes, created_at, updated_at, approval_status, approved_by, approved_at, rejection_reason, scene_id, is_episode_favorite, times_worn) FROM stdin;
798900a6-27d6-4871-aee3-8c47dad36592	7ed50b54-2eb3-425a-830a-6704648c4635	a4864707-d2d0-437c-a168-24284a1f33e6	\N	2026-01-19 11:07:11.732-05	\N	2026-01-19 11:07:11.732-05	2026-01-19 11:07:11.732-05	pending	\N	\N	\N	\N	f	1
eaaab7b8-a9df-406b-ab23-554804648299	7ed50b54-2eb3-425a-830a-6704648c4635	ccb63fba-3902-4e46-baaf-22808792663e	opening scene	2026-01-19 11:57:31.128-05	\N	2026-01-19 11:57:31.128-05	2026-01-19 11:57:31.128-05	pending	\N	\N	\N	\N	f	1
47614159-5a8d-4b80-a9da-faa8f28bf050	2b7065de-f599-4c5b-95a7-61df8f91cffa	755e4cbf-13c0-4c6a-b827-b4fde888861b	\N	2026-02-01 15:29:52.007-05	\N	2026-02-01 15:29:52.007-05	2026-02-01 15:29:52.007-05	pending	\N	\N	\N	\N	f	1
\.


--
-- Data for Name: episodes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.episodes (id, episode_number, title, description, air_date, status, categories, created_at, updated_at, deleted_at, show_id, thumbnail_url) FROM stdin;
51299ab6-1f9a-41af-951e-cd76cd9272a6	2	hbbnnn	hbhbhbbhhbh	2026-01-21 19:00:00-05	draft	["hbl","bhbh"]	2026-01-19 20:57:44.651-05	2026-01-24 12:17:35.462-05	\N	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	\N
7ed50b54-2eb3-425a-830a-6704648c4635	3	hello	gtffggg	2026-01-20 19:00:00-05	draft	[]	2026-01-19 01:41:59.142-05	2026-01-25 06:53:16.128-05	\N	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	\N
2b7065de-f599-4c5b-95a7-61df8f91cffa	1	Lala's Princess Fair Adventure	Join lala and her besties as they create the perfect princess look for a fun	2026-01-27 19:00:00-05	draft	[]	2026-01-25 09:01:56.085-05	2026-01-25 09:01:56.087-05	\N	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	\N
\.


--
-- Data for Name: metadata_storage; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.metadata_storage (id, episode_id, extracted_text, scenes_detected, sentiment_analysis, visual_objects, transcription, tags, categories, extraction_timestamp, processing_duration_seconds) FROM stdin;
\.


--
-- Data for Name: outfit_set_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.outfit_set_items (id, outfit_set_id, wardrobe_item_id, "position", layer, is_optional, notes, created_at, required_flag) FROM stdin;
\.


--
-- Data for Name: outfit_sets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.outfit_sets (id, name, description, "character", occasion, season, items, created_at, updated_at, deleted_at, show_id, created_by) FROM stdin;
\.


--
-- Data for Name: pgmigrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pgmigrations (id, name, run_on) FROM stdin;
1	20240101000000-create-base-schema	2026-01-24 20:40:10.835743
2	20240101000001-create-file-storage	2026-01-24 20:40:10.842217
3	20260101000001-add-thumbnail-type	2026-01-24 20:40:10.843824
4	20260105000000-add-composition-versioning	2026-01-24 20:40:10.846121
5	20260105000001-add-filtering-indexes	2026-01-24 20:40:10.848621
6	20260116105409-create-scenes-table	2026-01-24 20:40:10.850731
7	20260116105500-add-advanced-scene-fields	2026-01-24 20:40:10.852737
8	20260116105500-create-scene-templates-table	2026-01-24 20:40:10.854392
9	20260118000000-create-shows-table	2026-01-24 20:40:10.855815
10	20260119000000-add-show-id-to-episodes	2026-01-24 20:40:10.85694
11	20260121000000-add-asset-file-columns	2026-01-24 20:40:10.858239
12	20260122000000-create-episode-scripts-table	2026-01-24 20:40:10.859844
13	20260122000001-create-script-edits-table	2026-01-24 20:40:10.860771
14	20260122000002-add-script-fulltext-index	2026-01-24 20:40:10.861762
15	20260122000003-add-search-history	2026-01-24 20:40:10.863092
16	20260123000000-create-wardrobe-library-system	2026-01-24 20:40:10.864468
17	20260123000001-add-library-columns	2026-01-24 20:40:10.866904
18	20260123000002-add-wardrobe-library-item-id	2026-01-24 20:40:10.869366
19	20260123233313-create-scene-library	2026-01-24 20:40:10.870699
20	20260123233314-create-episode-scenes	2026-01-24 20:40:10.872614
21	20260125000001-add-asset-role-system	2026-01-24 20:48:41.818547
22	20260127000001-add-thumbnail-compositions-deleted-at	2026-01-27 08:58:32.038552
23	20260127000002-add-composition-assets-deleted-at	2026-01-27 09:04:15.451001
24	20260127000003-create-composition-outputs	2026-01-27 09:22:57.725694
25	20260127000004-add-composition-outputs-deleted-at	2026-01-27 09:23:09.978912
26	20260201000000-wardrobe-system-refactor	2026-02-01 22:20:41.172014
\.


--
-- Data for Name: scene_assets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.scene_assets (id, scene_id, asset_id, usage_type, start_timecode, end_timecode, layer_order, opacity, "position", metadata, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: scene_library; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.scene_library (id, show_id, video_asset_url, thumbnail_url, title, description, characters, tags, duration_seconds, resolution, file_size_bytes, processing_status, processing_error, s3_key, created_by, updated_by, created_at, updated_at, deleted_at) FROM stdin;
08a57c4f-528f-470b-ad81-f2a023fe47c0	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	https://episode-metadata-storage-dev.s3.us-east-1.amazonaws.com/shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/08a57c4f-528f-470b-ad81-f2a023fe47c0/clip.mp4	\N	test_upload_video	\N	{}	{}	\N	\N	\N	failed	Video metadata extraction failed: Command failed: "C:\\Users\\12483\\Projects\\Episode-Canonical-Control-Record-1\\bin\\ffmpeg.exe" -i "C:\\Users\\12483\\AppData\\Local\\Temp\\temp_video_1769276283617.mp4" -hide_banner 2>&1\n	shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/08a57c4f-528f-470b-ad81-f2a023fe47c0/clip.mp4	dev-user	dev-user	2026-01-24 17:38:02.439	2026-01-24 17:38:04.157	\N
ef8d74c3-0212-4d56-9464-e04c59a68860	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	https://episode-metadata-storage-dev.s3.us-east-1.amazonaws.com/shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/ef8d74c3-0212-4d56-9464-e04c59a68860/clip.mp4	shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/ef8d74c3-0212-4d56-9464-e04c59a68860/thumbnail.jpg	test_upload_video	\N	{}	{}	5.000	\N	18643	ready	Video metadata extraction failed: Command failed: "C:\\Users\\12483\\Projects\\Episode-Canonical-Control-Record-1\\bin\\ffmpeg.exe" -i "C:\\Users\\12483\\AppData\\Local\\Temp\\temp_video_1769275470941.mp4" -hide_banner\nInput #0, mov,mp4,m4a,3gp,3g2,mj2, from 'C:\\Users\\12483\\AppData\\Local\\Temp\\temp_video_1769275470941.mp4':\r\n  Metadata:\r\n    major_brand     : isom\r\n    minor_version   : 512\r\n    compatible_brands: isomiso2avc1mp41\r\n    encoder         : Lavf61.1.100\r\n  Duration: 00:00:05.00, start: 0.000000, bitrate: 29 kb/s\r\n  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), 1280x720, 26 kb/s, 24 fps, 24 tbr, 12288 tbn (default)\r\n    Metadata:\r\n      handler_name    : VideoHandler\r\n      vendor_id       : [0][0][0][0]\r\n      encoder         : Lavc61.3.100 libx264\r\nAt least one output file must be specified\r\n	shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/ef8d74c3-0212-4d56-9464-e04c59a68860/clip.mp4	dev-user	dev-user	2026-01-24 17:24:30.46	2026-01-24 17:55:35.334	\N
bcd98c6c-b2f7-471b-a3f9-4de65bf6c2ed	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	https://episode-metadata-storage-dev.s3.us-east-1.amazonaws.com/shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/bcd98c6c-b2f7-471b-a3f9-4de65bf6c2ed/clip.mp4	shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/bcd98c6c-b2f7-471b-a3f9-4de65bf6c2ed/thumbnail.jpg	test_upload_video	\N	{}	{}	5.000	\N	18643	ready	Video metadata extraction failed: Command failed: "C:\\Users\\12483\\Projects\\Episode-Canonical-Control-Record-1\\bin\\ffmpeg.exe" -i "C:\\Users\\12483\\AppData\\Local\\Temp\\temp_video_1769276515886.mp4" -hide_banner 2>&1\n	shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/bcd98c6c-b2f7-471b-a3f9-4de65bf6c2ed/clip.mp4	dev-user	dev-user	2026-01-24 17:41:55.273	2026-01-24 19:01:36.229	\N
82e5f92f-173b-4679-928b-29fc474a74cb	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	https://episode-metadata-storage-dev.s3.us-east-1.amazonaws.com/shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/82e5f92f-173b-4679-928b-29fc474a74cb/clip.mp4	https://episode-metadata-storage-dev.s3.us-east-1.amazonaws.com/shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/82e5f92f-173b-4679-928b-29fc474a74cb/thumbnail.jpg	test_upload_video	\N	{}	{}	5.000	1280x720	18643	ready	\N	shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/82e5f92f-173b-4679-928b-29fc474a74cb/clip.mp4	dev-user	dev-user	2026-01-24 19:14:23.956	2026-01-24 19:14:25.128	\N
2f559a14-f9a4-4182-be42-35570a8463a7	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	https://episode-metadata-storage-dev.s3.us-east-1.amazonaws.com/shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/2f559a14-f9a4-4182-be42-35570a8463a7/clip.mp4	https://episode-metadata-storage-dev.s3.us-east-1.amazonaws.com/shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/2f559a14-f9a4-4182-be42-35570a8463a7/thumbnail.jpg	test_upload_video	\N	{}	{}	5.000	1280x720	18643	ready	\N	shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/2f559a14-f9a4-4182-be42-35570a8463a7/clip.mp4	dev-user	dev-user	2026-01-24 21:48:19.177	2026-01-24 21:48:20.244	\N
bfd04607-1764-489e-96fc-e0bb13d420bd	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	https://episode-metadata-storage-dev.s3.us-east-1.amazonaws.com/shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/bfd04607-1764-489e-96fc-e0bb13d420bd/clip.mp4	https://episode-metadata-storage-dev.s3.us-east-1.amazonaws.com/shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/bfd04607-1764-489e-96fc-e0bb13d420bd/thumbnail.jpg	test_upload_video	\N	{}	{}	5.000	1280x720	18643	ready	\N	shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/bfd04607-1764-489e-96fc-e0bb13d420bd/clip.mp4	dev-user	dev-user	2026-01-24 21:55:14.105	2026-01-24 21:55:15.681	\N
0a65fe7e-9b76-4172-9721-7e2a9657e6e8	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	https://episode-metadata-storage-dev.s3.us-east-1.amazonaws.com/shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/0a65fe7e-9b76-4172-9721-7e2a9657e6e8/clip.mp4	https://episode-metadata-storage-dev.s3.us-east-1.amazonaws.com/shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/0a65fe7e-9b76-4172-9721-7e2a9657e6e8/thumbnail.jpg	test_upload_video	\N	{}	{}	5.000	1280x720	18643	ready	\N	shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/0a65fe7e-9b76-4172-9721-7e2a9657e6e8/clip.mp4	dev-user	dev-user	2026-01-24 22:09:50.101	2026-01-24 22:09:51.4	\N
a9e3c6f7-dc86-4248-b3ed-b0b92ba1c305	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	https://episode-metadata-storage-dev.s3.us-east-1.amazonaws.com/shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/a9e3c6f7-dc86-4248-b3ed-b0b92ba1c305/clip.mp4	https://episode-metadata-storage-dev.s3.us-east-1.amazonaws.com/shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/a9e3c6f7-dc86-4248-b3ed-b0b92ba1c305/thumbnail.jpg	test_upload_video	\N	{}	{}	5.000	1280x720	18643	ready	\N	shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/a9e3c6f7-dc86-4248-b3ed-b0b92ba1c305/clip.mp4	dev-user	dev-user	2026-01-24 22:13:07.443	2026-01-24 22:13:08.599	\N
9e3aee02-448a-4107-9de9-55f7e6d67772	32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	https://episode-metadata-storage-dev.s3.us-east-1.amazonaws.com/shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/9e3aee02-448a-4107-9de9-55f7e6d67772/clip.mp4	https://episode-metadata-storage-dev.s3.us-east-1.amazonaws.com/shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/9e3aee02-448a-4107-9de9-55f7e6d67772/thumbnail.jpg	test_upload_video	\N	{}	{}	5.000	1280x720	18643	ready	\N	shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/scene-library/9e3aee02-448a-4107-9de9-55f7e6d67772/clip.mp4	dev-user	dev-user	2026-01-28 22:31:18.111	2026-01-28 22:31:19.498	\N
\.


--
-- Data for Name: scene_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.scene_templates (id, name, description, scene_type, mood, location, duration_seconds, structure, default_settings, created_by, is_public, created_at, updated_at) FROM stdin;
cb6dcb7f-62bc-4ca9-9b0b-db7d77a2ed54	Standard Interview	Basic interview setup with intro and outro	main	neutral	\N	\N	{"sections": ["intro", "questions", "conclusion"], "duration_per_section": [30, 300, 30]}	{}	\N	t	2026-01-20 18:21:55.649531-05	2026-01-20 18:21:55.649531-05
4a65c27f-b359-4b43-9504-ec5850e587fb	Product Review	Product showcase and demonstration	main	upbeat	\N	\N	{"sections": ["unboxing", "features", "demo", "verdict"], "duration_per_section": [60, 120, 180, 60]}	{}	\N	t	2026-01-20 18:21:55.658121-05	2026-01-20 18:21:55.658121-05
bb3d25bb-fcb8-4b41-829a-4b7e46f0592f	Tutorial Scene	Step-by-step instructional scene	main	serious	\N	\N	{"sections": ["intro", "step_1", "step_2", "step_3", "recap"], "duration_per_section": [30, 120, 120, 120, 30]}	{}	\N	t	2026-01-20 18:21:55.659341-05	2026-01-20 18:21:55.659341-05
bfdc6ad0-07ed-4cca-9ea2-5aab4b6461fe	Vlog Opening	Engaging intro for vlogs	intro	upbeat	\N	30	{"style": "energetic", "elements": ["hook", "greeting", "topic_intro"]}	{}	\N	t	2026-01-20 18:21:55.660038-05	2026-01-20 18:21:55.660038-05
\.


--
-- Data for Name: scenes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.scenes (id, episode_id, scene_number, title, description, duration_seconds, location, scene_type, production_status, mood, script_notes, start_timecode, end_timecode, is_locked, locked_at, locked_by, characters, created_by, updated_by, thumbnail_id, assets, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: script_edits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.script_edits (id, script_id, user_id, changes, edit_type, ip_address, user_agent, created_at) FROM stdin;
1	1	system	{"after": {"author": "Test Writer", "status": "draft", "content": "INT. TESTING FACILITY - DAY\\n\\nWe see a developer testing the scripts API...", "duration": 1800, "episodeId": "51299ab6-1f9a-41af-951e-cd76cd9272a6", "sceneCount": 15, "scriptType": "main", "versionLabel": "First Draft"}}	create	\N	\N	2026-01-21 23:28:27.887696-05
2	2	system	{"after": {"author": "Test Writer", "status": "draft", "content": "INT. TESTING FACILITY - DAY\\n\\nWe see a developer testing the scripts API...", "duration": 1800, "episodeId": "51299ab6-1f9a-41af-951e-cd76cd9272a6", "sceneCount": 15, "scriptType": "main", "versionLabel": "First Draft"}}	create	\N	\N	2026-01-21 23:29:11.54349-05
3	2	system	{"after": {"status": "final", "duration": 1920}, "before": {"id": 2, "author": "Test Writer", "status": "draft", "content": "INT. TESTING FACILITY - DAY\\n\\nWe see a developer testing the scripts API...", "duration": 1800, "file_url": null, "file_size": null, "is_latest": true, "created_at": "2026-01-22T04:29:11.543Z", "created_by": "system", "deleted_at": null, "episode_id": "51299ab6-1f9a-41af-951e-cd76cd9272a6", "is_primary": false, "updated_at": "2026-01-22T04:29:11.543Z", "file_format": null, "scene_count": 15, "script_type": "main", "scene_markers": [], "version_label": "First Draft", "version_number": 2}}	update	\N	\N	2026-01-21 23:29:11.567424-05
4	3	system	{"after": {"author": "Test Writer", "status": "draft", "content": "INT. TESTING FACILITY - DAY\\n\\nThe API test continues with version 2...", "duration": 1800, "episodeId": "51299ab6-1f9a-41af-951e-cd76cd9272a6", "sceneCount": 15, "scriptType": "main", "versionLabel": "Second Draft"}}	create	\N	\N	2026-01-21 23:29:11.579528-05
5	2	system	{"after": {"is_primary": true}}	set_primary	\N	\N	2026-01-21 23:29:11.596542-05
6	4	system	{"after": {"status": "draft", "content": "jfejorjtifjriojfoerif f re rjgrjgr jgjfjvdjvjdufhds d\\nd\\ndf\\ndgdgfgfhgf vfjgji jf j ifjgf gfji", "episodeId": "51299ab6-1f9a-41af-951e-cd76cd9272a6", "scriptType": "main"}}	create	\N	\N	2026-01-21 23:54:57.25698-05
7	4	system	{"after": {"status": "draft", "content": "rtierjtiojref r rj ierjferj", "scriptType": "main"}, "before": {"id": 4, "author": null, "status": "draft", "content": "jfejorjtifjriojfoerif f re rjgrjgr jgjfjvdjvjdufhds d\\nd\\ndf\\ndgdgfgfhgf vfjgji jf j ifjgf gfji", "duration": null, "file_url": null, "file_size": null, "is_latest": true, "created_at": "2026-01-22T04:54:57.256Z", "created_by": "system", "deleted_at": null, "episode_id": "51299ab6-1f9a-41af-951e-cd76cd9272a6", "is_primary": false, "updated_at": "2026-01-22T04:54:57.256Z", "file_format": null, "scene_count": null, "script_type": "main", "scene_markers": [], "version_label": null, "version_number": 4}}	update	\N	\N	2026-01-21 23:55:10.271098-05
8	4	system	{"after": {"status": "draft", "content": "gygygyugygyugyyhb ygbyg gt   g ", "scriptType": "main"}, "before": {"id": 4, "author": null, "status": "draft", "content": "rtierjtiojref r rj ierjferj", "duration": null, "file_url": null, "file_size": null, "is_latest": true, "created_at": "2026-01-22T04:54:57.256Z", "created_by": "system", "deleted_at": null, "episode_id": "51299ab6-1f9a-41af-951e-cd76cd9272a6", "is_primary": false, "updated_at": "2026-01-22T04:55:10.271Z", "file_format": null, "scene_count": null, "script_type": "main", "scene_markers": [], "version_label": null, "version_number": 4}}	update	\N	\N	2026-01-21 23:58:21.880019-05
9	4	system	{"after": {"status": "draft", "content": "ojijijikkmkm", "scriptType": "main"}, "before": {"id": 4, "author": null, "status": "draft", "content": "gygygyugygyugyyhb ygbyg gt   g ", "duration": null, "file_url": null, "file_size": null, "is_latest": true, "created_at": "2026-01-22T04:54:57.256Z", "created_by": "system", "deleted_at": null, "episode_id": "51299ab6-1f9a-41af-951e-cd76cd9272a6", "is_primary": false, "updated_at": "2026-01-22T04:58:21.880Z", "file_format": null, "scene_count": null, "script_type": "main", "scene_markers": [], "version_label": null, "version_number": 4}}	update	\N	\N	2026-01-22 00:00:19.308685-05
10	4	system	{"before": {"id": 4, "author": null, "status": "draft", "content": "ojijijikkmkm", "duration": null, "file_url": null, "file_size": null, "is_latest": true, "created_at": "2026-01-22T04:54:57.256Z", "created_by": "system", "deleted_at": "2026-01-22T05:00:32.904Z", "episode_id": "51299ab6-1f9a-41af-951e-cd76cd9272a6", "is_primary": false, "updated_at": "2026-01-22T05:00:32.904Z", "file_format": null, "scene_count": null, "script_type": "main", "scene_markers": [], "version_label": null, "version_number": 4}}	delete	\N	\N	2026-01-22 00:00:32.904371-05
11	5	system	{"after": {"status": "draft", "content": "efdjfjd f edjfdjf d fijfjd f jfd fjd fdfdfdfidfdfdjf ", "episodeId": "51299ab6-1f9a-41af-951e-cd76cd9272a6", "scriptType": "behind-the-scenes"}}	create	\N	\N	2026-01-22 00:01:02.432631-05
12	5	system	{"after": {"status": "draft", "content": "yuhuygygg  yg gy   yh", "scriptType": "behind-the-scenes"}, "before": {"id": 5, "author": null, "status": "draft", "content": "efdjfjd f edjfdjf d fijfjd f jfd fjd fdfdfdfidfdfdjf ", "duration": null, "file_url": null, "file_size": null, "is_latest": true, "created_at": "2026-01-22T05:01:02.432Z", "created_by": "system", "deleted_at": null, "episode_id": "51299ab6-1f9a-41af-951e-cd76cd9272a6", "is_primary": false, "updated_at": "2026-01-22T05:01:02.432Z", "file_format": null, "scene_count": null, "script_type": "behind-the-scenes", "scene_markers": [], "version_label": null, "version_number": 1}}	update	\N	\N	2026-01-22 00:06:08.216991-05
13	5	system	{"after": {"author": "gyygvyhhyb", "status": "draft", "content": "jnujnbbh y h", "scriptType": "behind-the-scenes", "versionLabel": "1tst"}, "before": {"id": 5, "author": null, "status": "draft", "content": "yuhuygygg  yg gy   yh", "duration": null, "file_url": null, "file_size": null, "is_latest": true, "created_at": "2026-01-22T05:01:02.432Z", "created_by": "system", "deleted_at": null, "episode_id": "51299ab6-1f9a-41af-951e-cd76cd9272a6", "is_primary": false, "updated_at": "2026-01-22T05:06:08.216Z", "file_format": null, "scene_count": null, "script_type": "behind-the-scenes", "scene_markers": [], "version_label": null, "version_number": 1}}	update	\N	\N	2026-01-22 00:11:50.679902-05
14	6	system	{"after": {"status": "draft", "content": "juuhgygygygy", "episodeId": "51299ab6-1f9a-41af-951e-cd76cd9272a6", "scriptType": "main"}}	create	\N	\N	2026-01-22 00:12:56.077721-05
15	7	dev-user	{"after": {"author": "evoni", "status": "final", "content": "Lala: Bestie come style me. Princess at the fair vibes... yeah\\n\\nMe: time to vibes out with Lala, besties and new friends. Make sure you hit that subscribe button and notification button, so you know when it's time to play Adventures with Lala. So princess at the fair vibes huh (Clicks to-do icon) we have to choose our main fit. So let's go into the closet (Clicks closet icon).\\n\\nMe: Ooh, look at all your clothes, Lala! We need something flowy and elegant, but also playful—like a princess having the best day at the fair. Let’s see… this one right here. (pulls out a pink gingham dress). This is super freakin cute. What do you think, Lala? (Clicks Lala's voice icon)\\n\\nLala: Yesss bestie! This dress is giving fairytale vibes! Im ready to spin around with everyone watching! Watch out humans, Lala's coming!\\n\\nMe: I knew you’d love it, Lala. In the comments let me know what you think of this dress cause baby!! It's a slay for me. Alright, let’s pick out some jewelry— (clicks jewelry icon) something with a little sparkle but still keeping it light and fun. (Picks a pearl necklace and earrings). What do you think, Lala? Too much or just enough? (Clicks Lala's voice icon)\\n\\nLala: Bestie, nothing in fashion is ever too much for me! I’m loving this sparkle! But can we add something to my hair, like a cute ribbon or hair beret?\\n\\nMe: Oh, you’re so right! (Clicks jewelry icon) Let’s add this pretty gold ribbon to complete the look! (Adds clip). Perfect! Now, let’s style with some layers to add that princess flair. (Clicks closet icon).\\n\\nMe: A fluffy petticoat is just what we need to add volume to this dress! I know we have one. Oh here it is (Adds petticoat). Now you’re almost ready to walk around the fair like the princess you just need shoes! (Clicks shoe icon).\\n\\nMe: Hmm, let’s go with these blue boots. They’re comfy enough for walking but still have that cute princess charm. (Puts shoes on Lala). What do you think? (Clicks Lala's speech icon)\\n\\nLala: Oh, I love them! I can totally see myself enjoying the fair in these!\\n\\nMe: Now, every princess needs a purse. Let’s see… (Clicks purse icon). I think this small blue purse matches your outfit and shoes perfectly. And it’s just big enough to carry your essentials for a fun day out! (Clicks Lala's speech command)\\n\\nLala: You have really outdone yourself, bestie! I’m ready for my princess moment!\\n\\nMe: My true fragrance lovers already know the look is not complete without the perfume! (Clicks perfume icon). How about smelling how you look and we go with a chocolate scent? Something that says, “I’m elegant but ready for fun!” (Sprays perfume on Lala). (Clicks Lala's speech icon)\\n\\nLala: Yesss! Now I’m feeling myself, bestie! Let’s go make this money, bestie!\\n\\nMe: You’re going to have everyone waiting on their toes for these results! Let's go get this money, Lala! (Clicks travel icon)\\n\\n*Transitions to fair photoshoot*\\n\\nMe: Alright, besties, Lala’s ready for her princess day at the fair photoshoot! Make sure to leave a comment and let us know which part of Lala’s look is your favorite! Don’t forget to like, subscribe, and hit that notification bell so you can join us for more Adventures with Lala! See you next time! I'm out, Lala pose!\\n\\nLala: Photoshoot time. Make sure you keep an eye out for my photos, besties!\\n\\nHey, I'm Lala and I'm ready for my photoshoot\\n\\n(Goes into posing for the camera)", "episodeId": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "scriptType": "main"}}	create	\N	\N	2026-01-25 09:07:28.204794-05
16	7	dev-user	{"after": {"author": "evoni", "status": "final", "content": "Lala: Bestie come style me. Princess at the fair vibes... yeah\\n\\nMe: time to vibes out with Lala, besties and new friends. Make sure you hit that subscribe button and notification button, so you know when it's time to play Adventures with Lala. So princess at the fair vibes huh (Clicks to-do icon) we have to choose our main fit. So let's go into the closet (Clicks closet icon).\\n\\nMe: Ooh, look at all your clothes, Lala! We need something flowy and elegant, but also playful—like a princess having the best day at the fair. Let’s see… this one right here. (pulls out a pink gingham dress). This is super freakin cute. What do you think, Lala? (Clicks Lala's voice icon)\\n\\nLala: Yesss bestie! This dress is giving fairytale vibes! Im ready to spin around with everyone watching! Watch out humans, Lala's coming!\\n\\nMe: I knew you’d love it, Lala. In the comments let me know what you think of this dress cause baby!! It's a slay for me. Alright, let’s pick out some jewelry— (clicks jewelry icon) something with a little sparkle but still keeping it light and fun. (Picks a pearl necklace and earrings). What do you think, Lala? Too much or just enough? (Clicks Lala's voice icon)\\n\\nLala: Bestie, nothing in fashion is ever too much for me! I’m loving this sparkle! But can we add something to my hair, like a cute ribbon or hair beret?\\n\\nMe: Oh, you’re so right! (Clicks jewelry icon) Let’s add this pretty gold ribbon to complete the look! (Adds clip). Perfect! Now, let’s style with some layers to add that princess flair. (Clicks closet icon).\\n\\nMe: A fluffy petticoat is just what we need to add volume to this dress! I know we have one. Oh here it is (Adds petticoat). Now you’re almost ready to walk around the fair like the princess you just need shoes! (Clicks shoe icon).\\n\\nMe: Hmm, let’s go with these blue boots. They’re comfy enough for walking but still have that cute princess charm. (Puts shoes on Lala). What do you think? (Clicks Lala's speech icon)\\n\\nLala: Oh, I love them! I can totally see myself enjoying the fair in these!\\n\\nMe: Now, every princess needs a purse. Let’s see… (Clicks purse icon). I think this small blue purse matches your outfit and shoes perfectly. And it’s just big enough to carry your essentials for a fun day out! (Clicks Lala's speech command)\\n\\nLala: You have really outdone yourself, bestie! I’m ready for my princess moment!\\n\\nMe: My true fragrance lovers already know the look is not complete without the perfume! (Clicks perfume icon). How about smelling how you look and we go with a chocolate scent? Something that says, “I’m elegant but ready for fun!” (Sprays perfume on Lala). (Clicks Lala's speech icon)\\n\\nLala: Yesss! Now I’m feeling myself, bestie! Let’s go make this money, bestie!\\n\\nMe: You’re going to have everyone waiting on their toes for these results! Let's go get this money, Lala! (Clicks travel icon)\\n\\n*Transitions to fair photoshoot*\\n\\nMe: Alright, besties, Lala’s ready for her princess day at the fair photoshoot! Make sure to leave a comment and let us know which part of Lala’s look is your favorite! Don’t forget to like, subscribe, and hit that notification bell so you can join us for more Adventures with Lala! See you next time! I'm out, Lala pose!\\n\\nLala: Photoshoot time. Make sure you keep an eye out for my photos, besties!\\n\\nHey, I'm Lala and I'm ready for my photoshoot\\n\\n(Goes into posing for the camera)", "scriptType": "main"}, "before": {"id": 7, "author": "evoni", "status": "final", "content": "Lala: Bestie come style me. Princess at the fair vibes... yeah\\n\\nMe: time to vibes out with Lala, besties and new friends. Make sure you hit that subscribe button and notification button, so you know when it's time to play Adventures with Lala. So princess at the fair vibes huh (Clicks to-do icon) we have to choose our main fit. So let's go into the closet (Clicks closet icon).\\n\\nMe: Ooh, look at all your clothes, Lala! We need something flowy and elegant, but also playful—like a princess having the best day at the fair. Let’s see… this one right here. (pulls out a pink gingham dress). This is super freakin cute. What do you think, Lala? (Clicks Lala's voice icon)\\n\\nLala: Yesss bestie! This dress is giving fairytale vibes! Im ready to spin around with everyone watching! Watch out humans, Lala's coming!\\n\\nMe: I knew you’d love it, Lala. In the comments let me know what you think of this dress cause baby!! It's a slay for me. Alright, let’s pick out some jewelry— (clicks jewelry icon) something with a little sparkle but still keeping it light and fun. (Picks a pearl necklace and earrings). What do you think, Lala? Too much or just enough? (Clicks Lala's voice icon)\\n\\nLala: Bestie, nothing in fashion is ever too much for me! I’m loving this sparkle! But can we add something to my hair, like a cute ribbon or hair beret?\\n\\nMe: Oh, you’re so right! (Clicks jewelry icon) Let’s add this pretty gold ribbon to complete the look! (Adds clip). Perfect! Now, let’s style with some layers to add that princess flair. (Clicks closet icon).\\n\\nMe: A fluffy petticoat is just what we need to add volume to this dress! I know we have one. Oh here it is (Adds petticoat). Now you’re almost ready to walk around the fair like the princess you just need shoes! (Clicks shoe icon).\\n\\nMe: Hmm, let’s go with these blue boots. They’re comfy enough for walking but still have that cute princess charm. (Puts shoes on Lala). What do you think? (Clicks Lala's speech icon)\\n\\nLala: Oh, I love them! I can totally see myself enjoying the fair in these!\\n\\nMe: Now, every princess needs a purse. Let’s see… (Clicks purse icon). I think this small blue purse matches your outfit and shoes perfectly. And it’s just big enough to carry your essentials for a fun day out! (Clicks Lala's speech command)\\n\\nLala: You have really outdone yourself, bestie! I’m ready for my princess moment!\\n\\nMe: My true fragrance lovers already know the look is not complete without the perfume! (Clicks perfume icon). How about smelling how you look and we go with a chocolate scent? Something that says, “I’m elegant but ready for fun!” (Sprays perfume on Lala). (Clicks Lala's speech icon)\\n\\nLala: Yesss! Now I’m feeling myself, bestie! Let’s go make this money, bestie!\\n\\nMe: You’re going to have everyone waiting on their toes for these results! Let's go get this money, Lala! (Clicks travel icon)\\n\\n*Transitions to fair photoshoot*\\n\\nMe: Alright, besties, Lala’s ready for her princess day at the fair photoshoot! Make sure to leave a comment and let us know which part of Lala’s look is your favorite! Don’t forget to like, subscribe, and hit that notification bell so you can join us for more Adventures with Lala! See you next time! I'm out, Lala pose!\\n\\nLala: Photoshoot time. Make sure you keep an eye out for my photos, besties!\\n\\nHey, I'm Lala and I'm ready for my photoshoot\\n\\n(Goes into posing for the camera)", "duration": null, "file_url": null, "file_size": null, "is_latest": true, "created_at": "2026-01-25T14:07:28.204Z", "created_by": "dev-user", "deleted_at": null, "episode_id": "2b7065de-f599-4c5b-95a7-61df8f91cffa", "is_primary": false, "updated_at": "2026-01-25T14:07:28.204Z", "file_format": null, "scene_count": null, "script_type": "main", "scene_markers": [], "version_label": null, "version_number": 1}}	update	\N	\N	2026-01-28 15:58:31.320064-05
\.


--
-- Data for Name: search_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.search_history (id, user_id, query, search_type, filters, result_count, clicked_result_id, search_duration_ms, created_at) FROM stdin;
3	test-user-diag-123	test	episodes	{}	0	\N	75	2026-01-22 09:24:29.834743
4	test-user-e2e-123	episode	episodes	{}	0	\N	68	2026-01-22 09:25:44.375928
5	test-user-e2e-123	test	episodes	{"status": "published"}	0	\N	2	2026-01-22 09:25:44.385958
6	test-user-e2e-123	episode	episodes	{}	0	\N	81	2026-01-22 09:28:29.663098
7	test-user-e2e-123	test	episodes	{"status": "published"}	0	\N	2	2026-01-22 09:28:29.672699
8	test-user-e2e-123	script	scripts	{}	2	\N	10	2026-01-22 09:28:29.689773
9	test-user-e2e-123	test	scripts	{"scriptType": "main"}	3	\N	4	2026-01-22 09:28:29.701018
10	test-user-e2e-123	episode	episodes	{"status": null}	0	\N	189	2026-01-22 13:05:11.420088
11	test-user-e2e-123	test	episodes	{"status": "published"}	0	\N	3	2026-01-22 13:05:11.431043
12	test-user-e2e-123	script	scripts	{"status": null, "episodeId": null, "scriptType": null}	2	\N	6	2026-01-22 13:05:11.442972
13	test-user-e2e-123	test	scripts	{"status": null, "episodeId": null, "scriptType": "main"}	3	\N	2	2026-01-22 13:05:11.452097
\.


--
-- Data for Name: show_assets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.show_assets (id, show_id, asset_id, usage_context, display_order, is_primary, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: shows; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shows (id, name, slug, description, genre, status, creator_name, network, episode_count, season_count, premiere_date, metadata, is_active, created_at, updated_at, deleted_at, icon, color, cover_image_url, cover_s3_key) FROM stdin;
32bfbf8b-1f46-46dd-8a5d-3b705d324c1b	Styling Adventures with lala	styling-adventures-with-lala	jfadjfijdfjdjfjdijfidjfjdijddfd	\N	active	\N	\N	0	1	\N	{}	t	2026-01-20 01:41:40.588	2026-01-20 01:41:40.588	\N	📺	#667eea	\N	\N
\.


--
-- Data for Name: template_studio; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.template_studio (id, name, description, version, status, locked, canvas_config, role_slots, safe_zones, required_roles, optional_roles, formats_supported, created_by, published_at, locked_at, parent_template_id, created_at, updated_at) FROM stdin;
550e8400-e29b-41d4-a716-446655440001	Single Guest - YouTube v1	\N	1	PUBLISHED	t	{"width": 1280, "height": 720, "background_color": "#667eea"}	[{"role": "BG.MAIN", "z_index": 0, "position": {"x": 0, "y": 0, "width": 1280, "height": 720}, "transform": {"scale": 1, "rotation": 0}, "visible_by_default": true}, {"role": "CHAR.HOST.LALA", "filters": {"dropShadow": true}, "z_index": 10, "position": {"x": 100, "y": 150, "width": 400, "height": 550}, "transform": {"scale": 1, "rotation": 0}, "visible_by_default": true}, {"role": "CHAR.HOST.JUSTAWOMANINHERPRIME", "filters": {"dropShadow": true}, "z_index": 10, "position": {"x": 780, "y": 150, "width": 400, "height": 550}, "transform": {"scale": 1, "rotation": 0}, "visible_by_default": true}, {"role": "CHAR.GUEST.1", "filters": {"dropShadow": true}, "z_index": 15, "position": {"x": 440, "y": 120, "width": 400, "height": 580}, "transform": {"scale": 1.1, "rotation": 0}, "conditional_rules": {"show_if": "EPISODE.HAS_GUEST"}, "visible_by_default": false}, {"role": "TEXT.SHOW.TITLE", "z_index": 20, "position": {"x": 50, "y": 30, "width": 600, "height": 100}, "text_style": {"color": "#ffffff", "shadow": {"blur": 6, "color": "#000000", "offset": [3, 3]}, "stroke": {"color": "#000000", "width": 4}, "font_size": 56, "font_family": "Montserrat", "font_weight": 700}, "visible_by_default": true}, {"role": "BRAND.SHOW.TITLE_GRAPHIC", "z_index": 20, "position": {"x": 50, "y": 30, "width": 400, "height": 100}, "visible_by_default": false}, {"role": "UI.ICON.HOLDER.MAIN", "z_index": 5, "position": {"x": 920, "y": 560, "width": 340, "height": 140}, "conditional_rules": {"show_if": "COMPOSITION.ICONS_ENABLED"}, "visible_by_default": false}]	{"youtube": {"x": 40, "y": 40, "width": 1200, "height": 640}, "instagram": {"x": 80, "y": 80, "width": 1120, "height": 560}}	{BG.MAIN,CHAR.HOST.LALA,CHAR.HOST.JUSTAWOMANINHERPRIME}	{CHAR.GUEST.1,CHAR.GUEST.2,TEXT.SHOW.TITLE,BRAND.SHOW.TITLE_GRAPHIC,UI.ICON.*,UI.ICON.HOLDER.MAIN}	{YOUTUBE,YOUTUBE_MOBILE}	\N	2026-01-26 07:30:00	2026-01-26 07:30:00	\N	2026-01-26 07:30:00	2026-01-26 07:30:00
550e8400-e29b-41d4-a716-446655440002	Dual Guest - YouTube v1	\N	1	PUBLISHED	t	{"width": 1280, "height": 720, "background_color": "#9333ea"}	[{"role": "BG.MAIN", "z_index": 0, "position": {"x": 0, "y": 0, "width": 1280, "height": 720}, "visible_by_default": true}, {"role": "CHAR.HOST.LALA", "filters": {"dropShadow": true}, "z_index": 10, "position": {"x": 60, "y": 180, "width": 280, "height": 500}, "transform": {"scale": 0.9, "rotation": 0}, "visible_by_default": true}, {"role": "CHAR.HOST.JUSTAWOMANINHERPRIME", "filters": {"dropShadow": true}, "z_index": 10, "position": {"x": 940, "y": 180, "width": 280, "height": 500}, "transform": {"scale": 0.9, "rotation": 0}, "visible_by_default": true}, {"role": "CHAR.GUEST.1", "filters": {"dropShadow": true}, "z_index": 15, "position": {"x": 360, "y": 120, "width": 260, "height": 560}, "transform": {"scale": 1, "rotation": 0}, "conditional_rules": {"show_if": "EPISODE.HAS_DUAL_GUESTS"}, "visible_by_default": true}, {"role": "CHAR.GUEST.2", "filters": {"dropShadow": true}, "z_index": 15, "position": {"x": 660, "y": 120, "width": 260, "height": 560}, "transform": {"scale": 1, "rotation": 0}, "conditional_rules": {"show_if": "EPISODE.HAS_DUAL_GUESTS"}, "visible_by_default": true}, {"role": "TEXT.SHOW.TITLE", "z_index": 20, "position": {"x": 340, "y": 20, "width": 600, "height": 90}, "text_style": {"color": "#ffffff", "shadow": {"blur": 8, "color": "#000000", "offset": [4, 4]}, "stroke": {"color": "#000000", "width": 5}, "font_size": 52, "font_family": "Montserrat", "font_weight": 800}, "visible_by_default": true}]	{"youtube": {"x": 40, "y": 40, "width": 1200, "height": 640}}	{BG.MAIN,CHAR.HOST.LALA,CHAR.HOST.JUSTAWOMANINHERPRIME,CHAR.GUEST.1,CHAR.GUEST.2}	{TEXT.SHOW.TITLE,BRAND.SHOW.TITLE_GRAPHIC}	{YOUTUBE}	\N	2026-01-26 07:30:00	2026-01-26 07:30:00	\N	2026-01-26 07:30:00	2026-01-26 07:30:00
550e8400-e29b-41d4-a716-446655440003	Wardrobe Showcase - YouTube v1	\N	1	PUBLISHED	t	{"width": 1280, "height": 720, "background_color": "#ec4899"}	[{"role": "BG.MAIN", "z_index": 0, "position": {"x": 0, "y": 0, "width": 1280, "height": 720}, "visible_by_default": true}, {"role": "CHAR.HOST.LALA", "filters": {"dropShadow": true}, "z_index": 10, "position": {"x": 200, "y": 100, "width": 400, "height": 600}, "visible_by_default": true}, {"role": "CHAR.HOST.JUSTAWOMANINHERPRIME", "filters": {"dropShadow": true}, "z_index": 10, "position": {"x": 680, "y": 100, "width": 400, "height": 600}, "visible_by_default": true}, {"role": "TEXT.SHOW.TITLE", "z_index": 20, "position": {"x": 40, "y": 20, "width": 700, "height": 80}, "text_style": {"color": "#ffffff", "shadow": {"blur": 6, "color": "#000000", "offset": [3, 3]}, "stroke": {"color": "#8b5cf6", "width": 4}, "font_size": 58, "font_family": "Oswald", "font_weight": 700}, "visible_by_default": true}, {"role": "WARDROBE.PANEL", "filters": {"opacity": 0.9}, "z_index": 5, "position": {"x": 40, "y": 500, "width": 1200, "height": 200}, "conditional_rules": {"show_if": "COMPOSITION.WARDROBE_ENABLED"}, "visible_by_default": false}, {"role": "WARDROBE.ITEM.1", "z_index": 6, "position": {"x": 60, "y": 520, "width": 140, "height": 160}, "conditional_rules": {"show_if": "COMPOSITION.WARDROBE_ENABLED"}, "visible_by_default": false}, {"role": "WARDROBE.ITEM.2", "z_index": 6, "position": {"x": 215, "y": 520, "width": 140, "height": 160}, "conditional_rules": {"show_if": "COMPOSITION.WARDROBE_ENABLED"}, "visible_by_default": false}, {"role": "WARDROBE.ITEM.3", "z_index": 6, "position": {"x": 370, "y": 520, "width": 140, "height": 160}, "conditional_rules": {"show_if": "COMPOSITION.WARDROBE_ENABLED"}, "visible_by_default": false}, {"role": "WARDROBE.ITEM.4", "z_index": 6, "position": {"x": 525, "y": 520, "width": 140, "height": 160}, "conditional_rules": {"show_if": "COMPOSITION.WARDROBE_ENABLED"}, "visible_by_default": false}, {"role": "WARDROBE.ITEM.5", "z_index": 6, "position": {"x": 680, "y": 520, "width": 140, "height": 160}, "conditional_rules": {"show_if": "COMPOSITION.WARDROBE_ENABLED"}, "visible_by_default": false}, {"role": "WARDROBE.ITEM.6", "z_index": 6, "position": {"x": 835, "y": 520, "width": 140, "height": 160}, "conditional_rules": {"show_if": "COMPOSITION.WARDROBE_ENABLED"}, "visible_by_default": false}, {"role": "WARDROBE.ITEM.7", "z_index": 6, "position": {"x": 990, "y": 520, "width": 140, "height": 160}, "conditional_rules": {"show_if": "COMPOSITION.WARDROBE_ENABLED"}, "visible_by_default": false}, {"role": "WARDROBE.ITEM.8", "z_index": 6, "position": {"x": 1080, "y": 520, "width": 140, "height": 160}, "conditional_rules": {"show_if": "COMPOSITION.WARDROBE_ENABLED"}, "visible_by_default": false}]	{"youtube": {"x": 40, "y": 40, "width": 1200, "height": 640}}	{BG.MAIN,CHAR.HOST.LALA,CHAR.HOST.JUSTAWOMANINHERPRIME}	{TEXT.SHOW.TITLE,WARDROBE.PANEL,WARDROBE.ITEM.1,WARDROBE.ITEM.2,WARDROBE.ITEM.3,WARDROBE.ITEM.4,WARDROBE.ITEM.5,WARDROBE.ITEM.6,WARDROBE.ITEM.7,WARDROBE.ITEM.8}	{YOUTUBE}	\N	2026-01-26 07:30:00	2026-01-26 07:30:00	\N	2026-01-26 07:30:00	2026-01-26 07:30:00
\.


--
-- Data for Name: thumbnail_compositions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.thumbnail_compositions (id, episode_id, template_id, name, description, status, created_by, template_version, frozen_layout_config, frozen_required_roles, created_at, updated_at, selected_formats, current_version, version_history, last_modified_by, modification_timestamp, background_frame_asset_id, lala_asset_id, guest_asset_id, justawomen_asset_id, layout_overrides, draft_overrides, draft_updated_at, draft_updated_by, has_unsaved_changes, is_primary, composition_config, template_studio_id, deleted_at, justawomaninherprime_asset_id) FROM stdin;
b0d6c5ed-7d65-4c2c-b4db-b51062f7198e	51299ab6-1f9a-41af-951e-cd76cd9272a6	0d99b285-97c8-4f99-959b-3aca8f60c269	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-25 09:31:48.864	2026-01-25 09:31:48.864	["YOUTUBE"]	1	{}	\N	2026-01-25 09:31:48.864	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
67309bbd-240d-453f-9e5e-3d150183157b	51299ab6-1f9a-41af-951e-cd76cd9272a6	0d99b285-97c8-4f99-959b-3aca8f60c269	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-25 09:31:50.666	2026-01-25 09:31:50.666	["YOUTUBE"]	1	{}	\N	2026-01-25 09:31:50.666	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
92c40b63-f4b3-4faa-bbd8-a8b37604cc47	51299ab6-1f9a-41af-951e-cd76cd9272a6	0d99b285-97c8-4f99-959b-3aca8f60c269	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-25 09:32:42.361	2026-01-25 09:32:42.361	["YOUTUBE"]	1	{}	\N	2026-01-25 09:32:42.361	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
ba10df3b-bd86-4369-bdcd-cd975cd016a9	51299ab6-1f9a-41af-951e-cd76cd9272a6	0d99b285-97c8-4f99-959b-3aca8f60c269	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-25 09:38:27.801	2026-01-25 09:38:27.801	["YOUTUBE"]	1	{}	\N	2026-01-25 09:38:27.801	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
788966d6-fb5a-45a5-a800-38d4aa3fd686	51299ab6-1f9a-41af-951e-cd76cd9272a6	0d99b285-97c8-4f99-959b-3aca8f60c269	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-25 11:46:21.559	2026-01-25 11:46:21.559	["YOUTUBE"]	1	{}	\N	2026-01-25 11:46:21.559	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
f8eab781-8c63-440f-8444-46e66533fde6	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-27 13:27:39.416	2026-01-27 13:27:39.416	["YOUTUBE"]	1	{}	\N	2026-01-27 13:27:39.416	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
7dbf98ff-2e02-4329-a569-1387f80f00b1	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-27 14:02:04.855	2026-01-27 14:02:04.855	["YOUTUBE"]	1	{}	\N	2026-01-27 14:02:04.855	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
74e52b78-11ff-470a-8a16-c45400e07a36	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-27 14:10:19.265	2026-01-27 14:10:19.265	["YOUTUBE"]	1	{}	\N	2026-01-27 14:10:19.265	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
4a33f3b6-0cd4-43c4-9d85-0b758c67f045	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-27 14:16:49.339	2026-01-27 14:16:49.339	["YOUTUBE"]	1	{}	\N	2026-01-27 14:16:49.339	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
e695a531-da39-4697-976d-00af6511728f	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-27 14:29:54.163	2026-01-27 14:29:54.163	["YOUTUBE"]	1	{}	\N	2026-01-27 14:29:54.164	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
e71991a1-e9ca-49c9-80f8-35fcb1387800	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-27 14:32:20.123	2026-01-27 14:32:20.123	["YOUTUBE"]	1	{}	\N	2026-01-27 14:32:20.123	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
1ef9f5ba-a6b8-4d00-ac8a-c33a3662896b	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-27 14:37:31.497	2026-01-27 14:37:31.497	["YOUTUBE"]	1	{}	\N	2026-01-27 14:37:31.497	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
70ef4f42-6935-4961-a6f5-055cfbda9bbb	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-27 14:37:45.055	2026-01-27 14:37:45.055	["YOUTUBE"]	1	{}	\N	2026-01-27 14:37:45.055	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
e3afb0ea-08a9-4f67-9376-98610c2a9745	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-27 14:38:21.594	2026-01-27 14:38:21.594	["YOUTUBE"]	1	{}	\N	2026-01-27 14:38:21.594	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
cadf01a8-afe9-473b-b813-0962bfc9064b	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-27 14:41:13.595	2026-01-27 14:41:13.595	["YOUTUBE"]	1	{}	\N	2026-01-27 14:41:13.595	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
9cfcc3c8-9183-4511-a276-a266de18c406	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-27 16:10:14.182	2026-01-27 16:10:14.182	["YOUTUBE"]	1	{}	\N	2026-01-27 16:10:14.182	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
f0b20fff-2c73-43cc-bf8e-c30e2dd06500	2b7065de-f599-4c5b-95a7-61df8f91cffa	0d99b285-97c8-4f99-959b-3aca8f60c269	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-27 17:07:01.5	2026-01-27 17:07:01.5	["YOUTUBE"]	1	{}	\N	2026-01-27 17:07:01.5	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
204b388a-d783-4d7e-bc62-1b0b7c83e4d7	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-27 22:17:25.179	2026-01-27 22:17:25.179	["youtube_hero"]	1	{}	\N	2026-01-27 22:17:25.18	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
b60e8537-ddc1-4717-9bae-7493b62fe1d5	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-27 22:22:04.499	2026-01-27 22:22:04.499	["youtube_hero"]	1	{}	\N	2026-01-27 22:22:04.499	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
b29e9e2b-69d4-4a22-b3e0-c4251bbb3d3b	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 00:06:33.046	2026-01-28 00:06:33.046	["youtube_hero"]	1	{}	\N	2026-01-28 00:06:33.046	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
63d49f6e-f419-4061-9035-a4e78d36b4ec	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 00:10:54.571	2026-01-28 00:10:54.571	["youtube_hero"]	1	{}	\N	2026-01-28 00:10:54.571	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
53fa7d27-251d-45c8-92be-3033fb2c5b64	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 00:45:51.217	2026-01-28 00:45:51.217	["youtube_hero"]	1	{}	\N	2026-01-28 00:45:51.217	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
ce67e508-db38-4ebb-bd7a-0ff75e84c60f	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 00:50:32.121	2026-01-28 00:50:32.121	["youtube_hero"]	1	{}	\N	2026-01-28 00:50:32.121	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
c09f6058-c4f8-4b90-aecc-c6bcff38ff8b	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 00:51:24.866	2026-01-28 00:51:24.866	["youtube_hero"]	1	{}	\N	2026-01-28 00:51:24.866	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
e197fc11-da65-4225-9f97-b67a95ed6c4a	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 00:51:31.705	2026-01-28 00:51:31.705	["youtube_hero"]	1	{}	\N	2026-01-28 00:51:31.705	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
66c5eba4-cf63-498d-a602-9bd659c5536c	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 00:54:51.126	2026-01-28 00:54:51.126	["youtube_hero"]	1	{}	\N	2026-01-28 00:54:51.126	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
7b98aa1d-be7d-45b9-806e-0e2beef42419	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 00:56:41.328	2026-01-28 00:56:41.328	["youtube_hero"]	1	{}	\N	2026-01-28 00:56:41.328	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
a02dc671-107f-40e5-b8a2-ae6621c6a230	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 00:56:49.295	2026-01-28 00:56:49.295	["youtube_hero"]	1	{}	\N	2026-01-28 00:56:49.295	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
69076e90-9cc8-4dff-a0aa-f53e2c6f75d3	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:00:05.148	2026-01-28 01:00:05.148	["youtube_hero"]	1	{}	\N	2026-01-28 01:00:05.148	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
24062589-12b6-4408-a973-c83f2432e3cc	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:00:36.987	2026-01-28 01:00:36.987	["youtube_hero"]	1	{}	\N	2026-01-28 01:00:36.987	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
669b8490-5459-404b-b0b3-d21a16e450b1	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:01:25.933	2026-01-28 01:01:25.933	["youtube_hero"]	1	{}	\N	2026-01-28 01:01:25.933	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
00d5ee71-3271-4484-b7f3-f7ec8f5d098c	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:01:34.257	2026-01-28 01:01:34.257	["youtube_hero"]	1	{}	\N	2026-01-28 01:01:34.257	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
a479fee3-1d1b-4888-9e06-3426d360d52a	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:03:35.694	2026-01-28 01:03:35.694	["youtube_hero"]	1	{}	\N	2026-01-28 01:03:35.694	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
dfbe1c99-0385-4e9a-8ad5-84c41488764c	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:03:39.509	2026-01-28 01:03:39.509	["youtube_hero"]	1	{}	\N	2026-01-28 01:03:39.509	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
a2da3f4d-a1e2-4ca1-9042-33241faafba1	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:04:59.412	2026-01-28 01:04:59.412	["youtube_hero"]	1	{}	\N	2026-01-28 01:04:59.412	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
e06dc282-9d41-4526-bedf-18cf2ef5edd4	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:05:17.403	2026-01-28 01:05:17.403	["youtube_hero"]	1	{}	\N	2026-01-28 01:05:17.403	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
56ecf272-31de-4749-bff9-84bd8dcd42e7	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:18:54.05	2026-01-28 01:18:54.05	["youtube_hero"]	1	{}	\N	2026-01-28 01:18:54.05	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
80b1cb57-ec0d-4863-bc95-fe172d95e354	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:18:58.547	2026-01-28 01:18:58.547	["youtube_hero"]	1	{}	\N	2026-01-28 01:18:58.547	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
0c675867-b0be-4b2e-97ed-dc4d0207b0ee	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:21:01.985	2026-01-28 01:21:01.985	["youtube_hero"]	1	{}	\N	2026-01-28 01:21:01.985	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
71c68194-7544-4020-957b-f8e6282cd0d0	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:24:02.947	2026-01-28 01:24:02.947	["youtube_hero"]	1	{}	\N	2026-01-28 01:24:02.947	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
962cddf4-55c3-4729-ae70-a34a372d848f	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:24:09.109	2026-01-28 01:24:09.109	["youtube_hero"]	1	{}	\N	2026-01-28 01:24:09.109	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
49bd9226-da1f-4352-9237-b8cb76a46bcd	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:25:58.139	2026-01-28 01:25:58.139	["youtube_hero"]	1	{}	\N	2026-01-28 01:25:58.139	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
b4a35461-5587-4eef-8873-b25c11421a0d	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:38:45.647	2026-01-28 01:38:45.647	["youtube_hero"]	1	{}	\N	2026-01-28 01:38:45.647	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
b1636f03-5016-4cf2-81dc-6a2589dfc6d3	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:39:54.014	2026-01-28 01:39:54.014	["youtube_hero"]	1	{}	\N	2026-01-28 01:39:54.014	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
fafc32e3-8c97-4f74-aef2-e2c057bef8cd	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:44:02.12	2026-01-28 01:44:02.12	["youtube_hero"]	1	{}	\N	2026-01-28 01:44:02.12	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
a2473583-ea26-4d47-968c-70c036b5416f	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:50:11.02	2026-01-28 01:50:11.02	["youtube_hero"]	1	{}	\N	2026-01-28 01:50:11.02	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
acacefab-2e82-411e-9a70-43a3fb8ffd7e	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:50:18.447	2026-01-28 01:50:18.447	["youtube_hero"]	1	{}	\N	2026-01-28 01:50:18.447	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
ee495232-5af3-4c7e-8cbf-76cc23ca8971	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:55:34.3	2026-01-28 01:55:34.3	["youtube_hero"]	1	{}	\N	2026-01-28 01:55:34.3	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
e432ef96-8947-43a8-b98d-eb78dbe8b905	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:56:46.897	2026-01-28 01:56:46.897	["youtube_hero"]	1	{}	\N	2026-01-28 01:56:46.897	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
35875e36-1ce2-43a1-b1f3-316d513b707b	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 01:58:29.797	2026-01-28 01:58:29.797	["youtube_hero"]	1	{}	\N	2026-01-28 01:58:29.798	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
61b738f1-dd44-48d7-bbff-f01091c19155	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 02:01:48.991	2026-01-28 02:01:48.991	["youtube_hero"]	1	{}	\N	2026-01-28 02:01:48.991	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
1db483ba-62ab-4acf-b9b1-da3b4ff7820c	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 02:03:12.474	2026-01-28 02:03:12.474	["youtube_hero"]	1	{}	\N	2026-01-28 02:03:12.474	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
c8f435b0-794b-462f-a416-cd1c4302ad35	2b7065de-f599-4c5b-95a7-61df8f91cffa	\N	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 02:05:34.496	2026-01-28 02:05:34.496	["youtube_hero"]	1	{}	\N	2026-01-28 02:05:34.496	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{}	\N	\N	\N
db0988b8-6f6c-44ec-8555-a59a80e9c48a	2b7065de-f599-4c5b-95a7-61df8f91cffa	550e8400-e29b-41d4-a716-446655440001	\N	\N	PENDING	dev-user	\N	\N	\N	2026-01-28 02:09:37.64	2026-01-28 02:09:37.64	["youtube_hero"]	1	{}	\N	2026-01-28 02:09:37.64	\N	\N	\N	\N	{}	\N	\N	\N	f	f	{"slotPositions": {"CHAR.HOST.LALA": {"x": 30, "y": 130, "width": 400, "height": 400}, "TEXT.SHOW.TITLE": {"x": 380, "y": 20}, "UI.ICON.HOLDER.MAIN": {"x": 490, "y": 360, "width": 300, "height": 300}, "BRAND.SHOW.TITLE_GRAPHIC": {"x": 380, "y": 240}, "CHAR.HOST.JUSTAWOMANINHERPRIME": {"x": 980, "y": 6.587169541017488, "width": 300, "height": 300}}, "selectedFormat": "youtube_thumbnail", "backgroundOpacity": 1}	\N	\N	\N
\.


--
-- Data for Name: thumbnail_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.thumbnail_templates (id, show_id, name, description, version, is_active, required_roles, optional_roles, conditional_roles, paired_roles, layout_config, created_at, updated_at) FROM stdin;
0d99b285-97c8-4f99-959b-3aca8f60c269	\N	Main Episode Thumbnail	Standard template for Styling Adventures episodes with role-based asset system	1	t	["CHAR.HOST.PRIMARY", "BG.MAIN"]	["CHAR.CO_HOST.PRIMARY", "CHAR.HOST.SECONDARY", "TEXT.TITLE.SECONDARY", "TEXT.SUBTITLE", "TEXT.EPISODE_NUMBER", "BG.SECONDARY", "BG.OVERLAY", "GUEST.REACTION.1", "GUEST.REACTION.2", "WARDROBE.ITEM.1", "WARDROBE.ITEM.2", "WARDROBE.ITEM.3", "WARDROBE.ITEM.4", "WARDROBE.ITEM.5", "WARDROBE.ITEM.6", "WARDROBE.ITEM.7", "WARDROBE.ITEM.8", "ICON.WARDROBE.1", "ICON.WARDROBE.2", "ICON.WARDROBE.3", "ICON.WARDROBE.4", "ICON.WARDROBE.5", "ICON.WARDROBE.6", "ICON.WARDROBE.7", "ICON.WARDROBE.8", "UI.WARDROBE.PANEL"]	{"UI.WARDROBE.PANEL": {"required_if": ["WARDROBE.ITEM.1", "WARDROBE.ITEM.2", "WARDROBE.ITEM.3", "WARDROBE.ITEM.4", "WARDROBE.ITEM.5", "WARDROBE.ITEM.6", "WARDROBE.ITEM.7", "WARDROBE.ITEM.8"]}}	{"WARDROBE.ITEM.1": "ICON.WARDROBE.1", "WARDROBE.ITEM.2": "ICON.WARDROBE.2", "WARDROBE.ITEM.3": "ICON.WARDROBE.3", "WARDROBE.ITEM.4": "ICON.WARDROBE.4", "WARDROBE.ITEM.5": "ICON.WARDROBE.5", "WARDROBE.ITEM.6": "ICON.WARDROBE.6", "WARDROBE.ITEM.7": "ICON.WARDROBE.7", "WARDROBE.ITEM.8": "ICON.WARDROBE.8"}	{"width": 1920, "height": 1080, "layers": {"lala": {"hPct": 85, "wPct": 35, "xPct": 60, "yPct": 10, "zIndex": 2}, "guest": {"hPct": 75, "wPct": 30, "xPct": 5, "yPct": 15, "zIndex": 1}, "justawomen": {"hPct": 25, "wPct": 25, "xPct": 70, "yPct": 70, "zIndex": 3}, "background_frame": {"hPct": 100, "wPct": 100, "xPct": 0, "yPct": 0, "zIndex": 0}}}	2026-01-24 20:48:41.818547	2026-01-25 11:54:58.921
\.


--
-- Data for Name: timeline_placements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.timeline_placements (id, episode_id, placement_type, asset_id, wardrobe_item_id, scene_id, attachment_point, offset_seconds, absolute_timestamp, track_number, duration, z_index, properties, "character", label, created_at, updated_at, deleted_at, visual_role) FROM stdin;
ea519209-4131-473a-bb3c-3c022a4a4080	2b7065de-f599-4c5b-95a7-61df8f91cffa	asset	9d4268c4-2d73-4d72-8ca9-cc9803392354	\N	eb0d8699-7431-49fb-b640-cf676c7e7b39	scene-start	0.000	\N	2	\N	10	{}	\N	\N	2026-02-02 06:13:11.862-05	2026-02-02 06:17:27.374-05	2026-02-02 06:17:27.374-05	primary-visual
3065e1a8-a874-42fa-ba06-46b6526bbadb	2b7065de-f599-4c5b-95a7-61df8f91cffa	asset	9d4268c4-2d73-4d72-8ca9-cc9803392354	\N	eb0d8699-7431-49fb-b640-cf676c7e7b39	scene-start	0.000	\N	2	\N	10	{}	\N	\N	2026-02-02 06:15:29.902-05	2026-02-02 06:17:31.399-05	2026-02-02 06:17:31.399-05	primary-visual
40578566-d1ce-42c4-b094-bc922b11081a	2b7065de-f599-4c5b-95a7-61df8f91cffa	asset	9d4268c4-2d73-4d72-8ca9-cc9803392354	\N	eb0d8699-7431-49fb-b640-cf676c7e7b39	scene-start	0.000	\N	2	\N	10	{}	\N	\N	2026-02-02 06:17:04.876-05	2026-02-02 06:17:36.981-05	2026-02-02 06:17:36.981-05	primary-visual
37850e41-6368-4fa7-b7fe-71297229b558	2b7065de-f599-4c5b-95a7-61df8f91cffa	asset	9d4268c4-2d73-4d72-8ca9-cc9803392354	\N	eb0d8699-7431-49fb-b640-cf676c7e7b39	scene-start	0.000	\N	2	\N	10	{}	\N	\N	2026-02-02 06:17:40.275-05	2026-02-02 06:17:40.275-05	\N	primary-visual
d5190915-b0d7-40b5-8621-2c975c484e81	2b7065de-f599-4c5b-95a7-61df8f91cffa	asset	f5fb22da-31a0-4015-92cf-b7eb853cfb3e	\N	eb0d8699-7431-49fb-b640-cf676c7e7b39	scene-start	0.000	\N	2	\N	10	{}	\N	\N	2026-02-02 06:30:07.578-05	2026-02-02 06:30:07.578-05	\N	primary-visual
bb0d9c50-dbd7-47fe-ac8a-290c2ed1a6f3	2b7065de-f599-4c5b-95a7-61df8f91cffa	wardrobe	\N	755e4cbf-13c0-4c6a-b827-b4fde888861b	eb0d8699-7431-49fb-b640-cf676c7e7b39	scene-start	0.000	\N	2	\N	10	{}	lala	\N	2026-02-02 06:27:58.496-05	2026-02-02 06:29:37.306-05	2026-02-02 06:29:37.306-05	overlay
0bfa8baa-7344-4a43-8cdb-fe23929721fc	2b7065de-f599-4c5b-95a7-61df8f91cffa	wardrobe	\N	755e4cbf-13c0-4c6a-b827-b4fde888861b	eb0d8699-7431-49fb-b640-cf676c7e7b39	scene-start	0.000	\N	2	\N	10	{}	lala	\N	2026-02-02 06:28:06.191-05	2026-02-02 06:29:40.768-05	2026-02-02 06:29:40.768-05	overlay
f8d45076-3d83-4815-b0a6-e31599949c7f	2b7065de-f599-4c5b-95a7-61df8f91cffa	wardrobe	\N	755e4cbf-13c0-4c6a-b827-b4fde888861b	eb0d8699-7431-49fb-b640-cf676c7e7b39	scene-start	0.000	\N	2	\N	10	{}	lala	\N	2026-02-02 06:23:50.773-05	2026-02-02 06:29:44.111-05	2026-02-02 06:29:44.111-05	overlay
b4e32582-f0d0-4ac0-a778-a117e5e1c9fe	2b7065de-f599-4c5b-95a7-61df8f91cffa	asset	f5fb22da-31a0-4015-92cf-b7eb853cfb3e	\N	eb0d8699-7431-49fb-b640-cf676c7e7b39	scene-start	0.000	\N	2	\N	10	{}	\N	\N	2026-02-02 14:16:32.713-05	2026-02-02 14:16:32.713-05	\N	overlay
\.


--
-- Data for Name: video_compositions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.video_compositions (id, episode_id, name, status, scenes, assets, settings, created_at, updated_at) FROM stdin;
168a8fbe-def5-4f8d-bd58-0b325330d704	2b7065de-f599-4c5b-95a7-61df8f91cffa	test	draft	[]	[{"role": "overlay", "order": 0, "asset_id": "e280ed0b-aabe-4704-b110-3af3482d27b7"}, {"role": "overlay", "order": 1, "asset_id": "e53d2a46-c19c-4730-b65e-f5026bf37f48"}, {"role": "overlay", "order": 2, "asset_id": "f00a082b-a7ba-4e3d-80c8-e0ec01324e24"}, {"role": "overlay", "order": 3, "asset_id": "9d4268c4-2d73-4d72-8ca9-cc9803392354"}, {"role": "overlay", "order": 4, "asset_id": "f5fb22da-31a0-4015-92cf-b7eb853cfb3e"}]	{"format": "youtube", "version": 129, "platform": "YouTube", "schemaVersion": 1}	2026-02-03 11:45:37.298612-05	2026-02-04 18:16:58.497946-05
\.


--
-- Data for Name: wardrobe; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wardrobe (id, name, "character", clothing_category, s3_key, s3_url, thumbnail_url, brand, price, purchase_link, website, color, size, season, occasion, outfit_set_id, outfit_set_name, scene_description, outfit_notes, times_worn, last_worn_date, is_favorite, tags, created_at, updated_at, deleted_at, s3_key_processed, s3_url_processed, description, notes, library_item_id, show_id) FROM stdin;
ccb63fba-3902-4e46-baaf-22808792663e	lalalaaaa	justawoman	dress	wardrobe/justawoman/280bed22-d88a-417a-87e1-35ec87ffc5b7.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/wardrobe/justawoman/280bed22-d88a-417a-87e1-35ec87ffc5b7.jpg	\N	kakaka	145.00	\N	\N	green	8	winter	red-carpet	\N	\N	opening scene	\N	1	2026-01-19 11:57:31.136-05	f	[]	2026-01-19 11:57:31.076-05	2026-01-19 11:57:31.137909-05	\N	\N	\N	\N	\N	\N	\N
a4864707-d2d0-437c-a168-24284a1f33e6	polka dot	lala	dress	wardrobe/lala/32295e28-8cfa-418c-b5c0-c1714a25e880.jpg	https://episode-metadata-storage-dev.s3.amazonaws.com/wardrobe/lala/32295e28-8cfa-418c-b5c0-c1714a25e880.jpg	\N	babyboo	185.00			white	m	summer						1	2026-01-19 11:07:11.74-05	t	[]	2026-01-19 11:07:11.678-05	2026-01-19 15:11:04.852659-05	\N	wardrobe/lala/32295e28-8cfa-418c-b5c0-c1714a25e880_processed.png	https://episode-metadata-storage-dev.s3.us-east-1.amazonaws.com/wardrobe/lala/32295e28-8cfa-418c-b5c0-c1714a25e880_processed.png	\N	\N	\N	\N
b2168118-dff6-4745-90ae-53b2533b634d	bgyugygygy	lala	dress	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/wardrobe/lala/f506b5c3-d5b9-404d-bfdc-1a899dec8a3a.jpg	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	f	{}	2026-01-28 16:11:38.339-05	2026-01-28 16:11:38.339-05	\N	\N	\N	\N	\N	\N	\N
bbb0199a-de5e-45c4-b003-5c4488138179	Test Dress 2	lala	dress	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/wardrobe/lala/124b2aae-879c-4f23-9225-2a9d076eb4e3.jpg	\N	\N	\N	\N	\N		\N		\N	\N	\N	\N	\N	0	\N	f	{}	2026-01-28 16:27:01.678-05	2026-01-28 16:32:57.000593-05	\N	\N	\N	\N	\N	\N	\N
755e4cbf-13c0-4c6a-b827-b4fde888861b	pink dress	lala	dress	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/wardrobe/lala/ce81a2f6-6e6d-4925-bab4-aab4aab68174.jpg	\N	\N	\N	\N	\N	\N	\N	spring	\N	\N	\N	\N	\N	0	\N	f	{}	2026-02-01 15:29:51.957-05	2026-02-01 15:29:51.957-05	\N	\N	\N	\N	\N	\N	\N
7e5f8b4f-f2fb-40fc-8d2d-2e465458e340	Test Dress	lala	dress	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	f	{}	2026-01-28 16:24:26.856-05	2026-02-01 21:05:23.864862-05	2026-02-01 21:05:23.843-05	\N	\N	\N	\N	\N	\N
dc815e96-2888-44d0-aac0-860c662f606b	test	lala	top	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	f	[]	2026-01-19 10:56:18.6-05	2026-02-01 21:05:35.044066-05	2026-02-01 21:05:35.042-05	\N	\N	\N	\N	\N	\N
d8f2e7bb-ec68-4d15-9c8c-c80f94b85d38	ffdfd	lala	dress	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/wardrobe/lala/18ddc2f3-dcd1-48db-a755-aeb9e6a886e0.jpg	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	f	{}	2026-01-28 16:21:38.098-05	2026-02-01 21:06:02.088108-05	2026-02-01 21:06:02.087-05	\N	\N	\N	\N	\N	\N
1828855a-435b-417d-ab83-41bb0d40fc78	polks	lala	dress	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/wardrobe/lala/bf066c6d-3beb-4b61-8872-e1a2f0f25d6d.jpg	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	f	{}	2026-01-28 16:01:48.055-05	2026-02-01 21:06:34.576179-05	2026-02-01 21:06:34.575-05	\N	\N	\N	\N	\N	\N
bd01fd24-aecc-48a8-bca0-7523f6e5b999	nngf	lala	dress	\N	https://episode-metadata-storage-dev.s3.amazonaws.com/wardrobe/lala/39bff5bd-9fd4-46c3-981b-56bb37b8bcb3.jpg	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	f	{}	2026-01-28 16:35:15.942-05	2026-02-01 21:07:53.41938-05	2026-02-01 21:07:53.418-05	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: wardrobe_library; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wardrobe_library (id, name, description, type, item_type, image_url, thumbnail_url, s3_key, default_character, default_occasion, default_season, color, tags, website, price, vendor, show_id, total_usage_count, last_used_at, view_count, selection_count, created_by, updated_by, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: wardrobe_library_references; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wardrobe_library_references (id, library_item_id, s3_key, reference_count, file_size, content_type, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: wardrobe_usage_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wardrobe_usage_history (id, library_item_id, episode_id, scene_id, show_id, usage_type, "character", occasion, user_id, notes, metadata, created_at) FROM stdin;
\.


--
-- Name: episode_scripts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.episode_scripts_id_seq', 7, true);


--
-- Name: metadata_storage_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.metadata_storage_id_seq', 1, false);


--
-- Name: outfit_set_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.outfit_set_items_id_seq', 1, false);


--
-- Name: outfit_sets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.outfit_sets_id_seq', 1, false);


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pgmigrations_id_seq', 26, true);


--
-- Name: script_edits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.script_edits_id_seq', 16, true);


--
-- Name: search_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.search_history_id_seq', 13, true);


--
-- Name: wardrobe_library_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.wardrobe_library_id_seq', 1, false);


--
-- Name: wardrobe_library_references_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.wardrobe_library_references_id_seq', 1, false);


--
-- Name: wardrobe_usage_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.wardrobe_usage_history_id_seq', 1, false);


--
-- Name: SequelizeMeta SequelizeMeta_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SequelizeMeta"
    ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name);


--
-- Name: asset_label_map asset_label_map_asset_id_label_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_label_map
    ADD CONSTRAINT asset_label_map_asset_id_label_id_key UNIQUE (asset_id, label_id);


--
-- Name: asset_label_map asset_label_map_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_label_map
    ADD CONSTRAINT asset_label_map_pkey PRIMARY KEY (id);


--
-- Name: asset_labels asset_labels_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_labels
    ADD CONSTRAINT asset_labels_name_key UNIQUE (name);


--
-- Name: asset_labels asset_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_labels
    ADD CONSTRAINT asset_labels_pkey PRIMARY KEY (id);


--
-- Name: asset_roles asset_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_roles
    ADD CONSTRAINT asset_roles_pkey PRIMARY KEY (id);


--
-- Name: asset_roles asset_roles_show_id_role_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_roles
    ADD CONSTRAINT asset_roles_show_id_role_key_key UNIQUE (show_id, role_key);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: composition_assets composition_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.composition_assets
    ADD CONSTRAINT composition_assets_pkey PRIMARY KEY (id);


--
-- Name: composition_outputs composition_outputs_composition_id_format_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.composition_outputs
    ADD CONSTRAINT composition_outputs_composition_id_format_key UNIQUE (composition_id, format);


--
-- Name: composition_outputs composition_outputs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.composition_outputs
    ADD CONSTRAINT composition_outputs_pkey PRIMARY KEY (id);


--
-- Name: episode_assets episode_assets_episode_id_asset_id_usage_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_assets
    ADD CONSTRAINT episode_assets_episode_id_asset_id_usage_type_key UNIQUE (episode_id, asset_id, usage_type);


--
-- Name: episode_assets episode_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_assets
    ADD CONSTRAINT episode_assets_pkey PRIMARY KEY (id);


--
-- Name: episode_outfit_items episode_outfit_items_episode_outfit_id_wardrobe_item_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_outfit_items
    ADD CONSTRAINT episode_outfit_items_episode_outfit_id_wardrobe_item_id_key UNIQUE (episode_outfit_id, wardrobe_item_id);


--
-- Name: episode_outfit_items episode_outfit_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_outfit_items
    ADD CONSTRAINT episode_outfit_items_pkey PRIMARY KEY (id);


--
-- Name: episode_outfits episode_outfits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_outfits
    ADD CONSTRAINT episode_outfits_pkey PRIMARY KEY (id);


--
-- Name: episode_scenes episode_scenes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_scenes
    ADD CONSTRAINT episode_scenes_pkey PRIMARY KEY (id);


--
-- Name: episode_scripts episode_scripts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_scripts
    ADD CONSTRAINT episode_scripts_pkey PRIMARY KEY (id);


--
-- Name: episode_wardrobe episode_wardrobe_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_wardrobe
    ADD CONSTRAINT episode_wardrobe_pkey PRIMARY KEY (id);


--
-- Name: episodes episodes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episodes
    ADD CONSTRAINT episodes_pkey PRIMARY KEY (id);


--
-- Name: metadata_storage metadata_storage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metadata_storage
    ADD CONSTRAINT metadata_storage_pkey PRIMARY KEY (id);


--
-- Name: outfit_set_items outfit_set_items_outfit_set_id_wardrobe_item_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.outfit_set_items
    ADD CONSTRAINT outfit_set_items_outfit_set_id_wardrobe_item_id_key UNIQUE (outfit_set_id, wardrobe_item_id);


--
-- Name: outfit_set_items outfit_set_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.outfit_set_items
    ADD CONSTRAINT outfit_set_items_pkey PRIMARY KEY (id);


--
-- Name: outfit_sets outfit_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.outfit_sets
    ADD CONSTRAINT outfit_sets_pkey PRIMARY KEY (id);


--
-- Name: pgmigrations pgmigrations_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pgmigrations
    ADD CONSTRAINT pgmigrations_name_unique UNIQUE (name);


--
-- Name: pgmigrations pgmigrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pgmigrations
    ADD CONSTRAINT pgmigrations_pkey PRIMARY KEY (id);


--
-- Name: scene_assets scene_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scene_assets
    ADD CONSTRAINT scene_assets_pkey PRIMARY KEY (id);


--
-- Name: scene_assets scene_assets_scene_id_asset_id_usage_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scene_assets
    ADD CONSTRAINT scene_assets_scene_id_asset_id_usage_type_key UNIQUE (scene_id, asset_id, usage_type);


--
-- Name: scene_library scene_library_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scene_library
    ADD CONSTRAINT scene_library_pkey PRIMARY KEY (id);


--
-- Name: scene_templates scene_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scene_templates
    ADD CONSTRAINT scene_templates_pkey PRIMARY KEY (id);


--
-- Name: scenes scenes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scenes
    ADD CONSTRAINT scenes_pkey PRIMARY KEY (id);


--
-- Name: script_edits script_edits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.script_edits
    ADD CONSTRAINT script_edits_pkey PRIMARY KEY (id);


--
-- Name: search_history search_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.search_history
    ADD CONSTRAINT search_history_pkey PRIMARY KEY (id);


--
-- Name: show_assets show_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.show_assets
    ADD CONSTRAINT show_assets_pkey PRIMARY KEY (id);


--
-- Name: shows shows_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shows
    ADD CONSTRAINT shows_name_key UNIQUE (name);


--
-- Name: shows shows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shows
    ADD CONSTRAINT shows_pkey PRIMARY KEY (id);


--
-- Name: shows shows_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shows
    ADD CONSTRAINT shows_slug_key UNIQUE (slug);


--
-- Name: template_studio template_studio_name_version_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.template_studio
    ADD CONSTRAINT template_studio_name_version_key UNIQUE (name, version);


--
-- Name: template_studio template_studio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.template_studio
    ADD CONSTRAINT template_studio_pkey PRIMARY KEY (id);


--
-- Name: thumbnail_compositions thumbnail_compositions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thumbnail_compositions
    ADD CONSTRAINT thumbnail_compositions_pkey PRIMARY KEY (id);


--
-- Name: thumbnail_templates thumbnail_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thumbnail_templates
    ADD CONSTRAINT thumbnail_templates_pkey PRIMARY KEY (id);


--
-- Name: timeline_placements timeline_placements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_placements
    ADD CONSTRAINT timeline_placements_pkey PRIMARY KEY (id);


--
-- Name: episode_wardrobe unique_episode_wardrobe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_wardrobe
    ADD CONSTRAINT unique_episode_wardrobe UNIQUE (episode_id, wardrobe_id);


--
-- Name: show_assets unique_show_asset; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.show_assets
    ADD CONSTRAINT unique_show_asset UNIQUE (show_id, asset_id);


--
-- Name: video_compositions video_compositions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_compositions
    ADD CONSTRAINT video_compositions_pkey PRIMARY KEY (id);


--
-- Name: wardrobe_library wardrobe_library_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe_library
    ADD CONSTRAINT wardrobe_library_pkey PRIMARY KEY (id);


--
-- Name: wardrobe_library_references wardrobe_library_references_library_item_id_s3_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe_library_references
    ADD CONSTRAINT wardrobe_library_references_library_item_id_s3_key_key UNIQUE (library_item_id, s3_key);


--
-- Name: wardrobe_library_references wardrobe_library_references_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe_library_references
    ADD CONSTRAINT wardrobe_library_references_pkey PRIMARY KEY (id);


--
-- Name: wardrobe wardrobe_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe
    ADD CONSTRAINT wardrobe_pkey PRIMARY KEY (id);


--
-- Name: wardrobe_usage_history wardrobe_usage_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe_usage_history
    ADD CONSTRAINT wardrobe_usage_history_pkey PRIMARY KEY (id);


--
-- Name: idx_air_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_air_date ON public.episodes USING btree (air_date);


--
-- Name: idx_asset_label_map_asset; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_label_map_asset ON public.asset_label_map USING btree (asset_id);


--
-- Name: idx_asset_label_map_label; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_label_map_label ON public.asset_label_map USING btree (label_id);


--
-- Name: idx_asset_labels_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_labels_name ON public.asset_labels USING btree (name);


--
-- Name: idx_asset_roles_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_roles_key ON public.asset_roles USING btree (role_key);


--
-- Name: idx_asset_roles_show; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_roles_show ON public.asset_roles USING btree (show_id);


--
-- Name: idx_assets_approval_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_approval_status ON public.assets USING btree (approval_status);


--
-- Name: idx_assets_asset_group; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_asset_group ON public.assets USING btree (asset_group);


--
-- Name: idx_assets_asset_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_asset_type ON public.assets USING btree (asset_type);


--
-- Name: idx_assets_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_deleted_at ON public.assets USING btree (deleted_at);


--
-- Name: idx_assets_episode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_episode ON public.assets USING btree (episode_id);


--
-- Name: idx_assets_file_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_file_hash ON public.assets USING btree (file_hash) WHERE ((file_hash IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_assets_file_hash_deleted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_file_hash_deleted ON public.assets USING btree (file_hash, deleted_at);


--
-- Name: idx_assets_is_global; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_is_global ON public.assets USING btree (is_global);


--
-- Name: idx_assets_metadata_episode_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_metadata_episode_id ON public.assets USING gin (((metadata -> 'episodeId'::text)));


--
-- Name: idx_assets_processing_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_processing_status ON public.assets USING btree (processing_status);


--
-- Name: idx_assets_purpose; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_purpose ON public.assets USING btree (purpose);


--
-- Name: idx_assets_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_role ON public.assets USING btree (asset_role);


--
-- Name: idx_assets_role_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_role_key ON public.assets USING btree (role_key);


--
-- Name: idx_assets_role_scope; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_role_scope ON public.assets USING btree (asset_role, asset_scope);


--
-- Name: idx_assets_show; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_show ON public.assets USING btree (show_id);


--
-- Name: idx_comp_assets_asset; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comp_assets_asset ON public.composition_assets USING btree (asset_id);


--
-- Name: idx_comp_assets_comp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comp_assets_comp ON public.composition_assets USING btree (composition_id);


--
-- Name: idx_comp_assets_comp_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_comp_assets_comp_role ON public.composition_assets USING btree (composition_id, asset_role);


--
-- Name: idx_comp_assets_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comp_assets_role ON public.composition_assets USING btree (asset_role);


--
-- Name: idx_composition_assets_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_composition_assets_deleted_at ON public.composition_assets USING btree (deleted_at);


--
-- Name: idx_composition_outputs_composition_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_composition_outputs_composition_id ON public.composition_outputs USING btree (composition_id);


--
-- Name: idx_composition_outputs_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_composition_outputs_deleted_at ON public.composition_outputs USING btree (deleted_at);


--
-- Name: idx_composition_outputs_format; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_composition_outputs_format ON public.composition_outputs USING btree (format);


--
-- Name: idx_composition_outputs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_composition_outputs_status ON public.composition_outputs USING btree (status);


--
-- Name: idx_compositions_template_studio_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compositions_template_studio_id ON public.thumbnail_compositions USING btree (template_studio_id);


--
-- Name: idx_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deleted_at ON public.episodes USING btree (deleted_at);


--
-- Name: idx_episode_assets_asset_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_assets_asset_id ON public.episode_assets USING btree (asset_id);


--
-- Name: idx_episode_assets_episode_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_assets_episode_id ON public.episode_assets USING btree (episode_id);


--
-- Name: idx_episode_assets_usage_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_assets_usage_type ON public.episode_assets USING btree (usage_type);


--
-- Name: idx_episode_outfit_items_outfit; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_outfit_items_outfit ON public.episode_outfit_items USING btree (episode_outfit_id);


--
-- Name: idx_episode_outfit_items_position; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_outfit_items_position ON public.episode_outfit_items USING btree (episode_outfit_id, "position");


--
-- Name: idx_episode_outfit_items_wardrobe; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_outfit_items_wardrobe ON public.episode_outfit_items USING btree (wardrobe_item_id);


--
-- Name: idx_episode_outfits_character; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_outfits_character ON public.episode_outfits USING btree ("character");


--
-- Name: idx_episode_outfits_episode_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_outfits_episode_id ON public.episode_outfits USING btree (episode_id);


--
-- Name: idx_episode_outfits_favorites; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_outfits_favorites ON public.episode_outfits USING btree (is_favorite) WHERE (is_favorite = true);


--
-- Name: idx_episode_outfits_source_set; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_outfits_source_set ON public.episode_outfits USING btree (source_outfit_set_id);


--
-- Name: idx_episode_scenes_episode_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_scenes_episode_id ON public.episode_scenes USING btree (episode_id);


--
-- Name: idx_episode_scenes_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_scenes_order ON public.episode_scenes USING btree (episode_id, scene_order);


--
-- Name: idx_episode_scenes_scene_library_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_scenes_scene_library_id ON public.episode_scenes USING btree (scene_library_id);


--
-- Name: idx_episode_scenes_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_scenes_type ON public.episode_scenes USING btree (type);


--
-- Name: idx_episode_scripts_author; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_scripts_author ON public.episode_scripts USING btree (author) WHERE (deleted_at IS NULL);


--
-- Name: idx_episode_scripts_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_scripts_created_at ON public.episode_scripts USING btree (created_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_episode_scripts_episode_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_scripts_episode_id ON public.episode_scripts USING btree (episode_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_episode_scripts_fulltext; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_scripts_fulltext ON public.episode_scripts USING gin (to_tsvector('english'::regconfig, ((((((COALESCE(content, ''::text) || ' '::text) || (COALESCE(version_label, ''::character varying))::text) || ' '::text) || (COALESCE(author, ''::character varying))::text) || ' '::text) || (COALESCE(script_type, ''::character varying))::text))) WHERE (deleted_at IS NULL);


--
-- Name: INDEX idx_episode_scripts_fulltext; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.idx_episode_scripts_fulltext IS 'Full-text search index for script content, version labels, author names, and script types';


--
-- Name: idx_episode_scripts_latest; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_scripts_latest ON public.episode_scripts USING btree (episode_id, script_type, is_latest) WHERE ((deleted_at IS NULL) AND (is_latest = true));


--
-- Name: idx_episode_scripts_primary; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_scripts_primary ON public.episode_scripts USING btree (episode_id, script_type, is_primary) WHERE ((deleted_at IS NULL) AND (is_primary = true));


--
-- Name: idx_episode_scripts_script_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_scripts_script_type ON public.episode_scripts USING btree (script_type) WHERE (deleted_at IS NULL);


--
-- Name: idx_episode_scripts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_scripts_status ON public.episode_scripts USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_episode_scripts_unique_primary; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_episode_scripts_unique_primary ON public.episode_scripts USING btree (episode_id, script_type) WHERE ((deleted_at IS NULL) AND (is_primary = true));


--
-- Name: idx_episode_wardrobe_approval; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_wardrobe_approval ON public.episode_wardrobe USING btree (approval_status);


--
-- Name: idx_episode_wardrobe_episode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_wardrobe_episode ON public.episode_wardrobe USING btree (episode_id);


--
-- Name: idx_episode_wardrobe_favorites; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_wardrobe_favorites ON public.episode_wardrobe USING btree (is_episode_favorite) WHERE (is_episode_favorite = true);


--
-- Name: idx_episode_wardrobe_scene_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_wardrobe_scene_id ON public.episode_wardrobe USING btree (scene_id);


--
-- Name: idx_episode_wardrobe_wardrobe; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_wardrobe_wardrobe ON public.episode_wardrobe USING btree (wardrobe_id);


--
-- Name: idx_episode_wardrobe_worn_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episode_wardrobe_worn_at ON public.episode_wardrobe USING btree (worn_at);


--
-- Name: idx_episodes_fulltext; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episodes_fulltext ON public.episodes USING gin (to_tsvector('english'::regconfig, (((((COALESCE(title, ''::character varying))::text || ' '::text) || COALESCE(description, ''::text)) || ' '::text) || COALESCE((categories)::text, ''::text))));


--
-- Name: idx_episodes_show_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_episodes_show_id ON public.episodes USING btree (show_id);


--
-- Name: idx_library_references_s3_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_library_references_s3_key ON public.wardrobe_library_references USING btree (s3_key);


--
-- Name: idx_outfit_set_items_item; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_outfit_set_items_item ON public.outfit_set_items USING btree (wardrobe_item_id);


--
-- Name: idx_outfit_set_items_set; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_outfit_set_items_set ON public.outfit_set_items USING btree (outfit_set_id);


--
-- Name: idx_outfit_sets_character; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_outfit_sets_character ON public.outfit_sets USING btree ("character");


--
-- Name: idx_outfit_sets_occasion; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_outfit_sets_occasion ON public.outfit_sets USING btree (occasion);


--
-- Name: idx_outfit_sets_season; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_outfit_sets_season ON public.outfit_sets USING btree (season);


--
-- Name: idx_outfit_sets_show_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_outfit_sets_show_id ON public.outfit_sets USING btree (show_id);


--
-- Name: idx_primary_composition_per_episode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_primary_composition_per_episode ON public.thumbnail_compositions USING btree (episode_id) WHERE (is_primary = true);


--
-- Name: idx_scene_assets_asset_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scene_assets_asset_id ON public.scene_assets USING btree (asset_id);


--
-- Name: idx_scene_assets_layer_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scene_assets_layer_order ON public.scene_assets USING btree (layer_order);


--
-- Name: idx_scene_assets_scene_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scene_assets_scene_id ON public.scene_assets USING btree (scene_id);


--
-- Name: idx_scene_assets_usage_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scene_assets_usage_type ON public.scene_assets USING btree (usage_type);


--
-- Name: idx_scene_library_characters; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scene_library_characters ON public.scene_library USING gin (characters);


--
-- Name: idx_scene_library_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scene_library_created_at ON public.scene_library USING btree (created_at);


--
-- Name: idx_scene_library_processing_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scene_library_processing_status ON public.scene_library USING btree (processing_status);


--
-- Name: idx_scene_library_show_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scene_library_show_id ON public.scene_library USING btree (show_id);


--
-- Name: idx_scene_library_tags; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scene_library_tags ON public.scene_library USING gin (tags);


--
-- Name: idx_scene_templates_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scene_templates_created_by ON public.scene_templates USING btree (created_by);


--
-- Name: idx_scene_templates_is_public; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scene_templates_is_public ON public.scene_templates USING btree (is_public);


--
-- Name: idx_scene_templates_scene_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scene_templates_scene_type ON public.scene_templates USING btree (scene_type);


--
-- Name: idx_scenes_episode_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scenes_episode_id ON public.scenes USING btree (episode_id);


--
-- Name: idx_scenes_production_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scenes_production_status ON public.scenes USING btree (production_status);


--
-- Name: idx_scenes_scene_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scenes_scene_number ON public.scenes USING btree (scene_number);


--
-- Name: idx_scenes_scene_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scenes_scene_type ON public.scenes USING btree (scene_type);


--
-- Name: idx_script_edits_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_script_edits_created_at ON public.script_edits USING btree (created_at);


--
-- Name: idx_script_edits_script_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_script_edits_script_id ON public.script_edits USING btree (script_id);


--
-- Name: idx_script_edits_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_script_edits_type ON public.script_edits USING btree (edit_type);


--
-- Name: idx_script_edits_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_script_edits_user_id ON public.script_edits USING btree (user_id);


--
-- Name: idx_search_history_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_search_history_created ON public.search_history USING btree (created_at DESC);


--
-- Name: idx_search_history_query; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_search_history_query ON public.search_history USING gin (to_tsvector('english'::regconfig, query));


--
-- Name: idx_search_history_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_search_history_user ON public.search_history USING btree (user_id, created_at DESC);


--
-- Name: idx_show_assets_asset_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_show_assets_asset_id ON public.show_assets USING btree (asset_id);


--
-- Name: idx_show_assets_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_show_assets_deleted_at ON public.show_assets USING btree (deleted_at);


--
-- Name: idx_show_assets_is_primary; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_show_assets_is_primary ON public.show_assets USING btree (show_id, is_primary) WHERE (is_primary = true);


--
-- Name: idx_show_assets_show_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_show_assets_show_id ON public.show_assets USING btree (show_id);


--
-- Name: idx_shows_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shows_deleted_at ON public.shows USING btree (deleted_at);


--
-- Name: idx_shows_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shows_is_active ON public.shows USING btree (is_active);


--
-- Name: idx_shows_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shows_slug ON public.shows USING btree (slug);


--
-- Name: idx_shows_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shows_status ON public.shows USING btree (status);


--
-- Name: idx_template_studio_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_template_studio_created_by ON public.template_studio USING btree (created_by);


--
-- Name: idx_template_studio_formats_supported; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_template_studio_formats_supported ON public.template_studio USING gin (formats_supported);


--
-- Name: idx_template_studio_locked; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_template_studio_locked ON public.template_studio USING btree (locked);


--
-- Name: idx_template_studio_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_template_studio_name ON public.template_studio USING btree (name);


--
-- Name: idx_template_studio_parent_template_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_template_studio_parent_template_id ON public.template_studio USING btree (parent_template_id);


--
-- Name: idx_template_studio_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_template_studio_status ON public.template_studio USING btree (status);


--
-- Name: idx_templates_show; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_templates_show ON public.thumbnail_templates USING btree (show_id);


--
-- Name: idx_templates_show_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_templates_show_active ON public.thumbnail_templates USING btree (show_id, is_active);


--
-- Name: idx_templates_show_version; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_templates_show_version ON public.thumbnail_templates USING btree (show_id, version);


--
-- Name: idx_thumbnail_compositions_config; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_thumbnail_compositions_config ON public.thumbnail_compositions USING gin (composition_config);


--
-- Name: idx_thumbnail_compositions_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_thumbnail_compositions_deleted_at ON public.thumbnail_compositions USING btree (deleted_at);


--
-- Name: idx_timeline_placements_episode_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_timeline_placements_episode_id ON public.timeline_placements USING btree (episode_id);


--
-- Name: idx_timeline_placements_episode_track; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_timeline_placements_episode_track ON public.timeline_placements USING btree (episode_id, track_number);


--
-- Name: idx_timeline_placements_scene_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_timeline_placements_scene_id ON public.timeline_placements USING btree (scene_id);


--
-- Name: idx_usage_history_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usage_history_created_at ON public.wardrobe_usage_history USING btree (created_at);


--
-- Name: idx_usage_history_episode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usage_history_episode ON public.wardrobe_usage_history USING btree (episode_id);


--
-- Name: idx_usage_history_library_item; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usage_history_library_item ON public.wardrobe_usage_history USING btree (library_item_id);


--
-- Name: idx_usage_history_show; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usage_history_show ON public.wardrobe_usage_history USING btree (show_id);


--
-- Name: idx_usage_history_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usage_history_type ON public.wardrobe_usage_history USING btree (usage_type);


--
-- Name: idx_video_compositions_episode_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_video_compositions_episode_id ON public.video_compositions USING btree (episode_id);


--
-- Name: idx_video_compositions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_video_compositions_status ON public.video_compositions USING btree (status);


--
-- Name: idx_wardrobe_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wardrobe_category ON public.wardrobe USING btree (clothing_category);


--
-- Name: idx_wardrobe_character; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wardrobe_character ON public.wardrobe USING btree ("character");


--
-- Name: idx_wardrobe_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wardrobe_deleted_at ON public.wardrobe USING btree (deleted_at);


--
-- Name: idx_wardrobe_is_favorite; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wardrobe_is_favorite ON public.wardrobe USING btree (is_favorite);


--
-- Name: idx_wardrobe_library_color; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wardrobe_library_color ON public.wardrobe_library USING btree (color);


--
-- Name: idx_wardrobe_library_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wardrobe_library_deleted_at ON public.wardrobe_library USING btree (deleted_at);


--
-- Name: idx_wardrobe_library_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wardrobe_library_item_id ON public.wardrobe USING btree (library_item_id);


--
-- Name: idx_wardrobe_library_item_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wardrobe_library_item_type ON public.wardrobe_library USING btree (item_type);


--
-- Name: idx_wardrobe_library_search; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wardrobe_library_search ON public.wardrobe_library USING gin (to_tsvector('english'::regconfig, (((name)::text || ' '::text) || COALESCE(description, ''::text))));


--
-- Name: idx_wardrobe_library_show_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wardrobe_library_show_id ON public.wardrobe_library USING btree (show_id);


--
-- Name: idx_wardrobe_library_tags; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wardrobe_library_tags ON public.wardrobe_library USING gin (tags);


--
-- Name: idx_wardrobe_library_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wardrobe_library_type ON public.wardrobe_library USING btree (type);


--
-- Name: idx_wardrobe_outfit_set; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wardrobe_outfit_set ON public.wardrobe USING btree (outfit_set_id);


--
-- Name: idx_wardrobe_show_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wardrobe_show_id ON public.wardrobe USING btree (show_id);


--
-- Name: idx_wardrobe_tags; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wardrobe_tags ON public.wardrobe USING gin (tags);


--
-- Name: episode_scripts episode_scripts_update_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER episode_scripts_update_timestamp BEFORE UPDATE ON public.episode_scripts FOR EACH ROW EXECUTE FUNCTION public.update_episode_scripts_timestamp();


--
-- Name: shows trigger_create_default_roles; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_create_default_roles AFTER INSERT ON public.shows FOR EACH ROW EXECUTE FUNCTION public.create_default_roles_for_show();


--
-- Name: template_studio trigger_template_studio_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_template_studio_updated_at BEFORE UPDATE ON public.template_studio FOR EACH ROW EXECUTE FUNCTION public.update_template_studio_updated_at();


--
-- Name: episode_wardrobe trigger_update_episode_wardrobe_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_episode_wardrobe_updated_at BEFORE UPDATE ON public.episode_wardrobe FOR EACH ROW EXECUTE FUNCTION public.update_episode_wardrobe_updated_at();


--
-- Name: wardrobe trigger_update_wardrobe_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_wardrobe_updated_at BEFORE UPDATE ON public.wardrobe FOR EACH ROW EXECUTE FUNCTION public.update_wardrobe_updated_at();


--
-- Name: asset_label_map asset_label_map_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_label_map
    ADD CONSTRAINT asset_label_map_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_label_map asset_label_map_label_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_label_map
    ADD CONSTRAINT asset_label_map_label_id_fkey FOREIGN KEY (label_id) REFERENCES public.asset_labels(id) ON DELETE CASCADE;


--
-- Name: asset_roles asset_roles_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_roles
    ADD CONSTRAINT asset_roles_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON DELETE CASCADE;


--
-- Name: assets assets_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: assets assets_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON DELETE CASCADE;


--
-- Name: composition_assets composition_assets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.composition_assets
    ADD CONSTRAINT composition_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: composition_assets composition_assets_composition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.composition_assets
    ADD CONSTRAINT composition_assets_composition_id_fkey FOREIGN KEY (composition_id) REFERENCES public.thumbnail_compositions(id) ON DELETE CASCADE;


--
-- Name: composition_outputs composition_outputs_composition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.composition_outputs
    ADD CONSTRAINT composition_outputs_composition_id_fkey FOREIGN KEY (composition_id) REFERENCES public.thumbnail_compositions(id) ON DELETE CASCADE;


--
-- Name: episode_assets episode_assets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_assets
    ADD CONSTRAINT episode_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: episode_assets episode_assets_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_assets
    ADD CONSTRAINT episode_assets_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: episode_outfit_items episode_outfit_items_episode_outfit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_outfit_items
    ADD CONSTRAINT episode_outfit_items_episode_outfit_id_fkey FOREIGN KEY (episode_outfit_id) REFERENCES public.episode_outfits(id) ON DELETE CASCADE;


--
-- Name: episode_outfit_items episode_outfit_items_wardrobe_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_outfit_items
    ADD CONSTRAINT episode_outfit_items_wardrobe_item_id_fkey FOREIGN KEY (wardrobe_item_id) REFERENCES public.wardrobe(id) ON DELETE CASCADE;


--
-- Name: episode_outfits episode_outfits_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_outfits
    ADD CONSTRAINT episode_outfits_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: episode_outfits episode_outfits_source_outfit_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_outfits
    ADD CONSTRAINT episode_outfits_source_outfit_set_id_fkey FOREIGN KEY (source_outfit_set_id) REFERENCES public.outfit_sets(id) ON DELETE SET NULL;


--
-- Name: episode_scenes episode_scenes_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_scenes
    ADD CONSTRAINT episode_scenes_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: episode_scenes episode_scenes_scene_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_scenes
    ADD CONSTRAINT episode_scenes_scene_library_id_fkey FOREIGN KEY (scene_library_id) REFERENCES public.scene_library(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: episode_scenes episode_scenes_scene_library_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_scenes
    ADD CONSTRAINT episode_scenes_scene_library_id_fkey1 FOREIGN KEY (scene_library_id) REFERENCES public.scene_library(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: episode_scripts episode_scripts_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_scripts
    ADD CONSTRAINT episode_scripts_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: episode_wardrobe episode_wardrobe_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_wardrobe
    ADD CONSTRAINT episode_wardrobe_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: episode_wardrobe episode_wardrobe_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_wardrobe
    ADD CONSTRAINT episode_wardrobe_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON DELETE SET NULL;


--
-- Name: episode_wardrobe episode_wardrobe_wardrobe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.episode_wardrobe
    ADD CONSTRAINT episode_wardrobe_wardrobe_id_fkey FOREIGN KEY (wardrobe_id) REFERENCES public.wardrobe(id) ON DELETE CASCADE;


--
-- Name: metadata_storage metadata_storage_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metadata_storage
    ADD CONSTRAINT metadata_storage_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: outfit_set_items outfit_set_items_outfit_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.outfit_set_items
    ADD CONSTRAINT outfit_set_items_outfit_set_id_fkey FOREIGN KEY (outfit_set_id) REFERENCES public.wardrobe_library(id) ON DELETE CASCADE;


--
-- Name: outfit_set_items outfit_set_items_wardrobe_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.outfit_set_items
    ADD CONSTRAINT outfit_set_items_wardrobe_item_id_fkey FOREIGN KEY (wardrobe_item_id) REFERENCES public.wardrobe_library(id) ON DELETE CASCADE;


--
-- Name: outfit_sets outfit_sets_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.outfit_sets
    ADD CONSTRAINT outfit_sets_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON DELETE CASCADE;


--
-- Name: scene_assets scene_assets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scene_assets
    ADD CONSTRAINT scene_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: scene_assets scene_assets_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scene_assets
    ADD CONSTRAINT scene_assets_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON DELETE CASCADE;


--
-- Name: scene_library scene_library_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scene_library
    ADD CONSTRAINT scene_library_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: scenes scenes_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scenes
    ADD CONSTRAINT scenes_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: script_edits script_edits_script_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.script_edits
    ADD CONSTRAINT script_edits_script_id_fkey FOREIGN KEY (script_id) REFERENCES public.episode_scripts(id) ON DELETE CASCADE;


--
-- Name: show_assets show_assets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.show_assets
    ADD CONSTRAINT show_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: show_assets show_assets_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.show_assets
    ADD CONSTRAINT show_assets_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON DELETE CASCADE;


--
-- Name: template_studio template_studio_parent_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.template_studio
    ADD CONSTRAINT template_studio_parent_template_id_fkey FOREIGN KEY (parent_template_id) REFERENCES public.template_studio(id) ON DELETE SET NULL;


--
-- Name: thumbnail_compositions thumbnail_compositions_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thumbnail_compositions
    ADD CONSTRAINT thumbnail_compositions_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: thumbnail_compositions thumbnail_compositions_template_studio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thumbnail_compositions
    ADD CONSTRAINT thumbnail_compositions_template_studio_id_fkey FOREIGN KEY (template_studio_id) REFERENCES public.template_studio(id) ON DELETE SET NULL;


--
-- Name: thumbnail_templates thumbnail_templates_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thumbnail_templates
    ADD CONSTRAINT thumbnail_templates_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON DELETE CASCADE;


--
-- Name: timeline_placements timeline_placements_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_placements
    ADD CONSTRAINT timeline_placements_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: timeline_placements timeline_placements_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_placements
    ADD CONSTRAINT timeline_placements_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: timeline_placements timeline_placements_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_placements
    ADD CONSTRAINT timeline_placements_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.episode_scenes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: timeline_placements timeline_placements_wardrobe_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_placements
    ADD CONSTRAINT timeline_placements_wardrobe_item_id_fkey FOREIGN KEY (wardrobe_item_id) REFERENCES public.wardrobe(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: video_compositions video_compositions_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_compositions
    ADD CONSTRAINT video_compositions_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: wardrobe wardrobe_library_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe
    ADD CONSTRAINT wardrobe_library_item_id_fkey FOREIGN KEY (library_item_id) REFERENCES public.wardrobe_library(id) ON DELETE SET NULL;


--
-- Name: wardrobe_library_references wardrobe_library_references_library_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe_library_references
    ADD CONSTRAINT wardrobe_library_references_library_item_id_fkey FOREIGN KEY (library_item_id) REFERENCES public.wardrobe_library(id) ON DELETE CASCADE;


--
-- Name: wardrobe_library wardrobe_library_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe_library
    ADD CONSTRAINT wardrobe_library_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON DELETE SET NULL;


--
-- Name: wardrobe wardrobe_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe
    ADD CONSTRAINT wardrobe_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON DELETE SET NULL;


--
-- Name: wardrobe_usage_history wardrobe_usage_history_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe_usage_history
    ADD CONSTRAINT wardrobe_usage_history_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE SET NULL;


--
-- Name: wardrobe_usage_history wardrobe_usage_history_library_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe_usage_history
    ADD CONSTRAINT wardrobe_usage_history_library_item_id_fkey FOREIGN KEY (library_item_id) REFERENCES public.wardrobe_library(id) ON DELETE CASCADE;


--
-- Name: wardrobe_usage_history wardrobe_usage_history_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe_usage_history
    ADD CONSTRAINT wardrobe_usage_history_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON DELETE SET NULL;


--
-- Name: wardrobe_usage_history wardrobe_usage_history_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe_usage_history
    ADD CONSTRAINT wardrobe_usage_history_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict TNfn2zWH0rkzpH23rqtnVj7YFBUK4nu0E9qPXHfZkI0IVEQOUK8bX4B4uwIZmbE

