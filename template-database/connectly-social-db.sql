

\set ON_ERROR_STOP on
\pset pager off

-- ---------- tunables ----------
-- database to (re)create
\if :{?db_name}
\else
  \set db_name 'connectly-social-db'
\endif
-- database the DROP/CREATE runs in
\if :{?maintenance_db}
\else
  \set maintenance_db 'defaultdb'
\endif
-- role the services log in as
\if :{?app_role}
\else
  \set app_role 'connectly'
\endif

-- ---------- session defaults ----------
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;


-- ============================================================================
--  SECTION 0 - application role
--  The dump was taken on a server where `connectly` already existed, so every
--  GRANT below had a target. A fresh host has no such role, hence this step.
-- ============================================================================

SELECT format('CREATE ROLE %I NOLOGIN', :'app_role')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role')
\gexec

-- The role only carries privileges; the services log in with their own
-- account (POSTGRES_USER). It is therefore pinned to NOLOGIN so a stray
-- password never turns it into a second way in.
SELECT format('ALTER ROLE %I NOLOGIN', :'app_role')
\gexec

-- The connected role inherits the privileges granted to the application role.
SELECT format('GRANT %I TO CURRENT_USER', :'app_role')
\gexec


-- ============================================================================
--  SECTION 1 - drop and recreate the database
--  CREATE DATABASE cannot run inside the target database, so the work happens
--  from the maintenance database and then switches over.
-- ============================================================================

\connect :maintenance_db

-- close every remaining session, otherwise DROP DATABASE refuses to proceed
SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
 WHERE datname = :'db_name'
   AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS :"db_name";
CREATE DATABASE :"db_name";

\connect :db_name


-- ============================================================================
--  SECTION 2 - schemas
-- ============================================================================

CREATE SCHEMA identity;
CREATE SCHEMA social;
CREATE SCHEMA chat;
CREATE SCHEMA notification;
CREATE SCHEMA hangfire;

SET default_tablespace = '';
SET default_table_access_method = heap;


-- ============================================================================
--  SECTION 3 - tables, views and sequences
-- ============================================================================

CREATE TABLE chat.blocked_pair_projections (
    blocker_id uuid NOT NULL,
    blocked_user_id uuid NOT NULL,
    blocked_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE chat.chat_user_settings (
    user_id uuid NOT NULL,
    message_privacy character varying(16) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE TABLE chat.conversation_members (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    last_read_at timestamp with time zone,
    last_acked_message_at timestamp with time zone
);
CREATE TABLE chat.conversations (
    id uuid NOT NULL,
    type character varying(10) NOT NULL,
    title text,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE chat.messages (
    id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    sender_user_id uuid NOT NULL,
    body character varying(8000),
    status text DEFAULT 'sent'::text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    edited_at timestamp with time zone,
    deleted_at timestamp with time zone,
    reply_to_message_id uuid
);
CREATE TABLE chat.inbox_messages (
    event_id uuid NOT NULL,
    event_type text NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE chat.message_attachments (
    id uuid NOT NULL,
    message_id uuid NOT NULL,
    object_key text NOT NULL,
    content_type text NOT NULL,
    size_bytes bigint NOT NULL,
    file_name text NOT NULL
);
CREATE TABLE chat.message_hidden_for_users (
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    hidden_at timestamp with time zone NOT NULL
);
CREATE TABLE chat.message_reactions (
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reaction_type character varying(16) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE chat.outbox_messages (
    id uuid NOT NULL,
    event_type text NOT NULL,
    payload text NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text
);
CREATE TABLE hangfire.aggregatedcounter (
    id bigint NOT NULL,
    key text NOT NULL,
    value bigint NOT NULL,
    expireat timestamp with time zone
);
CREATE TABLE hangfire.counter (
    id bigint NOT NULL,
    key text NOT NULL,
    value bigint NOT NULL,
    expireat timestamp with time zone
);
CREATE TABLE hangfire.hash (
    id bigint NOT NULL,
    key text NOT NULL,
    field text NOT NULL,
    value text,
    expireat timestamp with time zone,
    updatecount integer DEFAULT 0 NOT NULL
);
CREATE TABLE hangfire.job (
    id bigint NOT NULL,
    stateid bigint,
    statename text,
    invocationdata jsonb NOT NULL,
    arguments jsonb NOT NULL,
    createdat timestamp with time zone NOT NULL,
    expireat timestamp with time zone,
    updatecount integer DEFAULT 0 NOT NULL
);
CREATE TABLE hangfire.jobparameter (
    id bigint NOT NULL,
    jobid bigint NOT NULL,
    name text NOT NULL,
    value text,
    updatecount integer DEFAULT 0 NOT NULL
);
CREATE TABLE hangfire.jobqueue (
    id bigint NOT NULL,
    jobid bigint NOT NULL,
    queue text NOT NULL,
    fetchedat timestamp with time zone,
    updatecount integer DEFAULT 0 NOT NULL
);
CREATE TABLE hangfire.list (
    id bigint NOT NULL,
    key text NOT NULL,
    value text,
    expireat timestamp with time zone,
    updatecount integer DEFAULT 0 NOT NULL
);
CREATE TABLE hangfire.lock (
    resource text NOT NULL,
    updatecount integer DEFAULT 0 NOT NULL,
    acquired timestamp with time zone
);
CREATE TABLE hangfire.schema (
    version integer NOT NULL
);
CREATE TABLE hangfire.server (
    id text NOT NULL,
    data jsonb,
    lastheartbeat timestamp with time zone NOT NULL,
    updatecount integer DEFAULT 0 NOT NULL
);
CREATE TABLE hangfire.set (
    id bigint NOT NULL,
    key text NOT NULL,
    score double precision NOT NULL,
    value text NOT NULL,
    expireat timestamp with time zone,
    updatecount integer DEFAULT 0 NOT NULL
);
CREATE TABLE hangfire.state (
    id bigint NOT NULL,
    jobid bigint NOT NULL,
    name text NOT NULL,
    reason text,
    createdat timestamp with time zone NOT NULL,
    data jsonb,
    updatecount integer DEFAULT 0 NOT NULL
);
CREATE TABLE identity.inbox_messages (
    event_id uuid NOT NULL,
    event_type text NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE identity.outbox_messages (
    id uuid NOT NULL,
    event_type text NOT NULL,
    payload text NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text
);
CREATE TABLE identity.refresh_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    device_id character varying(64),
    device_label character varying(120),
    ip_address character varying(64),
    last_used_at timestamp with time zone,
    location character varying(160),
    user_agent character varying(400)
);
CREATE TABLE identity.user_preferences (
    user_id uuid NOT NULL,
    theme character varying(16) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE TABLE identity.users (
    id uuid NOT NULL,
    email character varying(320) NOT NULL,
    display_name character varying(120) NOT NULL,
    password_hash text NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);
CREATE TABLE notification.inbox_messages (
    event_id uuid NOT NULL,
    event_type text NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE notification.notifications (
    id uuid NOT NULL,
    recipient_user_id uuid NOT NULL,
    type text NOT NULL,
    actor_user_id uuid,
    target_post_id uuid,
    target_comment_id uuid,
    preview text,
    status text DEFAULT 'unread'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone,
    device_label character varying(120),
    ip_address character varying(64),
    location character varying(160)
);
CREATE TABLE notification.outbox_messages (
    id uuid NOT NULL,
    event_type text NOT NULL,
    payload text NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text
);
CREATE TABLE social.comment_edits (
    id uuid NOT NULL,
    comment_id uuid NOT NULL,
    editor_user_id uuid NOT NULL,
    previous_content character varying(2000),
    new_content character varying(2000),
    edited_at timestamp with time zone NOT NULL
);
CREATE TABLE social.comment_mentions (
    comment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.comment_reactions (
    comment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reaction_type character varying(32) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.comments (
    id uuid NOT NULL,
    post_id uuid NOT NULL,
    author_user_id uuid NOT NULL,
    parent_comment_id uuid,
    content text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.event_attendees (
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rsvp integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.events (
    id uuid NOT NULL,
    title character varying(140) NOT NULL,
    description character varying(5000),
    location_text character varying(240),
    online_url character varying(500),
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone,
    host_user_id uuid NOT NULL,
    group_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.friendships (
    id uuid NOT NULL,
    user_low_id uuid NOT NULL,
    user_high_id uuid NOT NULL,
    requested_by_user_id uuid NOT NULL,
    status integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    CONSTRAINT ck_friendship_order CHECK ((user_low_id < user_high_id))
);
CREATE TABLE social.group_members (
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role integer DEFAULT 3 NOT NULL,
    status integer DEFAULT 0 NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.groups (
    id uuid NOT NULL,
    name character varying(120) NOT NULL,
    description character varying(2000),
    visibility integer DEFAULT 0 NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.highlight_stories (
    highlight_id uuid NOT NULL,
    story_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);
CREATE TABLE social.highlights (
    id uuid NOT NULL,
    owner_user_id uuid NOT NULL,
    title character varying(60) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.inbox_messages (
    event_id uuid NOT NULL,
    event_type text NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.media_assets (
    id uuid NOT NULL,
    owner_user_id uuid NOT NULL,
    object_key text NOT NULL,
    content_type text NOT NULL,
    size_bytes bigint NOT NULL,
    kind text NOT NULL,
    status text DEFAULT 'pending-upload'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.outbox_messages (
    id uuid NOT NULL,
    event_type text NOT NULL,
    payload text NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text
);
CREATE TABLE social.page_admins (
    page_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role integer DEFAULT 1 NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.pages (
    id uuid NOT NULL,
    name character varying(120) NOT NULL,
    description character varying(2000),
    category character varying(80),
    avatar_object_key text,
    cover_object_key text,
    owner_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.poll_options (
    id uuid NOT NULL,
    post_id uuid NOT NULL,
    text character varying(140) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);
CREATE TABLE social.poll_votes (
    post_id uuid NOT NULL,
    option_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.polls (
    post_id uuid NOT NULL,
    question character varying(300) NOT NULL,
    allow_multiple boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.post_bookmarks (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.post_edits (
    id uuid NOT NULL,
    post_id uuid NOT NULL,
    editor_user_id uuid NOT NULL,
    previous_text character varying(5000),
    new_text character varying(5000),
    edited_at timestamp with time zone NOT NULL
);
CREATE TABLE social.post_hashtags (
    post_id uuid NOT NULL,
    tag character varying(64) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.post_media (
    id uuid NOT NULL,
    post_id uuid NOT NULL,
    object_key text NOT NULL,
    content_type text NOT NULL,
    size_bytes bigint NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);
CREATE TABLE social.post_mentions (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.post_reactions (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reaction_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.post_shares (
    id uuid NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.posts (
    id uuid NOT NULL,
    author_user_id uuid NOT NULL,
    text_content character varying(5000),
    visibility integer DEFAULT 0 NOT NULL,
    status integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    edited_at timestamp with time zone,
    deleted_at timestamp with time zone,
    group_id uuid,
    page_id uuid,
    is_reel boolean DEFAULT false NOT NULL
);
CREATE TABLE social.profiles (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    display_name character varying(120) NOT NULL,
    bio text,
    avatar_object_key text,
    cover_object_key text,
    website text,
    location_text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    username character varying(30),
    avatar_audience integer DEFAULT 0 NOT NULL,
    bio_audience integer DEFAULT 0 NOT NULL,
    birthday_audience integer DEFAULT 0 NOT NULL,
    city character varying(120),
    city_audience integer DEFAULT 0 NOT NULL,
    contact_email character varying(200),
    cover_audience integer DEFAULT 0 NOT NULL,
    date_of_birth date,
    default_post_visibility integer DEFAULT 0 NOT NULL,
    email_audience integer DEFAULT 0 NOT NULL,
    following_audience integer DEFAULT 0 NOT NULL,
    friend_list_audience integer DEFAULT 0 NOT NULL,
    friend_request_policy integer DEFAULT 0 NOT NULL,
    hometown character varying(120),
    hometown_audience integer DEFAULT 0 NOT NULL,
    location_audience integer DEFAULT 0 NOT NULL,
    phone_audience integer DEFAULT 0 NOT NULL,
    phone_number character varying(40),
    website_audience integer DEFAULT 0 NOT NULL,
    comment_audience integer DEFAULT 0 NOT NULL,
    followers_audience integer DEFAULT 0 NOT NULL,
    searchable_audience integer DEFAULT 0 NOT NULL
);
CREATE TABLE social.reel_views (
    id uuid NOT NULL,
    post_id uuid NOT NULL,
    viewer_user_id uuid NOT NULL,
    watched_ms integer DEFAULT 0 NOT NULL,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.stories (
    id uuid NOT NULL,
    author_user_id uuid NOT NULL,
    media_asset_id uuid NOT NULL,
    caption character varying(500),
    visibility integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone
);
CREATE TABLE social.story_views (
    story_id uuid NOT NULL,
    viewer_user_id uuid NOT NULL,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.user_blocks (
    blocker_id uuid NOT NULL,
    blocked_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.user_follows (
    follower_id uuid NOT NULL,
    followee_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE social.user_mutes (
    muter_id uuid NOT NULL,
    muted_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE VIEW chat.conversation_with_last_message AS
 SELECT c.id AS conversation_id,
    c.type,
    c.title,
    c.created_at AS conversation_created_at,
    m.id AS last_message_id,
    m.sender_user_id AS last_message_sender,
    m.body AS last_message_body,
    m.sent_at AS last_message_sent_at,
    m.status AS last_message_status
   FROM (chat.conversations c
     LEFT JOIN LATERAL ( SELECT messages.id,
            messages.sender_user_id,
            messages.body,
            messages.sent_at,
            messages.status
           FROM chat.messages
          WHERE (messages.conversation_id = c.id)
          ORDER BY messages.sent_at DESC
         LIMIT 1) m ON (true));
CREATE VIEW notification.unread_counts AS
 SELECT recipient_user_id,
    count(*) AS unread_count
   FROM notification.notifications
  WHERE (status = 'unread'::text)
  GROUP BY recipient_user_id;
CREATE VIEW social.user_with_profile AS
 SELECT u.id AS user_id,
    u.email,
    u.display_name AS user_display_name,
    u.status AS user_status,
    u.created_at AS user_created_at,
    p.id AS profile_id,
    p.display_name AS profile_display_name,
    p.bio,
    p.avatar_object_key,
    p.cover_object_key,
    p.website,
    p.location_text
   FROM (identity.users u
     LEFT JOIN social.profiles p ON ((p.user_id = u.id)));
CREATE SEQUENCE hangfire.aggregatedcounter_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE hangfire.counter_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE hangfire.hash_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE hangfire.job_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE hangfire.jobparameter_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE hangfire.jobqueue_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE hangfire.list_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE hangfire.set_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE hangfire.state_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ============================================================================
--  SECTION 4 - sequence defaults and sequence ownership
-- ============================================================================

ALTER TABLE ONLY hangfire.aggregatedcounter ALTER COLUMN id SET DEFAULT nextval('hangfire.aggregatedcounter_id_seq'::regclass);
ALTER TABLE ONLY hangfire.counter ALTER COLUMN id SET DEFAULT nextval('hangfire.counter_id_seq'::regclass);
ALTER TABLE ONLY hangfire.hash ALTER COLUMN id SET DEFAULT nextval('hangfire.hash_id_seq'::regclass);
ALTER TABLE ONLY hangfire.job ALTER COLUMN id SET DEFAULT nextval('hangfire.job_id_seq'::regclass);
ALTER TABLE ONLY hangfire.jobparameter ALTER COLUMN id SET DEFAULT nextval('hangfire.jobparameter_id_seq'::regclass);
ALTER TABLE ONLY hangfire.jobqueue ALTER COLUMN id SET DEFAULT nextval('hangfire.jobqueue_id_seq'::regclass);
ALTER TABLE ONLY hangfire.list ALTER COLUMN id SET DEFAULT nextval('hangfire.list_id_seq'::regclass);
ALTER TABLE ONLY hangfire.set ALTER COLUMN id SET DEFAULT nextval('hangfire.set_id_seq'::regclass);
ALTER TABLE ONLY hangfire.state ALTER COLUMN id SET DEFAULT nextval('hangfire.state_id_seq'::regclass);
ALTER SEQUENCE hangfire.aggregatedcounter_id_seq OWNED BY hangfire.aggregatedcounter.id;
ALTER SEQUENCE hangfire.counter_id_seq OWNED BY hangfire.counter.id;
ALTER SEQUENCE hangfire.hash_id_seq OWNED BY hangfire.hash.id;
ALTER SEQUENCE hangfire.job_id_seq OWNED BY hangfire.job.id;
ALTER SEQUENCE hangfire.jobparameter_id_seq OWNED BY hangfire.jobparameter.id;
ALTER SEQUENCE hangfire.jobqueue_id_seq OWNED BY hangfire.jobqueue.id;
ALTER SEQUENCE hangfire.list_id_seq OWNED BY hangfire.list.id;
ALTER SEQUENCE hangfire.set_id_seq OWNED BY hangfire.set.id;
ALTER SEQUENCE hangfire.state_id_seq OWNED BY hangfire.state.id;


-- ============================================================================
--  SECTION 5 - EF Core migration history
--  Each service has its own DbContext with HasDefaultSchema(...), so EF looks
--  for <schema>."__EFMigrationsHistory". Seeding it here stops EF from
--  replaying migrations that are already baked into this schema.
-- ============================================================================

CREATE TABLE identity."__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL
);

CREATE TABLE social."__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL
);

CREATE TABLE chat."__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL
);

CREATE TABLE notification."__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL
);

-- ============================================================================
--  SECTION 6 - data
-- ============================================================================

-- \restrict blocks the meta-commands that could turn a row value into
-- executable SQL; only the COPY statements below may run until \unrestrict.
\restrict 7fQ2mVb9XkLp4RtZ1sYwNcE6JhG3uA8Df5iO0xPqMvBnK2

COPY chat.blocked_pair_projections (blocker_id, blocked_user_id, blocked_at) FROM stdin;
\.

COPY chat.chat_user_settings (user_id, message_privacy, created_at, updated_at) FROM stdin;
\.

COPY chat.conversation_members (conversation_id, user_id, joined_at, role, last_read_at, last_acked_message_at) FROM stdin;
afaa9311-9e7c-4ba7-8faf-0ee2af41dcb9	bb9ccd00-cc78-48bb-9a87-8ae9c31420ef	2026-11-12 09:15:55.642604+07	member	\N	\N
afaa9311-9e7c-4ba7-8faf-0ee2af41dcb9	646a813a-c2f0-434a-90f3-0d489b96ca01	2026-11-12 09:15:55.682324+07	member	2026-11-12 13:47:02.097213+07	\N
aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222222	2026-11-07 21:31:12.035033+07	member	2026-11-15 10:09:58.174199+07	\N
aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	2026-11-07 21:31:12.035033+07	member	2026-11-15 12:22:33.248979+07	\N
\.

COPY chat.conversations (id, type, title, created_by_user_id, created_at, updated_at) FROM stdin;
aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	dm	\N	11111111-1111-1111-1111-111111111111	2026-11-07 21:31:12.034244+07	2026-11-07 21:31:12.034244+07
afaa9311-9e7c-4ba7-8faf-0ee2af41dcb9	dm	\N	646a813a-c2f0-434a-90f3-0d489b96ca01	2026-11-12 09:15:55.611336+07	2026-11-12 09:15:55.611366+07
\.

COPY chat.inbox_messages (event_id, event_type, processed_at) FROM stdin;
\.

COPY chat.message_attachments (id, message_id, object_key, content_type, size_bytes, file_name) FROM stdin;
d6a4e34c-4050-4eb8-ab91-b3eb7085cbba	73664089-6115-4ab8-9e4a-175c630192e2	chat-data/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/1e7a0e40-ae3d-4e47-9525-474c90712673.png	image/png	173	sample.png
b8fab447-e584-4b24-b6a4-897813daea8c	fff8e6b1-12a8-491b-87e5-b4edd4ca3fdd	chat-data/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/4fa62760-92cd-4242-aa14-22c23949e532.png	image/png	173	sample.png
971941ff-d09f-49cc-b495-d5aac59865b3	c183f9d3-e129-4b2d-b42e-32fde223fb9f	chat-data/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/9beffe03-ae0c-4118-83cb-568b1f91b5bb.png	image/png	173	sample.png
\.

COPY chat.message_hidden_for_users (message_id, user_id, hidden_at) FROM stdin;
a5ee21f0-ab78-4fdf-b47e-8f197a2c6124	11111111-1111-1111-1111-111111111111	2026-11-15 10:02:16.449275+07
46c684b9-7e7e-4377-a3e3-b617cd0f293c	11111111-1111-1111-1111-111111111111	2026-11-15 10:04:43.237264+07
009c7050-e09f-411d-9e02-a3f224889140	11111111-1111-1111-1111-111111111111	2026-11-15 10:09:53.926122+07
\.

COPY chat.message_reactions (message_id, user_id, reaction_type, created_at) FROM stdin;
\.

COPY chat.messages (id, conversation_id, sender_user_id, body, status, sent_at, edited_at, deleted_at, reply_to_message_id) FROM stdin;
98faebb6-8e90-4a11-ad65-19a0b8a31723	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	n	sent	2026-11-08 18:46:06.496537+07	\N	\N	\N
bdd83abe-bb31-41bf-96f4-11253a5e788a	afaa9311-9e7c-4ba7-8faf-0ee2af41dcb9	646a813a-c2f0-434a-90f3-0d489b96ca01	Chào em, đây là cửa sổ chat nổi!	sent	2026-11-12 09:17:24.002208+07	\N	\N	\N
4c874bb4-db89-493e-ac00-4f6fdb3aed5c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	Alo	sent	2026-11-12 09:20:37.522818+07	\N	\N	\N
31d068d5-79f8-475c-bd9a-8daba8dc7132	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	l	sent	2026-11-13 12:07:29.737133+07	\N	\N	\N
e52ecd5a-1dcf-47e0-9c03-52960354e0fb	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	ádasd	sent	2026-11-13 12:14:41.578462+07	\N	\N	\N
97ad8128-9b14-4b77-af0e-b76aa5bafee5	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	ádasd	sent	2026-11-13 12:14:42.101502+07	\N	\N	\N
035de632-00e1-417b-ab26-6464ebb7bbcf	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	sd	sent	2026-11-13 12:14:42.623554+07	\N	\N	\N
346362ee-a9d1-405c-bbfa-df91e1077c4c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	sadsad	sent	2026-11-13 12:14:43.085255+07	\N	\N	\N
3a6a9713-b4f1-4f8a-ac68-ab41d475acd8	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	sd	sent	2026-11-13 12:14:43.673477+07	\N	\N	\N
0b3d0e54-cfd9-4765-b905-98fee4f7d67e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	ă	sent	2026-11-13 12:14:44.270235+07	\N	\N	\N
9e4395d6-8d4f-4b98-b0cf-6673a91b8a11	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	đưa	sent	2026-11-13 12:14:44.923426+07	\N	\N	\N
df3fcb70-b1fa-47a1-aa30-79186692a398	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	ad	sent	2026-11-13 12:14:45.967696+07	\N	\N	\N
5043b5d4-bf09-48d2-9405-9c636da57988	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	d	sent	2026-11-13 12:16:02.605461+07	\N	\N	\N
0d39f5aa-a3a6-4c42-974d-50d98b0a185e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	dg	sent	2026-11-13 12:30:56.596202+07	\N	\N	\N
938c67a8-2a9f-4cad-a170-16ccff361671	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222222	chat-scroll-check-0512	sent	2026-11-13 12:32:38.608137+07	\N	\N	\N
fdc07fcf-8613-4e02-a5ec-034f5e94c3e4	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222222	chat-scroll-check-0513	sent	2026-11-13 12:33:25.92398+07	\N	\N	\N
63cc8af7-9c32-423f-864e-9c3e7788aab5	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222222	chat-scroll-check-0514	sent	2026-11-13 12:43:49.372436+07	\N	\N	\N
448887b0-fb52-4ca7-920b-629f2a4fa8ab	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222222	chat-scroll-check-0515	sent	2026-11-13 12:45:01.22651+07	\N	\N	\N
199d88a8-d468-4b02-b60f-52cf03d23b8c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	OK	sent	2026-11-13 22:38:19.015477+07	\N	\N	\N
462b6815-0790-4cda-982a-f4d919807be9	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	Xin chào, đây là tin nhắn kiểm tra	sent	2026-11-15 09:33:11.50331+07	\N	\N	\N
fe4d4f2c-d984-489b-ae68-cde4359fda9c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	\N	deleted	2026-11-07 21:31:12.036279+07	\N	2026-11-15 09:33:20.529871+07	\N
3b6c9077-3bc8-490b-84e2-a37885529501	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	\N	deleted	2026-11-15 09:33:16.457944+07	\N	2026-11-15 09:35:24.947694+07	\N
533d8a64-944d-449e-aec9-c1d18a3bdac4	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	ád	sent	2026-11-15 09:35:33.437479+07	\N	\N	fdc07fcf-8613-4e02-a5ec-034f5e94c3e4
1ff0732b-0050-4868-8ab0-e756307164be	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	Xin chào, đây là tin nhắn kiểm tra	sent	2026-11-15 10:01:56.766233+07	\N	\N	\N
73664089-6115-4ab8-9e4a-175c630192e2	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111		sent	2026-11-15 10:02:01.298711+07	\N	\N	\N
a5ee21f0-ab78-4fdf-b47e-8f197a2c6124	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	delete-for-me-1794711733622	sent	2026-11-15 10:02:13.745282+07	\N	\N	\N
2bc17740-db63-49da-940b-38fdca0d64c7	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	Xin chào, đây là tin nhắn kiểm tra	sent	2026-11-15 10:04:23.905553+07	\N	\N	\N
fff8e6b1-12a8-491b-87e5-b4edd4ca3fdd	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111		sent	2026-11-15 10:04:27.943799+07	\N	\N	\N
46c684b9-7e7e-4377-a3e3-b617cd0f293c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	delete-for-me-1794711880523	sent	2026-11-15 10:04:40.608984+07	\N	\N	\N
0157b4c7-5b6e-40c8-a37e-baf6cecec9fe	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	Xin chào, đây là tin nhắn kiểm tra	sent	2026-11-15 10:09:34.551066+07	\N	\N	\N
c183f9d3-e129-4b2d-b42e-32fde223fb9f	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111		sent	2026-11-15 10:09:38.631848+07	\N	\N	\N
2c682058-d081-4384-bcf0-03c1f74d98a7	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	\N	deleted	2026-11-07 21:50:00.316819+07	\N	2026-11-15 10:09:43.114852+07	\N
009c7050-e09f-411d-9e02-a3f224889140	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111111	delete-for-me-1794712191199	sent	2026-11-15 10:09:51.288408+07	\N	\N	\N
\.

COPY chat.outbox_messages (id, event_type, payload, occurred_at, processed_at, attempts, last_error) FROM stdin;
f3f59606-c6fb-48b3-91db-5da75644dd3d	chat.message-sent.v1	{"eventId":"d7960994-a64d-4729-8d82-428c9774f923","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-08T11:46:06.5537535+00:00","producer":"connectly-chat","correlationId":"ae8d68bb-bb59-4279-8b02-92f956375986","payload":{"messageId":"98faebb6-8e90-4a11-ad65-19a0b8a31723","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-08T11:46:06.4965378\\u002B00:00"}}	2026-11-08 18:46:06.553753+07	2026-11-13 11:17:04.305799+07	3311	None of the specified endpoints were reachable
0217e656-5a3d-47b1-b7c5-9d02b72cffec	chat.message-sent.v1	{"eventId":"4c54f37a-9585-49cb-a12e-e5e9c08a5704","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-13T05:07:29.8090511+00:00","producer":"connectly-chat","correlationId":"b34e7297-35a0-4fae-a0ed-94941da38644","payload":{"messageId":"31d068d5-79f8-475c-bd9a-8daba8dc7132","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-13T05:07:29.7371333\\u002B00:00"}}	2026-11-13 12:07:29.809051+07	2026-11-13 12:07:31.005037+07	0	\N
d93b5b92-4421-48de-b908-9e41a69353b5	chat.message-sent.v1	{"eventId":"893e8e32-cd41-4575-ab25-33c8d243039e","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-13T05:14:42.1016136+00:00","producer":"connectly-chat","correlationId":"6cf2cfa5-32b6-44eb-a4fa-d7bf6bf039c0","payload":{"messageId":"97ad8128-9b14-4b77-af0e-b76aa5bafee5","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-13T05:14:42.1015028\\u002B00:00"}}	2026-11-13 12:14:42.101613+07	2026-11-13 12:14:43.374583+07	0	\N
347eee5e-e15a-454b-ac94-27954e6f771e	chat.conversation-created.v1	{"eventId":"337c9630-fb6d-4c06-a146-0cb0bd1e773a","eventType":"chat.conversation-created.v1","eventVersion":1,"occurredAt":"2026-11-12T02:15:55.6844658+00:00","producer":"connectly-chat","correlationId":"555c67f5-e58c-4008-b4c6-5035fbb5c92e","payload":{"conversationId":"afaa9311-9e7c-4ba7-8faf-0ee2af41dcb9","isGroup":false,"memberUserIds":["bb9ccd00-cc78-48bb-9a87-8ae9c31420ef","646a813a-c2f0-434a-90f3-0d489b96ca01"]}}	2026-11-12 09:15:55.684465+07	2026-11-13 11:17:04.292061+07	993	None of the specified endpoints were reachable
b04f5a24-8e33-4390-b6fe-a5e47b8357bf	chat.message-sent.v1	{"eventId":"a669b404-3297-4390-8f34-65fa5ab11b14","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-12T02:17:24.0418561+00:00","producer":"connectly-chat","correlationId":"772eb4ee-ff19-4e7b-a4b1-2250e820e807","payload":{"messageId":"bdd83abe-bb31-41bf-96f4-11253a5e788a","conversationId":"afaa9311-9e7c-4ba7-8faf-0ee2af41dcb9","senderUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01","hasAttachments":false,"sentAt":"2026-11-12T02:17:24.0022081\\u002B00:00"}}	2026-11-12 09:17:24.041856+07	2026-11-13 11:17:04.298395+07	982	None of the specified endpoints were reachable
6ddb1089-b523-4e03-957c-5720b3b8007a	chat.message-sent.v1	{"eventId":"de9d699c-f212-417a-b81c-4b19a85c28dd","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-12T02:20:37.523046+00:00","producer":"connectly-chat","correlationId":"63c1a302-71b3-4fe9-800e-368186205f54","payload":{"messageId":"4c874bb4-db89-493e-ac00-4f6fdb3aed5c","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-12T02:20:37.5228184\\u002B00:00"}}	2026-11-12 09:20:37.523046+07	2026-11-13 11:17:04.301905+07	961	None of the specified endpoints were reachable
2f3e70bc-8e56-4939-9ece-7849774c8b17	chat.message-sent.v1	{"eventId":"155b044d-cb55-4b1b-a3f8-71c109f7ff42","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-13T05:14:41.5795355+00:00","producer":"connectly-chat","correlationId":"6c2d8f0b-345f-44c8-ac46-1f0d226f7e2d","payload":{"messageId":"e52ecd5a-1dcf-47e0-9c03-52960354e0fb","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-13T05:14:41.5784624\\u002B00:00"}}	2026-11-13 12:14:41.579535+07	2026-11-13 12:14:43.373568+07	0	\N
324b6f5f-1a05-4532-9477-47724a753ec4	chat.conversation-created.v1	{"eventId":"e7b7477c-d26a-491f-abe7-66f4548d00d7","eventType":"chat.conversation-created.v1","eventVersion":1,"occurredAt":"2026-11-12T04:20:25.8260995+00:00","producer":"connectly-chat","correlationId":"17972230-2e15-4a00-aef6-c2d8de50d0fc","payload":{"conversationId":"a66495bf-e205-4102-b4c1-9f128acdbb4f","isGroup":false,"memberUserIds":["646a813a-c2f0-434a-90f3-0d489b96ca01","6a584a8c-3f56-4385-8e5a-c0c7ff30e85e"]}}	2026-11-12 11:20:25.826099+07	2026-11-13 11:17:04.302893+07	630	None of the specified endpoints were reachable
5262130f-640a-48da-9d20-a1bc96853231	chat.message-sent.v1	{"eventId":"60c973ac-0f63-4aff-a30e-848bcd422ba4","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-13T05:14:42.6237637+00:00","producer":"connectly-chat","correlationId":"4840a271-2567-4696-bc5c-b8e903c7f5d9","payload":{"messageId":"035de632-00e1-417b-ab26-6464ebb7bbcf","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-13T05:14:42.6235541\\u002B00:00"}}	2026-11-13 12:14:42.623763+07	2026-11-13 12:14:43.375609+07	0	\N
4dd61711-8d6d-44c7-98ff-6adf5a01de09	chat.message-sent.v1	{"eventId":"cb553948-b711-4780-afdd-f5c4a2af01ad","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-13T05:14:43.0854695+00:00","producer":"connectly-chat","correlationId":"95c06257-fdd1-41b3-bc14-76d0cfe8fa9d","payload":{"messageId":"346362ee-a9d1-405c-bbfa-df91e1077c4c","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-13T05:14:43.0852557\\u002B00:00"}}	2026-11-13 12:14:43.085469+07	2026-11-13 12:14:43.376679+07	0	\N
cc82e77b-f986-437d-bcb2-e910682540b5	chat.message-sent.v1	{"eventId":"1e062a1c-437d-44cb-8d19-041c54be5bed","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-13T05:14:44.2703628+00:00","producer":"connectly-chat","correlationId":"7ccab0f7-da3d-4790-b535-29d6bfb23e21","payload":{"messageId":"0b3d0e54-cfd9-4765-b905-98fee4f7d67e","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-13T05:14:44.2702351\\u002B00:00"}}	2026-11-13 12:14:44.270362+07	2026-11-13 12:14:45.383254+07	0	\N
ae365aad-6de4-4b14-8f65-8fb5933d6218	chat.message-sent.v1	{"eventId":"35ebd2a9-258e-4d79-ab3e-8e4f011766e6","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-13T05:14:44.9236201+00:00","producer":"connectly-chat","correlationId":"8bffee49-2599-4c3c-9a71-b6ad3f719426","payload":{"messageId":"9e4395d6-8d4f-4b98-b0cf-6673a91b8a11","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-13T05:14:44.9234261\\u002B00:00"}}	2026-11-13 12:14:44.92362+07	2026-11-13 12:14:45.384233+07	0	\N
6d8fa55f-758b-467b-8a30-f7e903c79dbe	chat.message-sent.v1	{"eventId":"c3a8cc36-0945-4a98-85cf-11941895ed93","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-13T05:14:43.6736893+00:00","producer":"connectly-chat","correlationId":"1c81aaad-a6e7-49f7-9615-325c519fa511","payload":{"messageId":"3a6a9713-b4f1-4f8a-ac68-ab41d475acd8","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-13T05:14:43.6734778\\u002B00:00"}}	2026-11-13 12:14:43.673689+07	2026-11-13 12:14:45.381099+07	0	\N
51ee231d-1c99-43c6-b01a-12c11bd71564	chat.message-sent.v1	{"eventId":"13d7f635-6d66-49bb-b1ff-e9d38115ba01","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-15T02:33:11.6343083+00:00","producer":"connectly-chat","correlationId":"5a87ff50-fac0-4871-b4b7-d25fa1a63786","payload":{"messageId":"462b6815-0790-4cda-982a-f4d919807be9","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-15T02:33:11.5033109\\u002B00:00"}}	2026-11-15 09:33:11.634308+07	2026-11-15 09:33:12.556583+07	0	\N
a9520a97-6c5f-4c46-b29a-61629f986bb1	chat.message-sent.v1	{"eventId":"a8e4e2a9-557e-4ac5-98e8-de3502fdaf5a","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-13T05:14:45.9678854+00:00","producer":"connectly-chat","correlationId":"3d463348-c60d-4c7d-80c0-bdb5cf9a8dd4","payload":{"messageId":"df3fcb70-b1fa-47a1-aa30-79186692a398","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-13T05:14:45.9676962\\u002B00:00"}}	2026-11-13 12:14:45.967885+07	2026-11-13 12:14:47.429765+07	0	\N
9ed32cb2-4453-407d-b346-699729341536	chat.message-sent.v1	{"eventId":"355b7d16-0106-4aad-9ab6-8b5eccf3cdb3","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-13T05:16:02.6056373+00:00","producer":"connectly-chat","correlationId":"b85ee1e1-c301-42fb-a585-14ff2da8ef9d","payload":{"messageId":"5043b5d4-bf09-48d2-9405-9c636da57988","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-13T05:16:02.6054619\\u002B00:00"}}	2026-11-13 12:16:02.605637+07	2026-11-13 12:16:03.803886+07	0	\N
ff454bee-6209-4866-aae3-e70883b4a7d7	chat.message-sent.v1	{"eventId":"bccdfc7e-a7ab-4897-9e2b-9db91c659550","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-15T02:33:16.4932651+00:00","producer":"connectly-chat","correlationId":"375b4b1c-a433-4738-a261-f9223cd5c1e2","payload":{"messageId":"3b6c9077-3bc8-490b-84e2-a37885529501","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":true,"sentAt":"2026-11-15T02:33:16.4579442\\u002B00:00"}}	2026-11-15 09:33:16.493265+07	2026-11-15 09:33:16.627302+07	0	\N
fb36d688-4bf4-42fe-99d9-914089acf14a	chat.message-sent.v1	{"eventId":"1df1ea8e-9042-4599-917a-93ef2bcb9f7d","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-13T05:30:56.5964847+00:00","producer":"connectly-chat","correlationId":"1d9446b1-1d8a-4951-a5a0-1592d29350d5","payload":{"messageId":"0d39f5aa-a3a6-4c42-974d-50d98b0a185e","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-13T05:30:56.5962021\\u002B00:00"}}	2026-11-13 12:30:56.596484+07	2026-11-13 12:30:58.204538+07	0	\N
294c4095-71df-4b3b-999c-99fdbfd62430	chat.message-sent.v1	{"eventId":"3d091506-f66a-4326-a8c2-d8b488f80ef8","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-15T02:35:33.485607+00:00","producer":"connectly-chat","correlationId":"a10fe1fa-8b23-4b2b-bb08-3750181170ff","payload":{"messageId":"533d8a64-944d-449e-aec9-c1d18a3bdac4","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-15T02:35:33.4374795\\u002B00:00"}}	2026-11-15 09:35:33.485607+07	2026-11-15 09:35:33.885288+07	0	\N
c3f68cbc-a5d5-4570-bbf5-669529b5e160	chat.message-sent.v1	{"eventId":"32719e48-c5f6-40e0-b95d-75b03d804ca7","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-13T05:32:38.6082902+00:00","producer":"connectly-chat","correlationId":"0c28ac44-b843-4057-9388-dfdc5ac146e1","payload":{"messageId":"938c67a8-2a9f-4cad-a170-16ccff361671","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"22222222-2222-2222-2222-222222222222","hasAttachments":false,"sentAt":"2026-11-13T05:32:38.6081373\\u002B00:00"}}	2026-11-13 12:32:38.60829+07	2026-11-13 12:32:38.806985+07	0	\N
b0890e8c-69bd-45a9-9778-2b878d4e6735	chat.message-sent.v1	{"eventId":"d6dc9bbe-59b1-4f14-8949-df9d577a5895","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-15T03:02:13.7457101+00:00","producer":"connectly-chat","correlationId":"cb9890fe-ca6e-4c2f-ad64-46c3ddcc06e9","payload":{"messageId":"a5ee21f0-ab78-4fdf-b47e-8f197a2c6124","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-15T03:02:13.7452826\\u002B00:00"}}	2026-11-15 10:02:13.74571+07	2026-11-15 10:02:14.33786+07	0	\N
39db7886-4d4b-49b2-8db4-8eb21e767aa7	chat.message-sent.v1	{"eventId":"b0145110-e8a1-40b3-8480-ea58210ba7fc","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-13T05:33:25.9241202+00:00","producer":"connectly-chat","correlationId":"34b88234-7246-48f5-99fe-5c46873f1154","payload":{"messageId":"fdc07fcf-8613-4e02-a5ec-034f5e94c3e4","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"22222222-2222-2222-2222-222222222222","hasAttachments":false,"sentAt":"2026-11-13T05:33:25.9239809\\u002B00:00"}}	2026-11-13 12:33:25.92412+07	2026-11-13 12:33:27.061547+07	0	\N
dc736b5c-83a7-40a8-8822-901e465df23e	chat.message-sent.v1	{"eventId":"f05ce11c-623b-41a5-ac50-25fb591401a7","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-13T05:43:49.3731008+00:00","producer":"connectly-chat","correlationId":"04870ee0-5cb3-4b0c-b3bd-a735db75f4d8","payload":{"messageId":"63cc8af7-9c32-423f-864e-9c3e7788aab5","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"22222222-2222-2222-2222-222222222222","hasAttachments":false,"sentAt":"2026-11-13T05:43:49.3724361\\u002B00:00"}}	2026-11-13 12:43:49.3731+07	2026-11-13 12:43:50.139009+07	0	\N
68c03abe-96c4-4edf-a6f9-eea07fac2240	chat.message-sent.v1	{"eventId":"64a4a8e9-27d5-4e7b-98ef-577e3bc639d4","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-15T03:04:23.9057293+00:00","producer":"connectly-chat","correlationId":"9a2f63ac-5670-4c27-b61a-cbb834ec1010","payload":{"messageId":"2bc17740-db63-49da-940b-38fdca0d64c7","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-15T03:04:23.9055539\\u002B00:00"}}	2026-11-15 10:04:23.905729+07	2026-11-15 10:04:25.114403+07	0	\N
17c7a9b0-b1b2-47ce-8c14-a4e5298cc5a9	chat.message-sent.v1	{"eventId":"f85d0449-7bb5-4a53-aead-508529644120","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-13T05:45:01.2266334+00:00","producer":"connectly-chat","correlationId":"55829fd5-a352-4abd-9e89-449ac2bf60ac","payload":{"messageId":"448887b0-fb52-4ca7-920b-629f2a4fa8ab","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"22222222-2222-2222-2222-222222222222","hasAttachments":false,"sentAt":"2026-11-13T05:45:01.2265107\\u002B00:00"}}	2026-11-13 12:45:01.226633+07	2026-11-13 12:45:02.519501+07	0	\N
430dd1b6-cc7b-4f47-87d2-c1d348719365	chat.message-sent.v1	{"eventId":"86b6eca4-01e7-49d4-81b6-04c742db654b","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-13T15:38:19.0653801+00:00","producer":"connectly-chat","correlationId":"b3af6d34-7b8f-40b7-a275-9ac5bd7277af","payload":{"messageId":"199d88a8-d468-4b02-b60f-52cf03d23b8c","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-13T15:38:19.0154774\\u002B00:00"}}	2026-11-13 22:38:19.06538+07	2026-11-15 09:19:40.235635+07	49761	Already closed: The AMQP operation was interrupted: AMQP close-reason, initiated by Peer, code=530, text='NOT_ALLOWED - access to vhost '/' refused for user 'connectly'', classId=10, methodId=40
49eb9c71-9a5a-4431-81ed-62556ed2b81e	chat.message-sent.v1	{"eventId":"91817efd-f0e4-44ba-974b-9ebe0125ced6","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-15T03:01:56.8217337+00:00","producer":"connectly-chat","correlationId":"ae518b86-3e0c-44a3-879f-e47a6340db6c","payload":{"messageId":"1ff0732b-0050-4868-8ab0-e756307164be","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-15T03:01:56.7662332\\u002B00:00"}}	2026-11-15 10:01:56.821733+07	2026-11-15 10:01:58.228807+07	0	\N
24285d13-0043-464f-86f9-e174db7e5917	chat.message-sent.v1	{"eventId":"844a2837-b8e2-4c81-9c4b-798dab422a42","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-15T03:02:01.3215695+00:00","producer":"connectly-chat","correlationId":"87668a5d-2169-4d13-86d6-2d73f76b22fa","payload":{"messageId":"73664089-6115-4ab8-9e4a-175c630192e2","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":true,"sentAt":"2026-11-15T03:02:01.2987115\\u002B00:00"}}	2026-11-15 10:02:01.321569+07	2026-11-15 10:02:02.262777+07	0	\N
f8595345-8055-4341-a633-f670d3909b92	chat.message-sent.v1	{"eventId":"dc17a822-e699-40ae-aa32-144f297fb018","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-15T03:04:27.9440576+00:00","producer":"connectly-chat","correlationId":"b00e433e-9bbb-4ed2-9bc3-4e44640af2e2","payload":{"messageId":"fff8e6b1-12a8-491b-87e5-b4edd4ca3fdd","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":true,"sentAt":"2026-11-15T03:04:27.9437994\\u002B00:00"}}	2026-11-15 10:04:27.944057+07	2026-11-15 10:04:29.138531+07	0	\N
32a84e69-3eb5-4b85-9336-091f7faef6d6	chat.message-sent.v1	{"eventId":"eb80c4db-1cc4-4d61-a9b1-e478abd66275","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-15T03:04:40.6094978+00:00","producer":"connectly-chat","correlationId":"44b92c8f-2efa-487a-bc40-d308f7a387ea","payload":{"messageId":"46c684b9-7e7e-4377-a3e3-b617cd0f293c","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-15T03:04:40.6089844\\u002B00:00"}}	2026-11-15 10:04:40.609497+07	2026-11-15 10:04:41.197029+07	0	\N
7e07bf36-4c70-46b6-9359-3c62dfde54ff	chat.message-sent.v1	{"eventId":"cfe56f21-b744-4667-b4fa-31acacba49f4","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-15T03:09:34.5931488+00:00","producer":"connectly-chat","correlationId":"2ddab5e0-030a-417e-9bd5-de3892e3df33","payload":{"messageId":"0157b4c7-5b6e-40c8-a37e-baf6cecec9fe","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-15T03:09:34.5510669\\u002B00:00"}}	2026-11-15 10:09:34.593148+07	2026-11-15 10:09:35.386477+07	0	\N
a89468be-762f-45c8-9456-a3729ac05d0a	chat.message-sent.v1	{"eventId":"60309e8b-2994-4880-bb34-6116ffe6a2bc","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-15T03:09:38.6531526+00:00","producer":"connectly-chat","correlationId":"396a45c3-774a-400e-925f-a9d8d85b5aca","payload":{"messageId":"c183f9d3-e129-4b2d-b42e-32fde223fb9f","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":true,"sentAt":"2026-11-15T03:09:38.6318486\\u002B00:00"}}	2026-11-15 10:09:38.653152+07	2026-11-15 10:09:39.417669+07	0	\N
51ba3faf-43c4-4426-8e5b-582d58ba1ee9	chat.message-sent.v1	{"eventId":"332e9d8c-9253-479d-bbd2-59ab5db2a1d4","eventType":"chat.message-sent.v1","eventVersion":1,"occurredAt":"2026-11-15T03:09:51.2886451+00:00","producer":"connectly-chat","correlationId":"48767982-454e-46f5-9496-700af0c420fd","payload":{"messageId":"009c7050-e09f-411d-9e02-a3f224889140","conversationId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","senderUserId":"11111111-1111-1111-1111-111111111111","hasAttachments":false,"sentAt":"2026-11-15T03:09:51.2884081\\u002B00:00"}}	2026-11-15 10:09:51.288645+07	2026-11-15 10:09:51.510689+07	0	\N
\.

COPY hangfire.aggregatedcounter (id, key, value, expireat) FROM stdin;
1	stats:succeeded:2026-11-11	1	2026-12-11 18:58:11.119676+07
4	stats:succeeded:2026-11-12	1	2026-12-12 09:12:15.70205+07
8	stats:succeeded:2026-11-13	1	2026-12-13 10:54:00.916204+07
10	stats:succeeded:2026-11-14-13	1	2026-11-15 20:55:56.414514+07
12	stats:succeeded:2026-11-14	1	2026-12-14 20:55:55.414514+07
13	stats:succeeded:2026-11-15	1	2026-12-15 08:46:20.238108+07
14	stats:succeeded:2026-11-15-01	1	2026-11-16 08:46:21.238108+07
3	stats:succeeded	5	\N
\.

COPY hangfire.counter (id, key, value, expireat) FROM stdin;
\.

COPY hangfire.hash (id, key, field, value, expireat, updatecount) FROM stdin;
1	recurring-job:media-reconciliation	Queue	default	\N	0
2	recurring-job:media-reconciliation	Cron	0 0 * * *	\N	0
3	recurring-job:media-reconciliation	TimeZoneId	UTC	\N	0
4	recurring-job:media-reconciliation	Job	{"t":"Social.Jobs.MediaReconciliationJob, Social.API","m":"MarkOrphanedMediaAssetsAsync"}	\N	0
5	recurring-job:media-reconciliation	CreatedAt	1794109542074	\N	0
7	recurring-job:media-reconciliation	V	2	\N	0
8	recurring-job:media-reconciliation	LastExecution	1794707179768	\N	0
6	recurring-job:media-reconciliation	NextExecution	1794787200000	\N	0
9	recurring-job:media-reconciliation	LastJobId	5	\N	0
\.

COPY hangfire.job (id, stateid, statename, invocationdata, arguments, createdat, expireat, updatecount) FROM stdin;
5	15	Succeeded	{"Type": "Social.Jobs.MediaReconciliationJob, Social.API", "Method": "MarkOrphanedMediaAssetsAsync", "Arguments": "[]", "ParameterTypes": "[]"}	[]	2026-11-15 08:46:19.874716+07	2026-11-16 08:46:21.238108+07	0
4	12	Succeeded	{"Type": "Social.Jobs.MediaReconciliationJob, Social.API", "Method": "MarkOrphanedMediaAssetsAsync", "Arguments": "[]", "ParameterTypes": "[]"}	[]	2026-11-14 20:55:54.842015+07	2026-11-15 20:55:56.414514+07	0
\.

COPY hangfire.jobparameter (id, jobid, name, value, updatecount) FROM stdin;
10	4	RecurringJobId	"media-reconciliation"	0
11	4	Time	1794664554	0
12	4	CurrentCulture	"en-US"	0
13	5	RecurringJobId	"media-reconciliation"	0
14	5	Time	1794707179	0
15	5	CurrentCulture	"en-US"	0
\.

COPY hangfire.jobqueue (id, jobid, queue, fetchedat, updatecount) FROM stdin;
\.

COPY hangfire.list (id, key, value, expireat, updatecount) FROM stdin;
\.

COPY hangfire.lock (resource, updatecount, acquired) FROM stdin;
\.

COPY hangfire.schema (version) FROM stdin;
23
\.

COPY hangfire.server (id, data, lastheartbeat, updatecount) FROM stdin;
desktop-bvni872:7664:93cef9dd-e340-40f1-8c20-b5a9682d6943	{"Queues": ["default"], "StartedAt": "2026-11-15T11:19:24.7859381Z", "WorkerCount": 20}	2026-11-15 18:20:54.861503+07	0
desktop-bvni872:8960:48ca0158-8967-4816-9509-52304d35cfbe	{"Queues": ["default"], "StartedAt": "2026-11-15T10:59:14.1466218Z", "WorkerCount": 20}	2026-11-15 18:18:44.653146+07	0
\.

COPY hangfire.set (id, key, score, value, expireat, updatecount) FROM stdin;
1	recurring-jobs	1794787200	media-reconciliation	\N	0
\.

COPY hangfire.state (id, jobid, name, reason, createdat, data, updatecount) FROM stdin;
10	4	Enqueued	Triggered by recurring job scheduler	2026-11-14 20:55:54.957656+07	{"Queue": "default", "EnqueuedAt": "1794664554931"}	0
11	4	Processing	\N	2026-11-14 20:55:55.041698+07	{"ServerId": "desktop-bvni872:4132:e94c9c34-9c72-4ad9-a4d9-1f35f9d0e107", "WorkerId": "a03ba2d7-c09c-4403-af99-eaf22562b2dc", "StartedAt": "1794664555003"}	0
12	4	Succeeded	\N	2026-11-14 20:55:56.420486+07	{"Latency": "207", "SucceededAt": "1794664556391", "PerformanceDuration": "1340"}	0
13	5	Enqueued	Triggered by recurring job scheduler	2026-11-15 08:46:19.978985+07	{"Queue": "default", "EnqueuedAt": "1794707179947"}	0
14	5	Processing	\N	2026-11-15 08:46:20.048648+07	{"ServerId": "desktop-bvni872:2516:0d666fe6-6f45-42ce-906c-133e0ccceba0", "WorkerId": "1f876ce7-a282-4a18-a15f-06d9bbd11d54", "StartedAt": "1794707180023"}	0
15	5	Succeeded	\N	2026-11-15 08:46:21.242202+07	{"Latency": "181", "SucceededAt": "1794707181218", "PerformanceDuration": "1161"}	0
\.

COPY identity.inbox_messages (event_id, event_type, processed_at) FROM stdin;
\.

COPY identity.outbox_messages (id, event_type, payload, occurred_at, processed_at, attempts, last_error) FROM stdin;
96ed6ef9-8103-4126-9d7c-f11e1ed820ff	identity.user-registered.v1	{"eventId":"12ea29b1-b328-4112-91e2-a797fcca3370","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-12T02:15:55.1572578+00:00","producer":"connectly-identity","correlationId":"561e763b-930e-4157-93c0-0c01db351e61","payload":{"userId":"bb9ccd00-cc78-48bb-9a87-8ae9c31420ef","email":"dockdemo.16585@example.com","displayName":"Dock Demo"}}	2026-11-12 09:15:55.157257+07	2026-11-15 12:33:28.00715+07	0	\N
95d2ad52-f723-4607-aa5a-233ec8165acb	identity.user-registered.v1	{"eventId":"49c63670-71a5-4e0b-bf86-99561536bced","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-12T03:15:27.8428304+00:00","producer":"connectly-identity","correlationId":"ca6f5527-5875-4f4c-886d-0a40478a15c9","payload":{"userId":"45f8055f-6fa5-4fb3-8a0c-28f838a926e5","email":"prefs.32165@example.com","displayName":"Prefs Tester"}}	2026-11-12 10:15:27.84283+07	2026-11-15 12:33:28.010673+07	0	\N
c3d5148b-f741-4e86-8d45-0f51977dc33d	identity.user-registered.v1	{"eventId":"ac10dc45-0ec2-4334-8416-39c1cd7955aa","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-12T04:18:01.1153714+00:00","producer":"connectly-identity","correlationId":"7effb3f2-c7a2-42bb-afaf-83dff42badda","payload":{"userId":"6a584a8c-3f56-4385-8e5a-c0c7ff30e85e","email":"priv487022@example.com","displayName":"Privacy Tester"}}	2026-11-12 11:18:01.115371+07	2026-11-15 12:33:28.012317+07	0	\N
e25abfb9-3af5-4528-8ca9-aec5757f4a6d	identity.user-registered.v1	{"eventId":"8c8e72b7-5971-4c63-8d36-e55e8301c072","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-12T04:28:00.1447989+00:00","producer":"connectly-identity","correlationId":"98b2aa58-f13b-4ba5-ad27-c226d1924418","payload":{"userId":"bcecf2e5-7d78-41c7-82e8-f538376bb749","email":"av1794457679@example.com","displayName":"Avatar Viewer"}}	2026-11-12 11:28:00.144798+07	2026-11-15 12:33:28.014411+07	0	\N
7cf955b5-4f8b-4506-b240-e0e9210ae021	identity.user-registered.v1	{"eventId":"b18bac21-8668-4a7a-884c-b626093bc727","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-12T04:37:39.2182378+00:00","producer":"connectly-identity","correlationId":"52779afd-7f29-4bb5-9255-e1d5de0bc727","payload":{"userId":"f40ca11b-c19c-4fd2-b071-2a0e5347f408","email":"str1794458259@example.com","displayName":"Search Stranger"}}	2026-11-12 11:37:39.218237+07	2026-11-15 12:33:28.01691+07	0	\N
9d6c4b92-7c7a-44ec-a117-15c1ad87f645	identity.user-registered.v1	{"eventId":"b578d640-2e15-42a2-9e08-55537b255967","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-12T04:37:39.4728228+00:00","producer":"connectly-identity","correlationId":"144a4bd0-bd69-4388-b898-9af82e9765bb","payload":{"userId":"d34a8c37-724d-4f9b-9aa1-0a137112558c","email":"fr1794458259@example.com","displayName":"Search Friend"}}	2026-11-12 11:37:39.472822+07	2026-11-15 12:33:28.019231+07	0	\N
7d426ea5-e31f-4afd-a2e0-de147f48e37f	identity.user-registered.v1	{"eventId":"0d2b8fbc-9777-4a74-952c-72ed0c0119da","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-12T04:38:48.4193659+00:00","producer":"connectly-identity","correlationId":"add56918-0a23-492d-b85b-f04d1f3c3e20","payload":{"userId":"4b0d8cd7-7bcf-43a4-9335-714032332d3f","email":"s1794458328@example.com","displayName":"Follower Probe"}}	2026-11-12 11:38:48.419365+07	2026-11-15 12:33:28.021058+07	0	\N
0430f1cc-321b-4a6d-81be-b3add9b03a3b	identity.user-registered.v1	{"eventId":"4cc6708d-5cd3-43b2-ae63-49eb1cddd3a5","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-12T06:30:17.4255438+00:00","producer":"connectly-identity","correlationId":"611d45fd-e3a1-4eda-8425-de255dc397a6","payload":{"userId":"b156a3e1-4f32-4e3f-a3f1-7c3b10028695","email":"welcomeprobe1794465015@example.com","displayName":"Welcome Probe"}}	2026-11-12 13:30:17.425543+07	2026-11-15 12:33:28.022895+07	0	\N
3ce25d67-14b8-42f3-bad2-fe83e75e951d	identity.user-registered.v1	{"eventId":"dc35ef1e-dea8-426f-b8e9-ac607e3bdd04","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-15T02:01:10.0463869+00:00","producer":"connectlyidentity","correlationId":"74c7fcf4-c199-49b6-9ac0-1fc282227111","payload":{"userId":"1c00e370-553a-4b57-814a-750592bde749","email":"chat-alice-1794708064955-743@example.com","displayName":"Chat alice"}}	2026-11-15 09:01:10.046386+07	2026-11-15 12:33:28.024554+07	0	\N
64502b24-cdca-489b-8182-d012a7acaa65	identity.user-registered.v1	{"eventId":"9b70ddaf-bf47-43d0-a3ca-c2e6d90fb808","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-15T02:01:16.2000125+00:00","producer":"connectlyidentity","correlationId":"5483a39d-32cc-4b93-b175-8cc1ce7ce215","payload":{"userId":"f270f4b2-47d8-43af-87e6-b26b4f461be1","email":"chat-bob-1794708074577-781@example.com","displayName":"Chat bob"}}	2026-11-15 09:01:16.200012+07	2026-11-15 12:33:28.026396+07	0	\N
168e98c1-8603-4269-8f0d-40fb876ee17b	identity.user-registered.v1	{"eventId":"dcf402ee-101a-4ab1-9a98-463d20cd8ad5","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-15T02:05:51.7189212+00:00","producer":"connectlyidentity","correlationId":"16ce12e5-7568-4717-9515-0e18525e7866","payload":{"userId":"84b454c4-cec0-48da-9bab-2e9c3d6fb757","email":"chat-alice-1794708348372-492@example.com","displayName":"Chat alice"}}	2026-11-15 09:05:51.718921+07	2026-11-15 12:33:28.027978+07	0	\N
10f960ea-3b95-4e8b-a945-ab79a1a0cbeb	identity.user-registered.v1	{"eventId":"a0df42c3-c85e-4915-a5d0-2d48e4087540","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-15T02:05:55.1821921+00:00","producer":"connectlyidentity","correlationId":"fc3efa20-14c4-4138-a279-3c5d3f9b38c0","payload":{"userId":"fd4df0cb-5588-4e33-a2ca-b7a80154d8c9","email":"chat-bob-1794708353850-83@example.com","displayName":"Chat bob"}}	2026-11-15 09:05:55.182192+07	2026-11-15 12:33:28.029756+07	0	\N
8c60b7d4-9077-48fa-9ba7-be4f4946da6f	identity.user-registered.v1	{"eventId":"16958341-bb3e-4aa3-9b3f-aaf54def22a3","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-15T02:12:42.3674356+00:00","producer":"connectlyidentity","correlationId":"b790a046-b835-43c3-af69-faf71d4f4bc1","payload":{"userId":"7853e257-27a1-4a2a-bf4b-1db151e13ff4","email":"chat-alice-1794708754081-232@example.com","displayName":"Chat alice"}}	2026-11-15 09:12:42.367435+07	2026-11-15 12:33:28.031631+07	0	\N
6f84192c-996a-4116-8caa-5587e8accc65	identity.user-registered.v1	{"eventId":"d104875d-c7dd-41db-8e87-960f255ff6ff","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-15T02:12:48.2965242+00:00","producer":"connectlyidentity","correlationId":"55f3a979-e76b-4fbd-b8f8-012025e4d5ca","payload":{"userId":"6f6e2f8b-a1bc-415e-a5bb-c3d1485503f9","email":"chat-bob-1794708766191-726@example.com","displayName":"Chat bob"}}	2026-11-15 09:12:48.296524+07	2026-11-15 12:33:28.034384+07	0	\N
580c8517-fd29-4302-8110-d1ea5925550a	identity.user-registered.v1	{"eventId":"07bc5821-86d1-4355-8198-89b0ba28a52d","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-15T02:15:48.8960874+00:00","producer":"connectlyidentity","correlationId":"09bcdf24-ac32-47cc-87b0-627fcc107ade","payload":{"userId":"35da2eb3-b7d1-43db-845e-d50c65568538","email":"probe-1794708944283@example.com","displayName":"Probe"}}	2026-11-15 09:15:48.896087+07	2026-11-15 12:33:28.036246+07	0	\N
3738f43e-695c-4cff-af15-44c50374470c	identity.user-registered.v1	{"eventId":"3d615251-1d21-4524-b4d6-504035580916","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-11T13:50:29.3151362+00:00","producer":"connectly-identity","correlationId":"52e26835-6f29-49d4-b6c1-9f59b7f934b7","payload":{"userId":"646a813a-c2f0-434a-90f3-0d489b96ca01","email":"bugtest1794405026@example.com","displayName":"Bug Tester"}}	2026-11-11 20:50:29.315136+07	2026-11-15 12:33:27.838564+07	0	\N
1db19296-42a2-49cb-adbc-211d1b4d212a	identity.user-registered.v1	{"eventId":"1b8cb05f-e27e-4cbc-ab74-b0f4ca8346a8","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-15T02:21:41.8566167+00:00","producer":"connectlyidentity","correlationId":"f8fbf86f-98de-4b3c-b13d-f709773aff33","payload":{"userId":"454f2508-bab7-4c52-9397-375fbaf1b894","email":"probe2-1794709295710@example.com","displayName":"Probe"}}	2026-11-15 09:21:41.856616+07	2026-11-15 12:33:28.037968+07	0	\N
c31ca20c-b4cc-4591-b123-62f81d8474eb	identity.user-registered.v1	{"eventId":"6521cacc-cf59-443d-ae3e-6d3bea35e107","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-15T02:23:40.2834188+00:00","producer":"connectlyidentity","correlationId":"1fc98c04-c49b-4995-86f9-07b51031387d","payload":{"userId":"038646a7-db39-410c-8700-80857914e724","email":"probe3-1794709415918@example.com","displayName":"Probe"}}	2026-11-15 09:23:40.283418+07	2026-11-15 12:33:28.039842+07	0	\N
627eb154-8520-4f14-81db-b639794889e4	identity.user-registered.v1	{"eventId":"74c550c3-d6a1-442e-bc1e-2c3d8a769fee","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-15T05:16:53.7544052+00:00","producer":"connectlyidentity","correlationId":"7b40f4d7-eb58-4d11-8d2f-ab5edc445ee7","payload":{"userId":"227da432-a60e-47d4-baaf-f81d767450d9","email":"ui.test.1794719810495@example.com","displayName":"Low End Test"}}	2026-11-15 12:16:53.754405+07	2026-11-15 12:33:28.041329+07	0	\N
d0dc6110-bd04-4205-807d-9cc32c03544c	identity.user-registered.v1	{"eventId":"2a001148-0cd5-4857-aa63-0c696b8a749c","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-15T05:19:56.5185794+00:00","producer":"connectlyidentity","correlationId":"2a8053ec-0e09-41d6-992b-13898334a3e6","payload":{"userId":"76bc1dc1-03a0-4d5e-8635-b4adf58fea46","email":"ui.test2.1794719993586@example.com","displayName":"Race Check"}}	2026-11-15 12:19:56.518579+07	2026-11-15 12:33:28.043087+07	0	\N
c50586fe-d5ad-4198-b89c-c6aae0ddaae4	identity.user-registered.v1	{"eventId":"60d467a6-74cc-4e4c-bf09-809e11a1dcc1","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-15T05:34:02.5840572+00:00","producer":"connectlyidentity","correlationId":"ce947535-2538-40e8-8aa2-4960d2a040ad","payload":{"userId":"47fe91f4-83b0-4805-8422-17364d3f73ad","email":"ui.test2.1794720839436@example.com","displayName":"Race Check"}}	2026-11-15 12:34:02.584057+07	2026-11-15 12:34:04.333673+07	0	\N
017a2192-1e58-40c2-b7d1-fef8a910c386	identity.user-registered.v1	{"eventId":"fea310f3-4ece-4995-8236-53d4b8f3fdd9","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-15T05:45:25.8222258+00:00","producer":"connectlyidentity","correlationId":"124d7b16-e5d7-475d-800b-c9395018026d","payload":{"userId":"0dba3d85-f6fe-43af-b556-60f5d33f1019","email":"ui.test2.1794721522588@example.com","displayName":"Race Check"}}	2026-11-15 12:45:25.822225+07	2026-11-15 12:45:27.076317+07	0	\N
c49c92a9-ed4a-4cd8-8ced-7f0e65cd9885	identity.user-registered.v1	{"eventId":"a74f5ef4-f146-4e49-81a2-7ed377889202","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-15T05:46:36.5348219+00:00","producer":"connectlyidentity","correlationId":"20fc273f-1ac1-44cd-9852-bc6f5cbb5bfc","payload":{"userId":"d1188e7b-c1b9-42a3-9a2f-7b236da5761d","email":"ui.test.1794721595541@example.com","displayName":"Low End Test"}}	2026-11-15 12:46:36.534821+07	2026-11-15 12:46:37.440841+07	0	\N
f40e2190-7db5-4e90-aab3-859f10d15bb1	identity.user-registered.v1	{"eventId":"ca91ece3-10b2-4fa4-ac45-4b830b63af02","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-15T11:20:56.0469422+00:00","producer":"connectlyidentity","correlationId":"96c6d4f7-92ed-47d6-b91b-cf2be2427eca","payload":{"userId":"2f591a6e-6f4f-4abe-8edc-61affd306a2c","email":"race.1794741652808@example.com","displayName":"Race Tester"}}	2026-11-15 18:20:56.046942+07	2026-11-15 18:20:58.700994+07	0	\N
57671b2a-e60b-41c5-a1e7-c85167d9c5c6	identity.user-registered.v1	{"eventId":"56605472-9b93-466b-be6c-e03ee0295417","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-15T11:07:26.8650208+00:00","producer":"connectlyidentity","correlationId":"34dac24b-51fd-4a25-a99a-e5096c556d1a","payload":{"userId":"21198a95-6b09-47b6-8ff1-d9ba91125e30","email":"race.1794740842146@example.com","displayName":"Race Tester"}}	2026-11-15 18:07:26.86502+07	2026-11-15 18:18:22.440632+07	521	None of the specified endpoints were reachable
bef0b72f-52aa-4fa8-808e-899dd395b764	identity.user-registered.v1	{"eventId":"2584d818-0bc3-4e02-88ae-dc7840290274","eventType":"identity.user-registered.v1","eventVersion":1,"occurredAt":"2026-11-15T11:08:19.3194038+00:00","producer":"connectlyidentity","correlationId":"46c4491e-ed38-4e5c-9c7e-5eedf0257d62","payload":{"userId":"a8ff3d84-dbdf-4a85-87ea-517fb56ef91f","email":"race.1794740898559@example.com","displayName":"Race Tester"}}	2026-11-15 18:08:19.319403+07	2026-11-15 18:18:22.442822+07	508	None of the specified endpoints were reachable
\.

COPY identity.refresh_tokens (id, user_id, token_hash, expires_at, created_at, revoked_at, device_id, device_label, ip_address, last_used_at, location, user_agent) FROM stdin;
4b1c8287-9e2e-4afc-aac5-ec1d7e6ed265	646a813a-c2f0-434a-90f3-0d489b96ca01	EAF83AEC4AC5E539BDFE9086B09C3EBA7FFF11A8037E389BE76A5894D742EAD5	2026-11-26 13:32:17.582816+07	2026-11-12 13:32:17.582819+07	\N	b801061f-14fe-42ce-ab91-2dadb4d4afae	Chrome on Windows	127.0.0.1	2026-11-12 13:32:17.582819+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Freebuff/0.0.202 Chrome/130.0.6723.191 Electron/33.4.11 Safari/537.36
7a29d761-28ab-4804-9e64-571ef50e50d9	11111111-1111-1111-1111-111111111111	F546D5CE272173064C1CB5D7A5355B87D3C0980A34D8DA352DCEA4F63322264F	2026-11-27 11:10:49.04797+07	2026-11-13 11:10:49.047971+07	2026-11-13 11:26:51.98735+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Windows	127.0.0.1	2026-11-13 11:10:49.047971+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0
146634ad-d28a-47e5-bdc5-3f21494fabc6	11111111-1111-1111-1111-111111111111	779CA8018A6A85608FB61B71DEAE7F62DC9E59B0CEE2C6EC87F06028D8F8CD5D	2026-11-27 11:11:26.895295+07	2026-11-13 11:11:26.895296+07	2026-11-13 11:27:21.818583+07	83ccfebb-f110-4530-bbff-e2145ec7432a	Chrome on Windows	127.0.0.1	2026-11-13 11:11:26.895296+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) OpenCode/2.2.7 Chrome/152.0.7977.167 Electron/44.9.1 Safari/537.36
4ff8148b-399f-4cc9-81f8-36fa8e870ce2	11111111-1111-1111-1111-111111111111	274919DFED3262FA41959F67E5B53BA37A62D3DD23828EE406E8184077C1A45F	2026-11-27 11:27:21.818846+07	2026-11-13 11:27:21.818856+07	2026-11-13 11:42:54.015867+07	83ccfebb-f110-4530-bbff-e2145ec7432a	Chrome on Windows	127.0.0.1	2026-11-13 11:27:21.818856+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) OpenCode/2.2.7 Chrome/152.0.7977.167 Electron/44.9.1 Safari/537.36
e061a7b0-6168-4743-a9c5-255508233971	11111111-1111-1111-1111-111111111111	F207571FF8EC4B225ED81E62434457B18EFA9780039B2D7826AB69D6997D40E6	2026-11-27 12:13:16.732504+07	2026-11-13 12:13:16.732506+07	2026-11-13 12:28:55.833098+07	97e644ea-ee9b-4098-990b-856aabef23c3	Chrome on Windows	127.0.0.1	2026-11-13 12:13:16.732506+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) OpenCode/2.2.7 Chrome/152.0.7977.167 Electron/44.9.1 Safari/537.36
302a5876-d4eb-4b90-9e62-19caa2adecef	11111111-1111-1111-1111-111111111111	B27100C85D0E0A4D8AAAA51292A9C2802B87D85C4FA8B9599E020F0258C5CE17	2026-11-27 11:26:51.987454+07	2026-11-13 11:26:51.987457+07	2026-11-13 12:37:55.460395+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Windows	127.0.0.1	2026-11-13 11:26:51.987457+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0
2a8065ae-cbfd-4a5a-a05f-d2eed67f8757	22222222-2222-2222-2222-222222222222	EC7AF783578116CCB0BAEFA42CF883E01F475BA519836AAE8037C56C7233C424	2026-11-27 12:43:45.24336+07	2026-11-13 12:43:45.243365+07	\N	chat-scroll-check-3	Mozilla/5.0	127.0.0.1	2026-11-13 12:43:45.243365+07	Local network	Mozilla/5.0
2f151352-22a0-4f67-97a0-5abaa6bf14ce	22222222-2222-2222-2222-222222222222	D745E498F0ABEDF703945FDE21645AB9EA38A399C54B97A189FB3C8EEBA537EA	2026-11-27 12:44:57.122956+07	2026-11-13 12:44:57.122958+07	\N	chat-scroll-check-4	Mozilla/5.0	127.0.0.1	2026-11-13 12:44:57.122958+07	Local network	Mozilla/5.0
96188512-19e3-499c-9c51-62cad6647580	11111111-1111-1111-1111-111111111111	F7337B8934BA2FF02F3B0F1831C3E223F2D951D5CA6949C73A5BB3C93AFA88A7	2026-11-27 13:24:24.557499+07	2026-11-13 13:24:24.557499+07	2026-11-13 13:40:22.200708+07	876e3714-7504-4faa-855c-e1cd59787ef2	Chrome on Windows	127.0.0.1	2026-11-13 13:24:24.557499+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) OpenCode/2.2.7 Chrome/152.0.7977.167 Electron/44.9.1 Safari/537.36
02b1d3f2-bfb5-4810-8484-80ebeb887bb0	11111111-1111-1111-1111-111111111111	78BF81B35C2C2E27842BC4CD351F99BBE3DC0C23A4E973CCB63143584FDB3D47	2026-11-27 20:08:47.450023+07	2026-11-13 20:08:47.450083+07	2026-11-13 21:41:15.809594+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Windows	127.0.0.1	2026-11-13 20:08:47.450125+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0
35c9531c-f884-4112-af8d-c58953908351	11111111-1111-1111-1111-111111111111	C1731D85D87E4A7D3222B676A9D594E1C1AA0BB8A02D6E9A5A0B3DFE11D10A22	2026-11-27 11:11:53.682159+07	2026-11-13 11:11:53.682161+07	2026-11-13 22:33:06.49064+07	e7993511-4782-44c8-86e6-d18ed1087aaf	Chrome on Windows	127.0.0.1	2026-11-13 11:11:53.682161+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
fbd7f492-8de7-45be-a81a-ff14c455691d	11111111-1111-1111-1111-111111111111	0CBCF36F4B14A6CF520C9B355D3AF6B0ADD49FE5D4341B29D00E97DF44F3473F	2026-11-27 11:11:55.27155+07	2026-11-13 11:11:55.27155+07	2026-11-13 22:33:06.49064+07	final-check	Mozilla/5.0	127.0.0.1	2026-11-13 11:11:55.271551+07	Local network	Mozilla/5.0
5b7d0a2d-79c4-425c-af2f-53356b311781	11111111-1111-1111-1111-111111111111	08230E20C8ECC372A581A8578E988DD929F7C4CDD687D9FEAF9A8EA3B7D4CBFD	2026-11-27 11:58:27.945427+07	2026-11-13 11:58:27.945433+07	2026-11-13 22:33:06.49064+07	83ccfebb-f110-4530-bbff-e2145ec7432a	Chrome on Windows	127.0.0.1	2026-11-13 11:58:27.945433+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) OpenCode/2.2.7 Chrome/152.0.7977.167 Electron/44.9.1 Safari/537.36
101b524f-ea49-4f01-9424-90231d3f8a40	11111111-1111-1111-1111-111111111111	B1415C7582976F7051A25C4A1E031D1877EB7FC306702383DB868DD906363579	2026-11-27 13:55:56.744093+07	2026-11-13 13:55:56.744094+07	2026-11-13 22:33:06.49064+07	876e3714-7504-4faa-855c-e1cd59787ef2	Chrome on Windows	127.0.0.1	2026-11-13 13:55:56.744094+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) OpenCode/2.2.7 Chrome/152.0.7977.167 Electron/44.9.1 Safari/537.36
4cd9c456-8ed4-4b91-a815-72bc783fbb24	11111111-1111-1111-1111-111111111111	C031487D1A083FAC9EA3180E7EB8A79DB6B8F1596D6EE6211DF7AAEA09CF8CC1	2026-11-27 22:18:40.042291+07	2026-11-13 22:18:40.0423+07	2026-11-13 22:35:13.28079+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Windows	127.0.0.1	2026-11-13 22:18:40.042301+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0
14a32e26-f99d-4609-93f2-66f452896a25	11111111-1111-1111-1111-111111111111	0CE87227B9910C34ECE634905C9D95C37F3963609593E9A7A87F23D65554E681	2026-11-27 22:35:13.280874+07	2026-11-13 22:35:13.280879+07	\N	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Windows	127.0.0.1	2026-11-13 22:35:13.280879+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0
a431ffaa-885f-4687-b8bf-c557d7a380cf	11111111-1111-1111-1111-111111111111	8D5A6A475D96E99D9C5C99224957A31521CCF92B1D8FABFC2F3E71D973AB63D7	2026-11-28 20:57:26.076921+07	2026-11-14 20:57:26.079913+07	2026-11-14 21:20:43.127898+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Android	127.0.0.1	2026-11-14 20:57:26.08014+07	Local network	Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Edg/157.0.0.0 Mobile Safari/537.36
5db40d33-26cc-472f-9491-837b3622e9fc	11111111-1111-1111-1111-111111111111	7AC223D53D9317A86D6AE2650BC958245D155CA585C94EADCA62680EA7FB0A06	2026-11-28 21:20:43.128408+07	2026-11-14 21:20:43.128418+07	2026-11-14 21:36:58.358816+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Android	127.0.0.1	2026-11-14 21:20:43.128418+07	Local network	Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Edg/157.0.0.0 Mobile Safari/537.36
9f7c35ec-738c-4ed6-9a59-150bd74cf219	11111111-1111-1111-1111-111111111111	5845D22AEB2DBE5CF4C8FC263F69B9D21966D60499BBC1AD2301240BC787960C	2026-11-28 21:36:58.35895+07	2026-11-14 21:36:58.358954+07	2026-11-14 21:52:40.102691+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Android	127.0.0.1	2026-11-14 21:36:58.358954+07	Local network	Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Edg/157.0.0.0 Mobile Safari/537.36
4d61c87a-05ab-4904-8a83-7ea6f069f80f	11111111-1111-1111-1111-111111111111	507C12A37E42E578AD78D64F11C1F67E424446E502AEAC9176CE043736FF8BD9	2026-11-28 21:52:40.104702+07	2026-11-14 21:52:40.1048+07	2026-11-15 09:32:58.815095+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Android	127.0.0.1	2026-11-14 21:52:40.104888+07	Local network	Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Edg/157.0.0.0 Mobile Safari/537.36
1b6eee6d-8358-4209-a8fe-43705329f98e	646a813a-c2f0-434a-90f3-0d489b96ca01	662D08577F32C503AD9816F12BFB332154A9708DD96B563AE88EFD866F18DB70	2026-11-26 13:35:24.117419+07	2026-11-12 13:35:24.117422+07	2026-11-12 13:44:21.213211+07	curl-probe	curl/8.22.0	127.0.0.1	2026-11-12 13:35:24.117422+07	Local network	curl/8.22.0
f4a9ea85-bcbd-4388-b806-0183a6cce9f3	11111111-1111-1111-1111-111111111111	AC8C61CB41F56C8870CA10B47F16ECDE1833FDE087408793E66C699B133D5225	2026-11-27 11:42:54.015941+07	2026-11-13 11:42:54.015944+07	2026-11-13 11:58:27.945353+07	83ccfebb-f110-4530-bbff-e2145ec7432a	Chrome on Windows	127.0.0.1	2026-11-13 11:42:54.015944+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) OpenCode/2.2.7 Chrome/152.0.7977.167 Electron/44.9.1 Safari/537.36
b6740891-4095-4c2d-8383-c1c4f99114f5	22222222-2222-2222-2222-222222222222	F9BA958B5187996AC274654EB568AF2F2208FA2BDF479F9DB5F193FC6AF04675	2026-11-27 12:32:34.470368+07	2026-11-13 12:32:34.470369+07	\N	chat-scroll-check	Mozilla/5.0	127.0.0.1	2026-11-13 12:32:34.470369+07	Local network	Mozilla/5.0
00999932-9781-4f85-86bc-01f382a5b33c	22222222-2222-2222-2222-222222222222	592C934FDA9A9217F365B1A419877448B3169339649A637A13402E3BBCE549BA	2026-11-27 12:33:21.854326+07	2026-11-13 12:33:21.854327+07	\N	chat-scroll-check-2	Mozilla/5.0	127.0.0.1	2026-11-13 12:33:21.854327+07	Local network	Mozilla/5.0
583e070c-80b2-4a81-96e4-9fdabe6248db	11111111-1111-1111-1111-111111111111	5574503422EEE1BACD683CFC583B1ED15404CE8E978F2698585135034924A9C8	2026-11-27 12:53:11.212077+07	2026-11-13 12:53:11.212082+07	2026-11-13 13:08:52.247279+07	876e3714-7504-4faa-855c-e1cd59787ef2	Chrome on Windows	127.0.0.1	2026-11-13 12:53:11.212082+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) OpenCode/2.2.7 Chrome/152.0.7977.167 Electron/44.9.1 Safari/537.36
0ab52562-ced9-44fa-9204-63bb00f80fad	11111111-1111-1111-1111-111111111111	D0D2771A4611D170B0FFD2B3AD8A893153C0A586BA710DC0C6048CD87FFA6CDF	2026-11-27 12:57:57.757176+07	2026-11-13 12:57:57.757181+07	2026-11-13 13:55:44.783254+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Windows	127.0.0.1	2026-11-13 12:57:57.757181+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0
0fd71143-f670-416b-82aa-7427930e81e7	11111111-1111-1111-1111-111111111111	67ABB197558F073E460359BAA22BB30ED12BF6F66DCA0D8A03FBBC796AFACF83	2026-11-27 13:40:22.200744+07	2026-11-13 13:40:22.200745+07	2026-11-13 13:55:56.566495+07	876e3714-7504-4faa-855c-e1cd59787ef2	Chrome on Windows	127.0.0.1	2026-11-13 13:40:22.200745+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) OpenCode/2.2.7 Chrome/152.0.7977.167 Electron/44.9.1 Safari/537.36
3c3bb1bb-0d20-45fb-9875-a20621d2390d	11111111-1111-1111-1111-111111111111	38FA85D03297D3355BC2943E6FC15C5C57326A22C3424D42763FCC7E5AE13AC5	2026-11-27 21:41:15.812134+07	2026-11-13 21:41:15.812306+07	2026-11-13 21:57:04.830754+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Windows	127.0.0.1	2026-11-13 21:41:15.812475+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0
3025b88e-e37b-49c9-999e-8bc133827582	11111111-1111-1111-1111-111111111111	17A4BF87D95805D05620C01EDC2B5134C849C6EEBA1CCCE8370430052CCC59AF	2026-11-27 10:54:55.330805+07	2026-11-13 10:54:55.330852+07	2026-11-13 22:33:06.49064+07	test-device	Mozilla/5.0	127.0.0.1	2026-11-13 10:54:55.330883+07	Local network	Mozilla/5.0
70905fcc-e423-4aa6-8776-dbda47d49dbd	11111111-1111-1111-1111-111111111111	64019FCF4161C75F17FB1E1E1E41CBE4AC482971422B69EF231C409DBCAF0EFE	2026-11-27 10:54:55.699235+07	2026-11-13 10:54:55.699236+07	2026-11-13 22:33:06.49064+07	test-device	Mozilla/5.0	127.0.0.1	2026-11-13 10:54:55.699237+07	Local network	Mozilla/5.0
2704578d-6899-4091-b621-06b195743b2d	11111111-1111-1111-1111-111111111111	484A52F2E1BE9CC9137B057556E9C863BACEEA52EDBBA4BDC442203F3E655A4F	2026-11-27 11:16:29.252875+07	2026-11-13 11:16:29.252876+07	2026-11-13 22:33:06.49064+07	media-check	Mozilla/5.0	127.0.0.1	2026-11-13 11:16:29.252876+07	Local network	Mozilla/5.0
32cb1487-0ccc-4b82-90c8-8cc051b9e03e	11111111-1111-1111-1111-111111111111	8ACC5759CD4C738F909E0C2B13DDE52D6B552B3BBA7DB6A90F69705CC07A30CE	2026-11-27 12:28:55.833146+07	2026-11-13 12:28:55.833149+07	2026-11-13 22:33:06.49064+07	97e644ea-ee9b-4098-990b-856aabef23c3	Chrome on Windows	127.0.0.1	2026-11-13 12:28:55.833149+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) OpenCode/2.2.7 Chrome/152.0.7977.167 Electron/44.9.1 Safari/537.36
a0cb3370-4d9e-47bc-bd6f-50584c7d4f65	11111111-1111-1111-1111-111111111111	90CBB4321DBD00D91AA650EBD6DCFC9BFE277B759CAE11DCFFB13868B79AC02A	2026-11-27 11:01:21.106988+07	2026-11-13 11:01:21.106988+07	2026-11-13 22:33:06.49064+07	76c210bc-d69a-42d4-80fd-5d2982d04c91	Chrome on Windows	127.0.0.1	2026-11-13 11:01:21.106989+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
1903405c-3a10-4826-b289-37a0744110e5	11111111-1111-1111-1111-111111111111	13BDFFA11EEA09B1C2F8862C0425792B831ED0AE03F48CC031325EC9F25B25CC	2026-11-27 11:02:20.125656+07	2026-11-13 11:02:20.125658+07	2026-11-13 22:33:06.49064+07	e470041d-9be7-4778-ab77-ea56612a5e00	Chrome on Windows	127.0.0.1	2026-11-13 11:02:20.125658+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
05f007f5-1da1-43dc-a5bc-ec77f8133795	646a813a-c2f0-434a-90f3-0d489b96ca01	0C6AFD118AE783F836A93B2713344535B18E6909703DA0C5FD6351F5B0B8446B	2026-11-25 21:28:14.393816+07	2026-11-11 21:28:14.393819+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
3dd24f68-1229-4f47-9deb-7f4d1f0c55a7	646a813a-c2f0-434a-90f3-0d489b96ca01	B0E5971227C781C64F62575CD8B21DBC422779462E81C4702F5FACFF1960EED0	2026-11-26 13:58:50.77911+07	2026-11-12 13:58:50.779112+07	\N	b801061f-14fe-42ce-ab91-2dadb4d4afae	curl/8.22.0	127.0.0.1	2026-11-12 13:58:50.779112+07	Local network	curl/8.22.0
4efb4282-0a31-4580-8174-b0fc4e961a8e	11111111-1111-1111-1111-111111111111	790DDD02E67B00AE14A459A44952736E19AD3A9AC6DE4BC8C72CD4CCBEA0BF8D	2026-11-27 11:02:16.762736+07	2026-11-13 11:02:16.762736+07	2026-11-13 11:02:20.12534+07	e470041d-9be7-4778-ab77-ea56612a5e00	Chrome on Windows	127.0.0.1	2026-11-13 11:02:16.762736+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
68cc2d6c-0a1a-456f-82a9-16916cb90493	11111111-1111-1111-1111-111111111111	9C7EDFB16DA262ADC9A1544D15D21920DB58166353238A8BF399312163718E79	2026-11-27 11:03:52.605552+07	2026-11-13 11:03:52.605553+07	2026-11-13 11:03:56.958343+07	da42001a-8232-47eb-90ac-f3e93d419973	Chrome on Windows	127.0.0.1	2026-11-13 11:03:52.605553+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
d19bd43c-3a84-4ea2-b6f0-2114b44a4e5a	11111111-1111-1111-1111-111111111111	F7FD1CF5746653A3ED5FFA86CC86CB899981C5DD2F076D706F1855704FF9AB61	2026-11-26 13:58:29.440946+07	2026-11-12 13:58:29.44095+07	2026-11-13 22:33:06.49064+07	b801061f-14fe-42ce-ab91-2dadb4d4afae	Chrome on Windows	127.0.0.1	2026-11-12 13:58:29.44095+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Freebuff/0.0.202 Chrome/130.0.6723.191 Electron/33.4.11 Safari/537.36
68f4b8d1-606b-4639-8208-8e7193f1ad05	11111111-1111-1111-1111-111111111111	690EAAA12ABA6E23B3357E884DBFEB47045E4E5C329F653BA7D1F22B30D8D95A	2026-11-22 10:21:35.641622+07	2026-11-08 10:21:35.641761+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
fd565bdd-4f27-4f3d-a543-44c992e406a1	11111111-1111-1111-1111-111111111111	5775414D265178DE93AC63404677B45081345AF0BC94F3131F4D31539038ADBA	2026-11-22 10:23:07.753153+07	2026-11-08 10:23:07.753267+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
e803948b-7eb5-435d-ab40-d657bd906959	11111111-1111-1111-1111-111111111111	2658338A3CB1D76A0AD9FB02BBD85335A7A63C30E0083D411F5665C06CC9BD2F	2026-11-22 10:23:25.818145+07	2026-11-08 10:23:25.818154+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
88fa3313-8785-4911-9352-80cd7acd49c5	11111111-1111-1111-1111-111111111111	E9AE687CAD5B8E255B33986CBA79EEC453885DDE3B009ECA4DBCE04DF68EE273	2026-11-22 11:24:44.302394+07	2026-11-08 11:24:44.302553+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
3c19b470-ff1c-4d40-b86f-fcea9d4725cb	11111111-1111-1111-1111-111111111111	6836A165F911079AFE68997A99EE712F42817E1E5E30D6CC877719521D7E9A67	2026-11-22 11:28:01.17269+07	2026-11-08 11:28:01.172786+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
193887db-4dcd-4241-9816-3ac47bb610ac	11111111-1111-1111-1111-111111111111	ACEF39D23B3C58604493DAE670401330E55F6FB89CB7B1B8EF23CDFA28AFD724	2026-11-22 11:28:12.569274+07	2026-11-08 11:28:12.569282+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
32145747-015b-4574-880e-1e05af7cbb67	11111111-1111-1111-1111-111111111111	8D97F7A15E22C731E71C2185F6C44C88041FD10FC24B12C8CFAD1E453290918F	2026-11-22 11:29:42.978271+07	2026-11-08 11:29:42.978279+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
cf711052-d2f6-47f8-b28f-1b04818aac20	11111111-1111-1111-1111-111111111111	E2C102FF72615B3191E40FE4277F9AB5B50EB38468532EB84B40D6A4B841D3D9	2026-11-22 11:31:08.409248+07	2026-11-08 11:31:08.409343+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
52c43621-297f-4106-8d87-9a61ce08c689	11111111-1111-1111-1111-111111111111	72073CCDD3B4A42B171B30DB641A2989BFA822C7578421EDA57DD5A4A2992548	2026-11-22 11:34:57.094023+07	2026-11-08 11:34:57.094096+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
ae49eae6-0ae9-4897-8ec4-576b5a71c3de	11111111-1111-1111-1111-111111111111	09E714EEE33569E320D5902B243B7F1110D6227E2475DB673E9C7BC1AA821FB1	2026-11-22 11:35:04.737627+07	2026-11-08 11:35:04.737641+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
5e52425c-8b85-407a-87b3-cef6b07c3dd9	11111111-1111-1111-1111-111111111111	212644C6A17C28D95CF9AF8AC968D2BA929EE490BE996D683FBF2B8217ED8FB1	2026-11-22 11:35:28.464648+07	2026-11-08 11:35:28.464655+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
aaff29d7-45ec-40f0-8e18-0c0693f24ced	11111111-1111-1111-1111-111111111111	21ECC80964B94F6ED61AA149AC713473D066F1EBCF7FE1BB93F3AC1D601DBB48	2026-11-22 11:47:55.997184+07	2026-11-08 11:47:55.997263+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
cca2e2b5-eaa2-4563-9c77-97ab84bc0906	11111111-1111-1111-1111-111111111111	2D327B15A3C9B0D9BA11E631F631AF780372681F9A05F3DE746683D78F494137	2026-11-22 11:49:45.93809+07	2026-11-08 11:49:45.938095+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
eaac1d48-e145-4dfd-a0fc-51655b6d94bc	11111111-1111-1111-1111-111111111111	F90A3A3A9F3227FCA19688FF80FDC10AD5E348DCEF8A7CB91DDB9AE72ADA4002	2026-11-22 11:50:46.953268+07	2026-11-08 11:50:46.953271+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
90e63143-d068-48a7-8229-ed428f6d1d30	11111111-1111-1111-1111-111111111111	27A200A4B244D6F3E627F5F7355F43B796C87B3493C77B29E8CE8E6E26E981CC	2026-11-22 11:51:23.274854+07	2026-11-08 11:51:23.274857+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
5a9eda18-fa18-4f53-b46f-eb527a98f005	11111111-1111-1111-1111-111111111111	765642EB6B022DAEBBE06CA04630DCF681F06062051086299E254EC5C5D3AD13	2026-11-22 11:53:26.880523+07	2026-11-08 11:53:26.880527+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
824bc753-30a4-47a9-92fe-dfafdbea4077	646a813a-c2f0-434a-90f3-0d489b96ca01	494B4160FCE5693AB8F1BDCA80D3860D9604ECA0994518FBE90822BA1E8AF4FE	2026-11-26 11:20:09.000464+07	2026-11-12 11:20:09.000473+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
b5e6892f-32dd-4e00-b6e8-eee3701723f3	646a813a-c2f0-434a-90f3-0d489b96ca01	6DB48A4747FDCA151B4F5499A2B03DE85C202AB31501068936C25E4D534481B4	2026-11-26 11:20:21.140915+07	2026-11-12 11:20:21.140922+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
36e64dfb-834b-4cd2-b408-3dee2da4baf0	11111111-1111-1111-1111-111111111111	6F10873A6BAAAE2E38FA143C2E371B5429E57307ED343ECE1E7319D69F8F2D1B	2026-11-26 11:23:22.517898+07	2026-11-12 11:23:22.517904+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
de0fe039-665f-4d0f-b3de-daae000684f9	646a813a-c2f0-434a-90f3-0d489b96ca01	5A81AB45A11B48A008890BF0CC395AB610CB237CE244A947637614573C3EC5D0	2026-11-26 11:25:30.3434+07	2026-11-12 11:25:30.34341+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
3d56b0b5-e85d-42ba-8b8e-b2bb202bcb53	646a813a-c2f0-434a-90f3-0d489b96ca01	7E96478901FC88D31DC867F71035171945F22493E202358A4663261B350DDD15	2026-11-26 11:25:36.302116+07	2026-11-12 11:25:36.30212+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
4173891f-dc73-49d6-88df-d03619c12ca9	646a813a-c2f0-434a-90f3-0d489b96ca01	961D8CC992FA43001C8AAEF8DA6B47A68E89D37B86144D0652EFD0216A508038	2026-11-26 11:27:32.393357+07	2026-11-12 11:27:32.393364+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
ef8ce500-cf73-4b9a-837a-6ea213dc651b	646a813a-c2f0-434a-90f3-0d489b96ca01	F29B579E216499791B3A5D403AD0EEC3F21CB2556C4BCA2889506D3E240744F4	2026-11-26 11:27:58.175561+07	2026-11-12 11:27:58.175565+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
30031c2e-2ac3-464c-98e6-3c50aaa17df9	646a813a-c2f0-434a-90f3-0d489b96ca01	CE88FE552BEB97E179B76632F46E626B495B137FDEEDE8BCCA2C725CD366EC5B	2026-11-26 11:37:38.92664+07	2026-11-12 11:37:38.926647+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
71bb5d4a-2e9a-44ee-8137-1b1680312fc4	646a813a-c2f0-434a-90f3-0d489b96ca01	9E475C1443D88CA700A97699215682B8CA41F903A87A6F7063F52D8AF84AF782	2026-11-26 11:38:32.05157+07	2026-11-12 11:38:32.051573+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
a8fcf993-142b-4e82-8322-10531d300b9b	646a813a-c2f0-434a-90f3-0d489b96ca01	9288F9488EBACC09DBDD6994757F23A8474959F2C7EAE56B4458C7C3824DB3D4	2026-11-26 11:38:48.138484+07	2026-11-12 11:38:48.138488+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
ae42adec-0b8f-4598-ac4a-0891b707c146	11111111-1111-1111-1111-111111111111	2146F59391308204F7DE038CE781664E9585BCCD636BB90F5B1B8B0C1068AD54	2026-11-22 11:54:20.681526+07	2026-11-08 11:54:20.68153+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
1236d50f-61f1-4dfb-a44a-0f7613e7dbd7	11111111-1111-1111-1111-111111111111	F476E66E967369262115C536BE75A55E2A86CF4892BDCB832BFA7933D65A4C88	2026-11-22 11:55:44.7403+07	2026-11-08 11:55:44.740305+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
0d43dca1-f2f6-487c-b773-9e4ea7f5f470	11111111-1111-1111-1111-111111111111	386EB0F611ACC88699863A8EEB9EF3D30475BCCF0FE5E79DF3AAA0B9705F03EE	2026-11-22 11:56:48.6852+07	2026-11-08 11:56:48.685202+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
bdf84aec-17f2-4f05-a7f9-446804b280dd	11111111-1111-1111-1111-111111111111	2E67A4F07C80C834E143CF45EF42A20353FD1AB32ACE773F5D01ABE554A17DA6	2026-11-22 11:57:41.083422+07	2026-11-08 11:57:41.083427+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
612a36d9-2883-41ce-86f8-cc2a126cce9b	11111111-1111-1111-1111-111111111111	B65502417557079AC1C193454BE35778AE76916FBE54D744738EFF81071E33F8	2026-11-22 11:58:40.70212+07	2026-11-08 11:58:40.702121+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
a9924e2c-1829-48a4-a96c-c01612e7ce44	11111111-1111-1111-1111-111111111111	D3C6B33178697AA82B1A42B1D13F7B559FE26A8A6FC5ACA468A878C20ECB81C5	2026-11-22 11:59:54.496901+07	2026-11-08 11:59:54.496903+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
11701b5f-6340-4720-9ada-f023023e352a	11111111-1111-1111-1111-111111111111	436362941AC1C45FE8980A6F62FED1399FADB6BDB848A8D2877A15EEC41F0639	2026-11-22 12:00:22.498586+07	2026-11-08 12:00:22.498591+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
07a3046b-1103-4f58-a53f-c6fa4e4d7aca	11111111-1111-1111-1111-111111111111	7D9ADC77368EE48E972433F5303C7937301DE2AF915FD117A2A2D0EFF682470E	2026-11-22 12:12:41.415003+07	2026-11-08 12:12:41.415127+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
c385e861-8466-4bb2-a848-5581383addf7	11111111-1111-1111-1111-111111111111	365538E49DD6DBB4C2899BEAA1047C1E291E85C32D1B69CC6F095D1D5250D384	2026-11-22 12:20:13.043183+07	2026-11-08 12:20:13.04319+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
8719abec-2cc7-4ea4-97a0-e52aba203740	11111111-1111-1111-1111-111111111111	240C6A5EB715DEED77430FC411A9B6903327C608E7160FF45D7DF4ABF24F6DAE	2026-11-22 12:20:23.75908+07	2026-11-08 12:20:23.759084+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
60441fbc-a784-459a-9e72-6efe3fa99089	11111111-1111-1111-1111-111111111111	EAB4D41CE0DE942555B9FC0B767C393ED6E7B6522E75E2BA2EAA8D2DC97DA9BB	2026-11-22 12:22:01.094076+07	2026-11-08 12:22:01.094078+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
29f8cbbf-cf87-4c23-92ed-2ef758511609	11111111-1111-1111-1111-111111111111	1F9C0CF246EFAD882909515F7B9648DB6B085EE320E902683D719B85DC24340B	2026-11-22 12:23:04.691094+07	2026-11-08 12:23:04.691099+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
54c480a4-7e47-4a35-add2-7ef633a74bd3	11111111-1111-1111-1111-111111111111	DBCB5CF013179191D3827563AD4A736ABD88A78CE8A4A590330D86D9DA0EBFC0	2026-11-22 12:23:20.467618+07	2026-11-08 12:23:20.467622+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
a85a5364-848f-440c-a0ac-16f5e7d46e9b	11111111-1111-1111-1111-111111111111	14C9CE07D540C88B6D33FC30908F1B97BF7B7801E75A41A6BD0D256FCB6D4A39	2026-11-22 12:37:03.833456+07	2026-11-08 12:37:03.833458+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
1203df90-b032-4dfe-86db-91c657ce8aaf	11111111-1111-1111-1111-111111111111	BDE401C367CC125F642C6BC4A5CFDBFF4EE68F51DB1C5B9828297743D0724874	2026-11-22 17:36:41.639559+07	2026-11-08 17:36:41.639636+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
4bbe5b74-ff87-4aad-9f84-7dcbb2b16fd5	11111111-1111-1111-1111-111111111111	5202F7548A443C00BDE0037F99E7239EDB49E745C6B4331A9108A82AFEDA6454	2026-11-22 18:25:42.837707+07	2026-11-08 18:25:42.837716+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
e0e047d3-bd28-4819-b2b0-7c957f63ddb5	11111111-1111-1111-1111-111111111111	9AD8915FC5D5F4415C1416BA230F9104F3020599E0A64678D0286AF86EFA331D	2026-11-22 18:44:20.744455+07	2026-11-08 18:44:20.744458+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
c965c19f-aeda-4984-b647-9bf6d5acfcb2	11111111-1111-1111-1111-111111111111	EFF3A92D90330B8D06066B00CFF86345586EC0D881237DB49C2F241D6A7CD82C	2026-11-25 18:59:26.616777+07	2026-11-11 18:59:26.616952+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
e2710215-93e3-43b6-8c63-7580ab8d2e10	11111111-1111-1111-1111-111111111111	B6EFD4FD1CB44E56123218C0936B93F6AE36AF4839A23510B784717930534240	2026-11-25 19:15:16.432967+07	2026-11-11 19:15:16.432981+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
8f54f83b-6e4a-43f4-bd38-541ad8c0191f	11111111-1111-1111-1111-111111111111	F6C1D6ABF3DD1F4278937447CD84936DAFF6F40829470ED763FF0A6C411076C6	2026-11-25 19:36:22.764063+07	2026-11-11 19:36:22.764069+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
eace8b4f-d780-41b8-abdd-341e1dd54926	11111111-1111-1111-1111-111111111111	59F63672CF21F5DD6D5C6C7B58F39E7DE4B1B4033CF6BABD8B7216476073B081	2026-11-25 20:13:12.157022+07	2026-11-11 20:13:12.157047+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
b0892014-5013-4769-a346-b1e742484229	11111111-1111-1111-1111-111111111111	8588AF24804AC86863FDC11DF143B76E83355AAAE56B8DB1E1DEC1DFF5F97E3B	2026-11-25 20:13:57.437599+07	2026-11-11 20:13:57.43787+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
1f751e40-ee32-48f7-bb7c-2617c5bfae20	11111111-1111-1111-1111-111111111111	2C87AFF8DAC2650CD23BE790FE534A8895125E9EBD603F5280F7A18624042090	2026-11-25 20:19:24.652475+07	2026-11-11 20:19:24.652501+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
e4b74095-1d67-4c23-850f-d5af68931bdc	11111111-1111-1111-1111-111111111111	AE0308685ABEFBDA27A3CF0D6EF7ED2FD2C22608B3759D6080A484C8E361FBED	2026-11-25 20:23:36.658001+07	2026-11-11 20:23:36.65801+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
3c9aaa10-b72c-4b3d-8dab-9c28e5cf3f8f	11111111-1111-1111-1111-111111111111	58B5ADE58BB3E40C5457CC2646894A9E9C1EA640B7A36BD12B16EBE87C050D44	2026-11-25 20:27:58.881526+07	2026-11-11 20:27:58.88153+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
829e0080-bbdd-474e-aa48-a857cfca8340	11111111-1111-1111-1111-111111111111	983BC689A9214AFA73C96D6D06873550993663AF786E1CDAE450059D29DB2B60	2026-11-25 20:37:51.343797+07	2026-11-11 20:37:51.3438+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
5f6ecfca-f7d8-45e1-ae6b-a4f33eec3129	11111111-1111-1111-1111-111111111111	719487AE249E197209AE58862A20FFA0C5CB526F7EE349F33C010EB7F04D5B2E	2026-11-25 20:40:14.111096+07	2026-11-11 20:40:14.111099+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
0d651d67-2cc3-4c49-a705-27230992f9d0	11111111-1111-1111-1111-111111111111	D180E1B385E1940987B5FD031DDD683A0EC7D4C170D9D962A21C2C8A1053730E	2026-11-25 20:43:11.644768+07	2026-11-11 20:43:11.644771+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
7965a3d0-ba01-4ac6-9bb2-89c21e2c27bc	11111111-1111-1111-1111-111111111111	395E775891F5188996350495985993BDB84E3E181B4AE09AD557486936AB8881	2026-11-25 20:45:50.648871+07	2026-11-11 20:45:50.64888+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
4699cf79-72d7-4fec-9d71-7c556c40a1b6	646a813a-c2f0-434a-90f3-0d489b96ca01	31D9066EEF5B92B8F21AE7412B93C1A6A72565D0FB32B91B6F5C4A91C082FAB1	2026-11-25 20:50:29.447772+07	2026-11-11 20:50:29.447778+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
8009f768-6e8d-40e0-8957-6abd9348b21c	11111111-1111-1111-1111-111111111111	F222A34B87B39322D5F260A899BFBFCC830389E3C64AD827923470DB45422D22	2026-11-25 20:57:17.126105+07	2026-11-11 20:57:17.126114+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
f2e5c7ca-8238-4339-801f-28fd572b2d9d	646a813a-c2f0-434a-90f3-0d489b96ca01	0306774F8B04CF6A453F7500324A593775B7E6F61941678603D048FC65D0C522	2026-11-25 21:06:06.629587+07	2026-11-11 21:06:06.629591+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
2bc73fc7-13b5-4ea9-af93-9df5e51fb2a9	646a813a-c2f0-434a-90f3-0d489b96ca01	1187C6B89800F68F67BDAC0E8A5F7B3A45C93AF62E3C9974FED613C1AFBBEA35	2026-11-25 21:07:00.338252+07	2026-11-11 21:07:00.338257+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
9d581669-ee86-4db5-a27f-5ec8d7357512	646a813a-c2f0-434a-90f3-0d489b96ca01	790C23CC614C71664CF34B18DA6FDC38DD245BA582021F5405936DBBB9583299	2026-11-25 21:07:44.621335+07	2026-11-11 21:07:44.621339+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
4b9279d4-b319-4a13-b466-6e5a36ab824e	646a813a-c2f0-434a-90f3-0d489b96ca01	3F7CBF387212704D67DFEFE9A4FAFD685DDC0AB34630D4945A1EC196F14FEED8	2026-11-25 21:14:45.041176+07	2026-11-11 21:14:45.041178+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
187f4a9a-4979-4025-9c69-c8a8a593b476	646a813a-c2f0-434a-90f3-0d489b96ca01	540A3D962B5334FE26753189844C7BABD20C070223DFDF5253484E6D6BCB55C4	2026-11-25 21:15:57.288217+07	2026-11-11 21:15:57.288224+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
6ae54566-5aa5-4a8c-95ab-f4b6b516995a	646a813a-c2f0-434a-90f3-0d489b96ca01	CBB1B07346FC100303568FB6FD694160381C6059508C056A3B4F7C97A21A0E97	2026-11-25 21:20:47.120913+07	2026-11-11 21:20:47.120918+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
ff94a8b0-d3e9-4b72-8688-de9c010f268f	646a813a-c2f0-434a-90f3-0d489b96ca01	0624314F671D901287D56F62B312763A63F0D1E1CE2D7406BCEFB70A6F497ED9	2026-11-25 21:23:14.233391+07	2026-11-11 21:23:14.233396+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
904a3156-8dbf-41bf-9efb-dfc6fec34cdb	646a813a-c2f0-434a-90f3-0d489b96ca01	7680989EE98FD8497FACF7AC70114EC2E00AFB3C8841831A1D92C4A6A4598DC4	2026-11-25 21:25:44.372076+07	2026-11-11 21:25:44.372086+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
8100200a-ff6e-4537-ab2b-e50bd18f384b	646a813a-c2f0-434a-90f3-0d489b96ca01	FD80CB0C8AB7D7B59CDF774E7E37FC0CF9430279ECD85477101486FC4E4D830A	2026-11-25 21:30:51.00335+07	2026-11-11 21:30:51.003355+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
5d8ab80c-784b-4d49-90e8-e936010f9b5c	646a813a-c2f0-434a-90f3-0d489b96ca01	1967992242E80AEE1B4EFF10289D5F13AF35298F3CEE41E9CF39BDE5C5544B01	2026-11-25 21:34:41.912655+07	2026-11-11 21:34:41.91266+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
b0d64b10-fa34-4ad1-a18f-52aaaa249e8e	11111111-1111-1111-1111-111111111111	7E59BAAD648AB9E28F81EE65D27B94D1099A20967A82B653D1C683C5DF879519	2026-11-25 21:36:00.657495+07	2026-11-11 21:36:00.657501+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
6ea77329-869b-46ed-b983-bb20990de86f	646a813a-c2f0-434a-90f3-0d489b96ca01	97D25AFB029831E7107848180561F258FD0CFE8073CD8637BF070A06DAE88A38	2026-11-25 21:36:41.003524+07	2026-11-11 21:36:41.00353+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
07f6c8da-a250-4702-a1bf-0ef2d6d0e5e9	646a813a-c2f0-434a-90f3-0d489b96ca01	50234CF3D781086414BE6F58E28FFCCC9FBAE56E9D1A6ED695BD79FE17608156	2026-11-25 21:40:17.395612+07	2026-11-11 21:40:17.39562+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
ed928ce3-6fa3-4775-8901-a96d198f7575	646a813a-c2f0-434a-90f3-0d489b96ca01	BA2024BF1B2FFF7A617BB62433DA48B8D660E7F6ABD1BDA3FC4EA2ED00F335E5	2026-11-25 21:43:20.976573+07	2026-11-11 21:43:20.976576+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
a3336d69-1c92-4ed4-9aea-4df2e0b6d7c3	646a813a-c2f0-434a-90f3-0d489b96ca01	5CC44C9E23A8CBEE4A592B98C73BD97C0A3CE3A68CA7FE1EF2D9A151AA72934F	2026-11-25 21:43:25.577139+07	2026-11-11 21:43:25.577142+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
bf7e0b31-5b82-4065-b0dd-4c378c4f27b2	646a813a-c2f0-434a-90f3-0d489b96ca01	A044C7D9868401E42C3A05E4A1A24685D867403E2C8071C47FB0884BB7BD6CD6	2026-11-25 21:47:10.015604+07	2026-11-11 21:47:10.015611+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
67ed911b-83f0-4048-98fc-59eaacebbc64	646a813a-c2f0-434a-90f3-0d489b96ca01	2D030EF1B6044B92DC04DF58CC0C35957E87D65803C3E4296C024A1E4C9A03B4	2026-11-25 21:50:07.83621+07	2026-11-11 21:50:07.836214+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
e142c1e1-e938-4a1b-8ee1-ef86846f4482	646a813a-c2f0-434a-90f3-0d489b96ca01	1CD9CBCD011BF1F60091C43544B35240A5F1ABF7451F921136EF6642DB9DDA17	2026-11-25 21:50:07.962417+07	2026-11-11 21:50:07.96242+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
b81b1d56-aaf5-4e58-928d-0ef62e27f1a1	646a813a-c2f0-434a-90f3-0d489b96ca01	BF33A2CE534DE496D15C001CC4BCA783259C458EB580D7A2353123F862765532	2026-11-25 21:50:16.083992+07	2026-11-11 21:50:16.083999+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
107b167a-e742-4ac3-8c0a-87897a6b9f39	646a813a-c2f0-434a-90f3-0d489b96ca01	6101B56BA073C1500F3A0E5C24CB3F7CD016BFAB6EA18D33F4E8321A960CCB57	2026-11-25 21:51:32.479704+07	2026-11-11 21:51:32.479708+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
690d2d70-e252-436d-9221-e5bdc30615b7	646a813a-c2f0-434a-90f3-0d489b96ca01	4FFF0CE76BECCD3BEB467C4C93BCA89409EB031795FDCAE44F61751A09879721	2026-11-25 21:57:39.233693+07	2026-11-11 21:57:39.233716+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
83602e1a-ef7d-423a-9b7c-b97c2ac1c831	646a813a-c2f0-434a-90f3-0d489b96ca01	892956DBFC23D317B5764FE0815EA1E2B321F350265C12763D666DE306DD1B29	2026-11-25 21:59:02.544306+07	2026-11-11 21:59:02.54431+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
3a152382-e8d6-40d4-b920-a6e8289d617f	646a813a-c2f0-434a-90f3-0d489b96ca01	6CCAB8BC7E03CC60B3BD02C8FB9DF72CF2FE7E0AD980DA2358079470E9E8BE45	2026-11-25 22:00:21.782416+07	2026-11-11 22:00:21.78242+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
6e11dc96-b674-4cee-b302-e2a7a1e228c1	646a813a-c2f0-434a-90f3-0d489b96ca01	9CC494FAA4DCA2A8181D9C50F182F3ADC57674FAAB2D9C0703E7BD4C20F31CED	2026-11-25 22:00:22.091725+07	2026-11-11 22:00:22.091729+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
b19a3139-793b-4d58-943b-4db7fc441316	11111111-1111-1111-1111-111111111111	2D6CFD77552A7D8DB6F259574CD31AFCC94649DB29450E395CCA462AE7970A93	2026-11-25 22:02:50.058108+07	2026-11-11 22:02:50.058131+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
87015a31-604e-434a-a899-d543259139af	646a813a-c2f0-434a-90f3-0d489b96ca01	37A6251212979F224B9D3B63FDFEE80191305C4B15AE50E4E3E3385249855667	2026-11-25 22:08:07.548216+07	2026-11-11 22:08:07.548222+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
62da8e2a-1270-409b-8d2f-f174cc47d3d2	646a813a-c2f0-434a-90f3-0d489b96ca01	E88DE51EF00E87660748B63648ADD13A7570710549EB734CF304FFB0A8C0E1C0	2026-11-25 22:11:57.200526+07	2026-11-11 22:11:57.200532+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
972412e2-d210-4b6a-aa02-289116281654	646a813a-c2f0-434a-90f3-0d489b96ca01	600ADAEBD0F5353569D50D21C1CF48238EEBF33AE6A6DFF95E43A5F9ADE91CF4	2026-11-25 22:13:15.118687+07	2026-11-11 22:13:15.118696+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
2d5c8929-f6bf-4dd3-8928-edf39e993da1	646a813a-c2f0-434a-90f3-0d489b96ca01	93B36C0C2B472ACCACA017D3E8F228571964E2647529C112C9D7676CEEB5BFB6	2026-11-25 22:13:37.183332+07	2026-11-11 22:13:37.183344+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
1f7b1e74-aad8-40b1-8ea2-38445b4acd4d	646a813a-c2f0-434a-90f3-0d489b96ca01	0CEEF5E5C19C9B287E46ABD2563214CFEA5D163BCA99A2FBC2FEFEDA1020257F	2026-11-25 22:13:37.363614+07	2026-11-11 22:13:37.363623+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
48b9ab49-5a52-4388-84a3-6a05bbf71c6f	646a813a-c2f0-434a-90f3-0d489b96ca01	25A0C77D72F045086342E366BCFC8D0170863898DCFDCEA5965D7AED74799C15	2026-11-25 22:13:37.600087+07	2026-11-11 22:13:37.600097+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
cc811e6c-733c-4e8e-aed5-df1627ffab00	646a813a-c2f0-434a-90f3-0d489b96ca01	CFA49B8DFFA33AADFB92E707AD31564362E40E9CB7F974B6F0877BA8CEAA51D8	2026-11-25 22:34:54.47533+07	2026-11-11 22:34:54.476341+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
1344de0c-243c-431b-b380-19b708c69934	646a813a-c2f0-434a-90f3-0d489b96ca01	39251B50746113EE63698E6D8C9F9469DFACE30B37D8C5F7287EBADE5E01D09F	2026-11-25 22:35:26.919272+07	2026-11-11 22:35:26.919286+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
b2b159b2-4b04-470d-8121-1b78fd496504	646a813a-c2f0-434a-90f3-0d489b96ca01	49EEA203417654ABA31272DFABD5FC2BACA8DBE20B829D86EFCFF58B7EEA7F21	2026-11-25 22:35:27.258534+07	2026-11-11 22:35:27.258541+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
7f948923-b911-4bca-8b91-c40653963857	646a813a-c2f0-434a-90f3-0d489b96ca01	303E7F22C98E4BF60C472CC1FC4AC681A248098BC5318E8E9658310CD669D171	2026-11-26 09:12:26.959713+07	2026-11-12 09:12:26.959786+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
e37d49a8-25ab-48f1-991b-4b1da71861c3	646a813a-c2f0-434a-90f3-0d489b96ca01	53B86B2FA29D5596097F3EE52F9F2AA79E252617DEE0CC102506F353C6DBD03D	2026-11-26 09:14:00.642148+07	2026-11-12 09:14:00.64216+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
37397621-3f6d-4ca5-9f9d-8e348722cc9d	646a813a-c2f0-434a-90f3-0d489b96ca01	8864E92EBFCEEC41110B2882878514EB23E2496B126A79886F826D177D121322	2026-11-26 09:14:23.474696+07	2026-11-12 09:14:23.4747+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
9dea9061-6b25-434d-a59d-2c517042061d	646a813a-c2f0-434a-90f3-0d489b96ca01	F59F28B2EA0CBCDD32833561A9E98A2285BDEB569B064673835171BFB07FEDBA	2026-11-26 09:15:44.546784+07	2026-11-12 09:15:44.54679+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
8bb1af1f-feb4-440e-b055-cf8e25e4494b	646a813a-c2f0-434a-90f3-0d489b96ca01	8DC28D223AF9DD60E9A51FFAE93F64C6F4215671AE7D0D60154694A8E3E07DA5	2026-11-26 09:15:54.772549+07	2026-11-12 09:15:54.772552+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
3c240ab1-44fd-4486-904b-7b865d0cdcb0	bb9ccd00-cc78-48bb-9a87-8ae9c31420ef	B1A0B5580F9728459C458C46A4F37E3153C6B49AD5ECEACE9DBB273BA0981F86	2026-11-26 09:15:55.290047+07	2026-11-12 09:15:55.290054+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
f45b1789-0fce-4282-a5c7-4c78c424fb69	646a813a-c2f0-434a-90f3-0d489b96ca01	22FBE34F9FE82F44C23438240FC1FD2EC687140F470CF700EC18E4B3CE6DA6B3	2026-11-26 09:16:07.718224+07	2026-11-12 09:16:07.718228+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
51098522-f125-49d2-8198-0ccad6bad589	11111111-1111-1111-1111-111111111111	B7E01ADB1BA0736A8F1AB4CE038F1E22CFC57BEF77F2E4389DD9918D258C3E27	2026-11-26 09:19:49.446777+07	2026-11-12 09:19:49.446779+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
53d4e831-9c42-445e-ab79-be1b66338d82	11111111-1111-1111-1111-111111111111	1B75AD14D8ADC630C4EC02E595693DB58F51FBA8FC9E271333C144E3FBF4563D	2026-11-26 09:30:31.024877+07	2026-11-12 09:30:31.024885+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
40d38d77-736a-4b01-8342-95baca717c4c	646a813a-c2f0-434a-90f3-0d489b96ca01	B1DE93CCC6CBF2E42F8E328B3B9AE79888ECBFB56C304EDCEE86887294C3F848	2026-11-26 10:14:30.836914+07	2026-11-12 10:14:30.837021+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
d1f28c22-f990-4271-9578-9188151ab0f5	45f8055f-6fa5-4fb3-8a0c-28f838a926e5	49BDCC082F7F70BFCEBE0500A70C19E774D00B090444944F0F57ED0A4FC7F7D8	2026-11-26 10:15:27.944515+07	2026-11-12 10:15:27.944526+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
77ea5f8c-6454-4263-9ac5-1afcfe08d8e8	45f8055f-6fa5-4fb3-8a0c-28f838a926e5	1826694A37819F7CFAB5B9917CA33989062D80CD993610AE55FED9BBCEA4D1BC	2026-11-26 10:15:28.291724+07	2026-11-12 10:15:28.291731+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
19762f77-1b97-4676-bddf-a0db2a3f250d	646a813a-c2f0-434a-90f3-0d489b96ca01	F37A6D9C62CD545ADA7CEF9C0A2F6C576BEE5DFA737249096EACE740F071DB8D	2026-11-26 10:16:44.474138+07	2026-11-12 10:16:44.474143+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
66700ca6-9b95-4c02-a5b1-a70dfad80214	646a813a-c2f0-434a-90f3-0d489b96ca01	17323B4DBF4C6056255A3FCD19D935164668785A2A22EF09951BDF68C852187F	2026-11-26 10:17:11.875402+07	2026-11-12 10:17:11.875411+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
375ba6ca-d6cf-4920-9937-07f8ff7ace4a	11111111-1111-1111-1111-111111111111	BCD59916C8E3F52B295F4484BE721152AB30A1070AB0890CBF1FFC2BA78F4CB6	2026-11-26 10:33:50.877195+07	2026-11-12 10:33:50.877203+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
143a0fb5-468f-4b53-9000-12eb9b4648c8	646a813a-c2f0-434a-90f3-0d489b96ca01	4F258DE7EC27AF6038CC62326EBACE98C91BEA3FD33B7802F7A975912B25B019	2026-11-26 10:33:55.756282+07	2026-11-12 10:33:55.756288+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
181c8fca-3504-4cee-ab23-5cffba7609f2	646a813a-c2f0-434a-90f3-0d489b96ca01	C75DAC4FA82E5D344AB7E1D297A471493C0E05C8B20103033ED4E971EDA6750C	2026-11-26 10:36:50.274177+07	2026-11-12 10:36:50.274183+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
6917315d-2d70-490f-9ccb-e5b6e004afc9	11111111-1111-1111-1111-111111111111	7524DA63DC9F2F6D02ED2DD0FC89E5B73DC8768F01E1FE1D8D4009E3971C34F3	2026-11-26 10:37:28.428498+07	2026-11-12 10:37:28.4285+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
313b62c2-b72a-4272-a74c-4e58de47de66	646a813a-c2f0-434a-90f3-0d489b96ca01	C11A3A43835CFD50822FA08E9ABBAC8BB0523AD8BD26DA92BFE9D2D35FAE1A48	2026-11-26 10:38:07.194145+07	2026-11-12 10:38:07.194152+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
bf32475c-78db-421f-84d3-051ebd679f0f	646a813a-c2f0-434a-90f3-0d489b96ca01	9599E745109288A38CE214FBC2E0297F24C499B0F0BD5B2E4A73945EC8ABEF87	2026-11-26 10:40:22.172105+07	2026-11-12 10:40:22.172123+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
79ea7b06-9344-410e-92c1-5cbb4dd26533	646a813a-c2f0-434a-90f3-0d489b96ca01	41659859FEE4B22736F57B9274C601A315F1BD132D47506C6E51CFE626141B65	2026-11-26 10:40:33.263811+07	2026-11-12 10:40:33.263818+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
e0e09aff-c2dd-4468-a64d-0d01cc40e2f2	11111111-1111-1111-1111-111111111111	7A395DF8DABF1993E634DF4CEB8619A3CE756FC52FBC3F7E1A865647AA4D962E	2026-11-26 11:05:53.407909+07	2026-11-12 11:05:53.407921+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
28c76033-e9ea-43b9-a687-3f741eaf0aaa	11111111-1111-1111-1111-111111111111	522515F42FBDFAF4991315000183F71894276D0208896469C4E17250C9EFDA51	2026-11-26 11:06:29.913146+07	2026-11-12 11:06:29.913149+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
c08c80b8-6b32-4bda-ae41-3d8b8cc80052	646a813a-c2f0-434a-90f3-0d489b96ca01	AB7A6EB4A0EB376D36119E4380CA7A2C6B4645F4FF7DA08E7A220F60D3111CFC	2026-11-26 11:17:59.048533+07	2026-11-12 11:17:59.048539+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
0a0bf80c-26da-4c7f-a3a0-cde2e7b8499e	646a813a-c2f0-434a-90f3-0d489b96ca01	347754F9A429FBF3E8BD7900B337D80F6C8CCC494D7CE2D8D0F04537F54B0B21	2026-11-26 11:18:12.678111+07	2026-11-12 11:18:12.678118+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
7acd4e46-a4e8-41f5-bca8-6b91bdd2ea59	646a813a-c2f0-434a-90f3-0d489b96ca01	C1B72687F8839809A7632E22D05C51CD2BC1E472998C8D4B86FD0CA19E02FF23	2026-11-26 11:18:40.488708+07	2026-11-12 11:18:40.488713+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
2587d0d5-2ad0-4743-a1d2-ee51de9fee8d	646a813a-c2f0-434a-90f3-0d489b96ca01	4B67BAA2381175CFB6C9CF4C27C0251E2BED80D90824596A13F047D408E59229	2026-11-26 11:19:09.952446+07	2026-11-12 11:19:09.952465+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
f874a48f-9ea3-4be7-bf41-1605e8084f2e	646a813a-c2f0-434a-90f3-0d489b96ca01	F3808093A0C950397A210ADD07E1027F86D2AFDA5077792AA534A2995E2ADD09	2026-11-26 11:39:41.361402+07	2026-11-12 11:39:41.361406+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
4c11e412-6e22-4ea6-b210-12ebd64dd266	11111111-1111-1111-1111-111111111111	0264EFEB1F8EB1DC2E5F285673D1209972AFEC1558588ACFA76D9C664C8DFB15	2026-11-26 12:19:50.746245+07	2026-11-12 12:19:50.746247+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
efb89fb1-f5d5-4bd3-9cb0-cbbf3650ef63	11111111-1111-1111-1111-111111111111	6A842D2DCA125AB6A8BDBF0CB3072DE7F0DBF4811CA8925BAEB6309A0A7C83A5	2026-11-26 12:23:57.45599+07	2026-11-12 12:23:57.455993+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
236acb17-cdc6-4c38-8726-e59e9187bb9a	646a813a-c2f0-434a-90f3-0d489b96ca01	585C7C06A04A20FEC0EEBFB791A14DCAE87471077B1EDEF1C7D7D42815E02D17	2026-11-26 12:26:49.514108+07	2026-11-12 12:26:49.514111+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
4180eb4e-dbfa-481a-8cc6-c1d886a75e96	646a813a-c2f0-434a-90f3-0d489b96ca01	84938B11944A02A7C1E43A8864A33CC8F6A0D89856DF25F3AFC39DF3C4FFF1BE	2026-11-26 12:27:05.23508+07	2026-11-12 12:27:05.235084+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
d501be9e-1d8c-456f-be87-7be4e985f623	646a813a-c2f0-434a-90f3-0d489b96ca01	AC88CF211E1C282F09858E64646FC030D98B114AE6ACE931C409F4B9A91770F1	2026-11-26 12:27:29.263445+07	2026-11-12 12:27:29.263447+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
f402e868-2d3b-491d-b64b-9123a6d30a93	646a813a-c2f0-434a-90f3-0d489b96ca01	CDE8447394052C9C281A208637DFEE1C4B3E7A12D2560672E65E665B5F595556	2026-11-26 12:29:18.578923+07	2026-11-12 12:29:18.578928+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
da8fa440-8ede-43ca-a962-518edf25e7d3	646a813a-c2f0-434a-90f3-0d489b96ca01	723C9A81A068A347AC69ABC9AABEC2F10550945FCC69472EC53610E157FAE2C6	2026-11-26 12:45:06.498427+07	2026-11-12 12:45:06.49843+07	2026-11-12 13:31:22.616773+07	\N	\N	\N	\N	\N	\N
07d3d48a-2f5a-4a6b-a5e0-9f1c197dd675	11111111-1111-1111-1111-111111111111	54D6192089209739AA90200DD29839AFE104F1CD187ED2DC3149555D91087DB8	2026-11-27 12:37:55.460463+07	2026-11-13 12:37:55.460466+07	\N	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Windows	127.0.0.1	2026-11-13 12:37:55.460466+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0
be4b9b58-0e12-42ce-bbbc-011c2a7355c7	11111111-1111-1111-1111-111111111111	B6202C8F365865BCED6E0B7769685C73A682076D0152A7424B4F0101957EF89E	2026-11-27 12:37:11.064225+07	2026-11-13 12:37:11.064231+07	2026-11-13 12:53:11.212025+07	876e3714-7504-4faa-855c-e1cd59787ef2	Chrome on Windows	127.0.0.1	2026-11-13 12:37:11.064231+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) OpenCode/2.2.7 Chrome/152.0.7977.167 Electron/44.9.1 Safari/537.36
145e8e88-db09-48a8-ad5b-34dd2c4bca94	11111111-1111-1111-1111-111111111111	3A957023F094B67C9CFDA0AB81AFF0A7F3EADB56E7CA8B466441B0A23925B091	2026-11-27 12:42:11.17744+07	2026-11-13 12:42:11.177442+07	2026-11-13 12:57:57.757108+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Windows	127.0.0.1	2026-11-13 12:42:11.177442+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0
58570992-0228-412a-8c39-876e2f68cbb0	11111111-1111-1111-1111-111111111111	5783ED787F4F999EB2DE27570D1636C393F9B3F21D3FDB55B2235E7197B6D6E5	2026-11-27 13:08:52.247343+07	2026-11-13 13:08:52.247349+07	2026-11-13 13:24:24.557457+07	876e3714-7504-4faa-855c-e1cd59787ef2	Chrome on Windows	127.0.0.1	2026-11-13 13:08:52.24735+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) OpenCode/2.2.7 Chrome/152.0.7977.167 Electron/44.9.1 Safari/537.36
6bda173b-40a6-4d62-bb4a-8ed8e8a13630	11111111-1111-1111-1111-111111111111	3F1A18652BA92256570B92C0C21AA30840EBE9166A90EE6831BA965CAE3A5368	2026-11-27 13:55:44.783299+07	2026-11-13 13:55:44.7833+07	2026-11-13 13:55:44.825788+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Windows	127.0.0.1	2026-11-13 13:55:44.7833+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0
86b40d28-38cf-472a-8418-7b2f94e79fbf	11111111-1111-1111-1111-111111111111	9AC07FBA2C3509DACAAAE661E1B817793BE427E90B89F14F096B6C1D015EC1C2	2026-11-27 13:55:56.566589+07	2026-11-13 13:55:56.56659+07	2026-11-13 13:55:56.744046+07	876e3714-7504-4faa-855c-e1cd59787ef2	Chrome on Windows	127.0.0.1	2026-11-13 13:55:56.56659+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) OpenCode/2.2.7 Chrome/152.0.7977.167 Electron/44.9.1 Safari/537.36
aa1cce4c-0962-45f6-9bd2-33b8d3f8f713	11111111-1111-1111-1111-111111111111	D0A4F9EE4F1CFDE1683C8530F39F04F585ABF3210359EA72A0327AA65D85090B	2026-11-27 13:55:44.825939+07	2026-11-13 13:55:44.825941+07	2026-11-13 20:08:47.449227+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Windows	127.0.0.1	2026-11-13 13:55:44.825941+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0
3a179fe5-2078-4f9f-9b49-6d52f4c4bd38	11111111-1111-1111-1111-111111111111	5B928333A92ED7914781DDC0754327356D710D1E951A749A6B3E2D0D262A2B89	2026-11-27 21:57:04.830879+07	2026-11-13 21:57:04.830886+07	2026-11-13 22:18:40.042174+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Windows	127.0.0.1	2026-11-13 21:57:04.830886+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0
9c7948d8-6205-4992-af45-79774f6d4ee8	11111111-1111-1111-1111-111111111111	68661B1E9F55F9E20818A47F3CEF6B6ABDAC0EF2DDEC7037C206E1EB16C4BD1B	2026-11-27 11:03:16.720162+07	2026-11-13 11:03:16.720164+07	2026-11-13 22:33:06.49064+07	direct-test	Mozilla/5.0	127.0.0.1	2026-11-13 11:03:16.720164+07	Local network	Mozilla/5.0
f97463d4-8f79-443d-8359-5660031f0030	11111111-1111-1111-1111-111111111111	88FB4FB6D0AE12A868F87507E6752C307EF647CA1A66F876973A978B7114DDF3	2026-11-27 11:03:56.9584+07	2026-11-13 11:03:56.958402+07	2026-11-13 22:33:06.49064+07	da42001a-8232-47eb-90ac-f3e93d419973	Chrome on Windows	127.0.0.1	2026-11-13 11:03:56.958402+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
aeaf319d-3ac0-4f79-acc8-d6704d56b23a	11111111-1111-1111-1111-111111111111	DF6277E2649062F13D78AEC0F8885644A5AB2E9FF7344870712A0AC8064825B9	2026-11-26 13:23:35.840032+07	2026-11-12 13:23:35.840145+07	2026-11-13 22:33:06.49064+07	b801061f-14fe-42ce-ab91-2dadb4d4afae	Chrome on Windows	127.0.0.1	2026-11-12 13:23:35.840185+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Freebuff/0.0.202 Chrome/130.0.6723.191 Electron/33.4.11 Safari/537.36
93950f39-2f8b-4fa1-b631-d537dcb1da43	11111111-1111-1111-1111-111111111111	39DB9C513B4BD20CC638D9797FDA7C02CAF0C73AAC0A48D01645B5019BF8FF39	2027-02-11 11:04:32.258081+07	2026-11-13 11:04:32.258082+07	2026-11-13 22:33:06.49064+07	fcdab315-c609-45f5-84a6-09ed0cd919fc	Chrome on Windows	127.0.0.1	2026-11-13 11:04:32.258082+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
d1ecfda0-3099-4417-9f47-fe210d5d87ec	11111111-1111-1111-1111-111111111111	E9636BA1D6608C085FF8BD382942EDE3FFCE20B6BC1CE405EA66B92148EC28AA	2026-11-27 11:23:20.159116+07	2026-11-13 11:23:20.159117+07	2026-11-13 22:33:06.49064+07	da0d2190-f579-48fc-8876-0cec1facf324	Chrome on Windows	127.0.0.1	2026-11-13 11:23:20.159117+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
d4932994-4afb-46ed-9c68-78c3ec1e0531	11111111-1111-1111-1111-111111111111	BBACD1907084946E1C13DD984E757B9382328D55DB1563BB0BA5A055E532E5F3	2026-11-27 11:26:07.674617+07	2026-11-13 11:26:07.674617+07	2026-11-13 22:33:06.49064+07	15eca76d-f003-4531-abd3-67429e50425e	Chrome on Windows	127.0.0.1	2026-11-13 11:26:07.674618+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
6035d839-18d9-444b-9abd-a54e121fa9d1	1c00e370-553a-4b57-814a-750592bde749	EDBAED790471E9EB2C7637097BE7517502F0CDE9779B577B03F2594B223BC306	2026-11-29 09:01:10.222152+07	2026-11-15 09:01:10.222187+07	\N	ffb955ff-8e72-4cc8-b9b5-b21b8ab375fb	Chrome on Windows	127.0.0.1	2026-11-15 09:01:10.222219+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
b1818565-7f8d-455d-8ed4-2e168d40aeb6	f270f4b2-47d8-43af-87e6-b26b4f461be1	1D205EECFF7D72B58A01C4364BB4C09979DE6FEB14803AD542987E0C2F4332F9	2026-11-29 09:01:16.204045+07	2026-11-15 09:01:16.204045+07	\N	6f4ca688-d816-42cc-944b-d89bfd8d6733	Chrome on Windows	127.0.0.1	2026-11-15 09:01:16.204046+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
fe14a403-b2a8-4ceb-8390-8d0d77e0a60c	84b454c4-cec0-48da-9bab-2e9c3d6fb757	E64F17852CEEE741D9DBD86D22CC3F35A6A48D42D427F7759CF6F37C9C4DEDAD	2026-11-29 09:05:51.725545+07	2026-11-15 09:05:51.725545+07	\N	57be40c7-bc64-4082-8499-985f19efdebb	Chrome on Windows	127.0.0.1	2026-11-15 09:05:51.725545+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
47771423-adc2-40ae-9964-0fd7b1231133	fd4df0cb-5588-4e33-a2ca-b7a80154d8c9	A2710B6B7EDC1C3854912852673A94D7D934D74CCCFC543B18BE95059BBEEC9A	2026-11-29 09:05:55.184381+07	2026-11-15 09:05:55.184381+07	\N	c1d0e94d-85dc-4409-819e-67cdc28ab9b0	Chrome on Windows	127.0.0.1	2026-11-15 09:05:55.184381+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
3cbcf85c-e108-4f10-83b2-7eaa75fb0d51	fd4df0cb-5588-4e33-a2ca-b7a80154d8c9	E717E45B04044AC0F08003795FFD0D226E9A825AABEF5AAA0986C8C1DE7C41CA	2026-11-29 09:05:55.268513+07	2026-11-15 09:05:55.268513+07	\N	\N	node	127.0.0.1	2026-11-15 09:05:55.268513+07	Local network	node
e7d064a2-95f8-42a9-9736-cab1cfa4a4f3	7853e257-27a1-4a2a-bf4b-1db151e13ff4	61A5B093134F81E3766117241551B226AF6098135523186ED2E164F70DCEC19F	2026-11-29 09:12:42.851806+07	2026-11-15 09:12:42.851867+07	\N	630936bc-0c85-46d4-851f-597d16eead3e	Chrome on Windows	127.0.0.1	2026-11-15 09:12:42.851912+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
0d2869c0-a66b-4fec-a6c1-3801ac05f0cc	6f6e2f8b-a1bc-415e-a5bb-c3d1485503f9	38509D38A1AF18A572A17F30D36915A97363A84DA0814AD39984CEE2F9B62B4B	2026-11-29 09:12:48.307124+07	2026-11-15 09:12:48.307126+07	\N	04ff5210-844c-4243-a649-33678b2914a1	Chrome on Windows	127.0.0.1	2026-11-15 09:12:48.307126+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
2cd1ccf4-42e3-4ab7-8211-6a6a340d1963	6f6e2f8b-a1bc-415e-a5bb-c3d1485503f9	BC00A153E449B39CB12DD24973D6B022918584FECACE4E8EFF5DDC2293DFCB0F	2026-11-29 09:12:48.94633+07	2026-11-15 09:12:48.946332+07	\N	\N	node	127.0.0.1	2026-11-15 09:12:48.946332+07	Local network	node
0a5a6942-55b5-4e4e-b320-a072944e8d24	35da2eb3-b7d1-43db-845e-d50c65568538	CB572590212B7E43685CCA9D249A0132E0E61BFA4FD585BB9A2CF2A5A9AC469F	2026-11-29 09:15:48.901574+07	2026-11-15 09:15:48.901575+07	\N	\N	Windows	127.0.0.1	2026-11-15 09:15:48.901575+07	Local network	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9818
85a33282-1055-4b51-b914-b232f16ac065	35da2eb3-b7d1-43db-845e-d50c65568538	11C81255787E0269EE1380B2651A9F11C1EC1BA2BD4EF4AABA3EF84758F7025C	2026-11-29 09:15:51.14407+07	2026-11-15 09:15:51.144109+07	\N	\N	Windows	127.0.0.1	2026-11-15 09:15:51.14411+07	Local network	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9818
76642408-8d2f-4228-8a58-bf171563f681	454f2508-bab7-4c52-9397-375fbaf1b894	B71E0BEA5D5DC0E90B34536948F79A2AFA7146C9F732A9F2E7B14D35575343AB	2026-11-29 09:21:42.064123+07	2026-11-15 09:21:42.064177+07	\N	\N	Windows	127.0.0.1	2026-11-15 09:21:42.064222+07	Local network	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9818
7083864a-f24a-438b-abe1-9b3f47c6f9d8	454f2508-bab7-4c52-9397-375fbaf1b894	0F3A3AED1CF6597F550E414E49CEAFC21E29E52E3F15EDD9AC962742550ACF01	2026-11-29 09:21:44.703683+07	2026-11-15 09:21:44.703684+07	\N	\N	Windows	127.0.0.1	2026-11-15 09:21:44.703684+07	Local network	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9818
6ab986e7-2dff-46f3-bd54-7176c29fbb2a	038646a7-db39-410c-8700-80857914e724	DEC961CE60EE2340F79C66BF8463C5E66C0489A911435FFFC8209B9E5B1D6F82	2026-11-29 09:23:40.28689+07	2026-11-15 09:23:40.286891+07	\N	\N	Windows	127.0.0.1	2026-11-15 09:23:40.286891+07	Local network	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9818
75ea4695-9558-4f85-bace-c148da61f6cb	038646a7-db39-410c-8700-80857914e724	FF52880C84357B598388675A26689650924FFA793CB3EDEDCC9C2ABE09CBB8CA	2026-11-29 09:23:42.38485+07	2026-11-15 09:23:42.38485+07	\N	\N	Windows	127.0.0.1	2026-11-15 09:23:42.384851+07	Local network	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9818
708f1c5f-39d7-4c96-8556-d1cb53d823a5	11111111-1111-1111-1111-111111111111	887FE8DCBD5BF08CA42B883ECD068EB449A6B9D982E4EC2B9017EAB480994A33	2026-11-29 09:32:58.935236+07	2026-11-15 09:32:58.93524+07	\N	557984a9-07dc-48b4-8ede-197b95b7cc1f	Chrome on Windows	127.0.0.1	2026-11-15 09:32:58.93524+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
90ce2f73-cabd-4d6b-95f9-7c55269a9b16	22222222-2222-2222-2222-222222222222	DCB714C7FF462306DCFDD247BE18A28074974036896252DC1EF4D66E73426A3A	2026-11-29 09:33:03.150423+07	2026-11-15 09:33:03.150423+07	\N	45a62e66-6db0-478f-a87e-2c03bfb69876	Chrome on Windows	127.0.0.1	2026-11-15 09:33:03.150424+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
25e56541-c7ed-44e1-abe5-c2012f760b28	22222222-2222-2222-2222-222222222222	F78963F188F7BC4DBAF1D4E8FD90C4FDCAAA13685E4A3DD44AC3A0B0B6E4756B	2026-11-29 09:33:03.561911+07	2026-11-15 09:33:03.561912+07	\N	\N	node	127.0.0.1	2026-11-15 09:33:03.561912+07	Local network	node
b01709cf-36e8-468f-a8bf-dc0798ce53e1	11111111-1111-1111-1111-111111111111	98452871AE3607F0B441B48977E27657C6A4A37296C1FC2335802C1E6D46849C	2026-11-29 09:32:58.816165+07	2026-11-15 09:32:58.816167+07	2026-11-15 09:50:15.293917+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Android	127.0.0.1	2026-11-15 09:32:58.816167+07	Local network	Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Edg/157.0.0.0 Mobile Safari/537.36
d03915fd-781e-406c-aafc-734a5a92d768	11111111-1111-1111-1111-111111111111	3E6B5721B53A18F9C760AD28682D099F6BB40B491D7A9475221D346AA0AF1C09	2026-11-29 10:01:43.919162+07	2026-11-15 10:01:43.919206+07	\N	65cc50af-6e1a-4fdb-959b-42e578ed6b89	Chrome on Windows	127.0.0.1	2026-11-15 10:01:43.919244+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
ad6b273f-d2ec-411a-ab07-229906e3bab8	22222222-2222-2222-2222-222222222222	5323FF75D6CE5CFC9EA03CAA03B56D3366403097526BF117A5C904A374780A7D	2026-11-29 10:01:48.572325+07	2026-11-15 10:01:48.572325+07	\N	be77cec4-fcc6-4929-a283-72a20765a91f	Chrome on Windows	127.0.0.1	2026-11-15 10:01:48.572325+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
b552a35f-d8c4-4193-a8a1-83346b927fda	22222222-2222-2222-2222-222222222222	4B89DD393F1F0FB4557B75E9DF36DA6F9C6F2D1A92CEDBABD8277F09571616AC	2026-11-29 10:01:48.74884+07	2026-11-15 10:01:48.748842+07	\N	\N	node	127.0.0.1	2026-11-15 10:01:48.748842+07	Local network	node
ed9a339c-a37d-43a1-8b35-4eb9967314ce	11111111-1111-1111-1111-111111111111	89217DF02F06329DC8D781F5E1745271DCDF9C7FFB655C1E1738A891EED2ADA1	2026-11-29 10:03:28.730304+07	2026-11-15 10:03:28.730304+07	\N	\N	Windows	127.0.0.1	2026-11-15 10:03:28.730304+07	Local network	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9818
d1f9314f-4767-4323-9f07-88bc80ffbbf1	11111111-1111-1111-1111-111111111111	B4814C89EE063931936C0ADC7C5995A900E0A3541C113DDA5DB802334BE15441	2026-11-29 10:04:13.925841+07	2026-11-15 10:04:13.925842+07	\N	a049cb25-6424-4adb-ab7e-7d3024048a06	Chrome on Windows	127.0.0.1	2026-11-15 10:04:13.925842+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
9f1a50c0-edf8-4e8a-ad7c-f9dd299b89f9	11111111-1111-1111-1111-111111111111	C2D558891B2F572CD5FC1857C3A5546FF1CBAEF718C993BF4CA8CC15B898FBDA	2026-11-29 09:50:15.294032+07	2026-11-15 09:50:15.294041+07	2026-11-15 11:42:28.890629+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Android	127.0.0.1	2026-11-15 09:50:15.294042+07	Local network	Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Edg/157.0.0.0 Mobile Safari/537.36
ab35cafd-32c5-4acb-a0b2-29e6b787aaf2	22222222-2222-2222-2222-222222222222	DE861D71801722AC13F2A1E4E7CB4081A8116C0C7FFB6994B2AA554BE21CB347	2026-11-29 10:04:17.359901+07	2026-11-15 10:04:17.359902+07	\N	86aa2a42-8b64-4fee-9098-f0d1d0613eb4	Chrome on Windows	127.0.0.1	2026-11-15 10:04:17.359902+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
d17aafa7-df67-428f-a1e7-ca0ce4a8887f	22222222-2222-2222-2222-222222222222	9F9BBAC4CA5A923CB81E013D0B1F55F763041DE9183F76D84A8F89D8DF084186	2026-11-29 10:04:17.428798+07	2026-11-15 10:04:17.428798+07	\N	\N	node	127.0.0.1	2026-11-15 10:04:17.428798+07	Local network	node
ed6920e3-5200-48a6-81cb-784cb4a41e95	11111111-1111-1111-1111-111111111111	708A20AA191F4667F9AF4DC5B1DA80504A1AD479FC17B1F10DB40D90E894F7E6	2026-11-29 10:09:22.894014+07	2026-11-15 10:09:22.894048+07	\N	75ad4aa5-e044-4dbc-b419-8cebc8c17140	Chrome on Windows	127.0.0.1	2026-11-15 10:09:22.894077+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
9437f118-85b4-4367-8212-49a44d7ff6a1	22222222-2222-2222-2222-222222222222	826E07C47082B1F72A4F1F7C5F1A78054BB01898EB13C784FC1FF5149138198D	2026-11-29 10:09:27.075192+07	2026-11-15 10:09:27.075193+07	\N	bc88fb0f-f148-45e1-9ebb-d2639c221819	Chrome on Windows	127.0.0.1	2026-11-15 10:09:27.075193+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
f20d5d5d-d2a6-4b60-8691-fa6dc5b1a5a5	22222222-2222-2222-2222-222222222222	1641402682B5075F71D555E82B05FE2B2F17025262053F6437D651A3A44C0075	2026-11-29 10:09:27.193199+07	2026-11-15 10:09:27.1932+07	\N	\N	node	127.0.0.1	2026-11-15 10:09:27.1932+07	Local network	node
e38a2af8-d4bd-4e5b-b1e5-e56121faae36	11111111-1111-1111-1111-111111111111	6F3AD9723A644BCAF90A8957D1837329FA9006DBF7172C62014EC0EC654E7F69	2026-11-29 11:42:28.891315+07	2026-11-15 11:42:28.891318+07	2026-11-15 11:42:29.709256+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Android	127.0.0.1	2026-11-15 11:42:28.891318+07	Local network	Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Edg/157.0.0.0 Mobile Safari/537.36
3027b06c-5df3-4e14-8abf-1851ffdeadc4	227da432-a60e-47d4-baaf-f81d767450d9	DEE64BBBCCA0F9EF10EB1EDC9B2E84ED67559CE6EC9E24866E23007928D92157	2026-11-29 12:16:53.926087+07	2026-11-15 12:16:53.926123+07	\N	5ca20240-085d-4e91-ba59-0772637c3a7d	Chrome on Windows	127.0.0.1	2026-11-15 12:16:53.926151+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
d40c41ad-53e8-4b88-9bc2-0d487f3489f4	76bc1dc1-03a0-4d5e-8635-b4adf58fea46	EADA8CEA682CC92DFD18BF8BDB6F1004C115242E2EE53D0080369E8ADDDBD638	2026-11-29 12:19:56.527675+07	2026-11-15 12:19:56.527675+07	\N	fb576d57-d2a5-4786-b8fb-b7132d5bf966	Chrome on Windows	127.0.0.1	2026-11-15 12:19:56.527675+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
b0d9b61c-89ce-42e3-88e3-ac0291c0ccb2	11111111-1111-1111-1111-111111111111	22DC7E2CBFCB8AEB3BB171E21056E85544007E2ACFE7B399E2A205A1CFA4F113	2026-11-29 11:42:29.709383+07	2026-11-15 11:42:29.709386+07	2026-11-15 12:22:09.702027+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Android	127.0.0.1	2026-11-15 11:42:29.709386+07	Local network	Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Edg/157.0.0.0 Mobile Safari/537.36
9d25e4e0-ae63-4665-916d-2651eb517433	11111111-1111-1111-1111-111111111111	76F5631BA151DDF65DDDC1143F2CD750CE993010D30943738A3DF9A369EEB596	2026-11-29 12:22:09.702349+07	2026-11-15 12:22:09.702351+07	2026-11-15 12:22:09.763927+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Android	127.0.0.1	2026-11-15 12:22:09.702351+07	Local network	Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Edg/157.0.0.0 Mobile Safari/537.36
96bb3608-f151-4e01-90e0-f953efeaa196	11111111-1111-1111-1111-111111111111	B35925DC7E0F0C1BB6A35968B55729B0E8B5664EEF588A64A95CB9E62230CF97	2026-11-29 12:22:09.764038+07	2026-11-15 12:22:09.76404+07	2026-11-15 12:22:09.964595+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Android	127.0.0.1	2026-11-15 12:22:09.76404+07	Local network	Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Edg/157.0.0.0 Mobile Safari/537.36
e3953c2c-48fe-4e68-8366-34ea0698b0f7	47fe91f4-83b0-4805-8422-17364d3f73ad	44EE61746E89A6340519B4F4B7AC587634DD043EB9743DDE012E8D1C1C22097C	2026-11-29 12:34:02.662207+07	2026-11-15 12:34:02.66224+07	\N	57c8ad0d-9c1d-4518-a160-0b679c8d42ff	Chrome on Windows	127.0.0.1	2026-11-15 12:34:02.662268+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
68585471-7ba6-471c-8ff2-5539ca2c1fca	0dba3d85-f6fe-43af-b556-60f5d33f1019	052387C6932FCCD762099439FC1104FDB5E643521C3F75B322DE1C9F9FE3A020	2026-11-29 12:45:25.991117+07	2026-11-15 12:45:25.99116+07	\N	222a4f36-e16d-4738-9d59-20c58e3aaf59	Chrome on Windows	127.0.0.1	2026-11-15 12:45:25.991192+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
d85ee05f-3568-4516-879b-a31c69f007ad	d1188e7b-c1b9-42a3-9a2f-7b236da5761d	015532D3FF4BAE3B4EA52CB502B9D7A1D490BF549CCC8A12782215EB6C6BE563	2026-11-29 12:46:36.538295+07	2026-11-15 12:46:36.538296+07	\N	be2c6e54-79e7-40f6-b1e0-fbf12c32eeb0	Chrome on Windows	127.0.0.1	2026-11-15 12:46:36.538296+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
e8dd1cde-fcb4-4a79-bf29-2e832ff27901	21198a95-6b09-47b6-8ff1-d9ba91125e30	F4382A78DAD521E21AB3BE5610D73569951EEA19F71C7BADDD01CC9AADD2A1BF	2026-11-29 18:07:27.02694+07	2026-11-15 18:07:27.026973+07	\N	f6a6d17d-3806-4579-8c91-93283b592247	Chrome on Windows	127.0.0.1	2026-11-15 18:07:27.026999+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
074a680b-798b-4640-ab08-7bf55e248756	a8ff3d84-dbdf-4a85-87ea-517fb56ef91f	947520F4CFA873EF714EBDE245EF0314DAD4CBD3A4FC78D6CB2778655D5437F9	2026-11-29 18:08:19.321294+07	2026-11-15 18:08:19.321294+07	\N	db8598bd-c706-41f5-b78e-abe7dd1e17b7	Chrome on Windows	127.0.0.1	2026-11-15 18:08:19.321294+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
e1baebbd-7eec-4439-83a1-fc268430576a	11111111-1111-1111-1111-111111111111	9D67A66DD29400FF0117A9850B5270047B330709CE627E8F40C76A4BC6D64DD4	2026-11-29 12:22:09.964662+07	2026-11-15 12:22:09.964663+07	2026-11-15 18:12:46.044251+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Android	127.0.0.1	2026-11-15 12:22:09.964663+07	Local network	Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Edg/157.0.0.0 Mobile Safari/537.36
dfdc3868-0a67-43fa-91cc-c0c782db51a7	11111111-1111-1111-1111-111111111111	97B6D4786E5E535BCD1358B2DCE4735DE8850C8B099C240AC904F1F3BA5EFAEB	2026-11-29 18:12:46.044618+07	2026-11-15 18:12:46.044621+07	2026-11-15 18:12:46.082546+07	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Android	127.0.0.1	2026-11-15 18:12:46.044621+07	Local network	Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Edg/157.0.0.0 Mobile Safari/537.36
2345ea55-8999-4ce0-82bc-1afc064d04b9	11111111-1111-1111-1111-111111111111	69753ED7BB0697C1B4A5EE58E73AE5444A5BB7F2609B0DD1518A4360543E5BCC	2026-11-29 18:12:46.082688+07	2026-11-15 18:12:46.082692+07	\N	2532a8ba-2f6e-4c9c-acc2-202cad158d84	Edge on Android	127.0.0.1	2026-11-15 18:12:46.082692+07	Local network	Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Edg/157.0.0.0 Mobile Safari/537.36
8e01e945-d9eb-48c1-b210-c5dbddca9c04	2f591a6e-6f4f-4abe-8edc-61affd306a2c	232B7176712FBD640C1087D87AD9289E2E14F3C7F932427A4C995849742AE943	2026-11-29 18:20:56.257306+07	2026-11-15 18:20:56.257366+07	\N	58eaacd0-6c08-49c7-b9a9-a1f476f2bdff	Chrome on Windows	127.0.0.1	2026-11-15 18:20:56.257421+07	Local network	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.8127.18 Safari/537.36
\.

COPY identity.user_preferences (user_id, theme, created_at, updated_at) FROM stdin;
45f8055f-6fa5-4fb3-8a0c-28f838a926e5	light	2026-11-12 10:15:28.749128+07	2026-11-12 10:15:28.902975+07
646a813a-c2f0-434a-90f3-0d489b96ca01	light	2026-11-12 10:14:31.299153+07	2026-11-12 10:19:42.260721+07
11111111-1111-1111-1111-111111111111	light	2026-11-12 10:33:51.201612+07	2026-11-13 12:06:59.28385+07
1c00e370-553a-4b57-814a-750592bde749	system	2026-11-15 09:01:16.809613+07	2026-11-15 09:01:16.809613+07
f270f4b2-47d8-43af-87e6-b26b4f461be1	system	2026-11-15 09:01:17.107453+07	2026-11-15 09:01:17.107453+07
84b454c4-cec0-48da-9bab-2e9c3d6fb757	system	2026-11-15 09:05:55.959344+07	2026-11-15 09:05:55.959344+07
fd4df0cb-5588-4e33-a2ca-b7a80154d8c9	system	2026-11-15 09:05:55.985713+07	2026-11-15 09:05:55.985713+07
7853e257-27a1-4a2a-bf4b-1db151e13ff4	system	2026-11-15 09:12:49.271095+07	2026-11-15 09:12:49.271095+07
6f6e2f8b-a1bc-415e-a5bb-c3d1485503f9	system	2026-11-15 09:12:49.388624+07	2026-11-15 09:12:49.388624+07
22222222-2222-2222-2222-222222222222	system	2026-11-15 09:33:03.47506+07	2026-11-15 09:33:03.47506+07
227da432-a60e-47d4-baaf-f81d767450d9	system	2026-11-15 12:16:56.458478+07	2026-11-15 12:16:56.458478+07
76bc1dc1-03a0-4d5e-8635-b4adf58fea46	system	2026-11-15 12:19:58.616219+07	2026-11-15 12:19:58.616219+07
47fe91f4-83b0-4805-8422-17364d3f73ad	system	2026-11-15 12:34:05.40976+07	2026-11-15 12:34:05.40976+07
0dba3d85-f6fe-43af-b556-60f5d33f1019	system	2026-11-15 12:45:28.728569+07	2026-11-15 12:45:28.728569+07
d1188e7b-c1b9-42a3-9a2f-7b236da5761d	system	2026-11-15 12:46:36.607741+07	2026-11-15 12:46:36.607741+07
21198a95-6b09-47b6-8ff1-d9ba91125e30	system	2026-11-15 18:07:30.905749+07	2026-11-15 18:07:30.905749+07
a8ff3d84-dbdf-4a85-87ea-517fb56ef91f	system	2026-11-15 18:08:19.373012+07	2026-11-15 18:08:19.373012+07
2f591a6e-6f4f-4abe-8edc-61affd306a2c	system	2026-11-15 18:20:58.995772+07	2026-11-15 18:20:58.995772+07
\.

COPY identity.users (id, email, display_name, password_hash, status, created_at, updated_at) FROM stdin;
11111111-1111-1111-1111-111111111111	alice@example.com	Alice Nguyen	v1.100000.PX+YNZzTTpv4TUbxVMDX/w==.LkRKJb5kQsHYBF9RCybldrpUVBD0G0R4CFBC47NlhHg=	active	2026-11-07 21:31:12.029618+07	2026-11-07 21:31:12.029618+07
22222222-2222-2222-2222-222222222222	bob@example.com	Bob Tran	v1.100000.u/Ux+trroaLrkwCZY/SvRA==.b9dzbNDo3AuBC44RQMWP0hAw5zUbctwUYx5ObnF3JAM=	active	2026-11-07 21:31:12.029618+07	2026-11-07 21:31:12.029618+07
33333333-3333-3333-3333-333333333333	carol@example.com	Carol Le	v1.100000.b2qo4vfS8FZA1Bsi60M8cw==.TPzZWl10r1CYIA3J/sHE+GT5oG6MktWiUGSwqki5PNE=	active	2026-11-07 21:31:12.029618+07	2026-11-07 21:31:12.029618+07
646a813a-c2f0-434a-90f3-0d489b96ca01	bugtest1794405026@example.com	Bug Tester	v1.100000.Udox0QoP/KJRo0bBLVkXlQ==.DGXmR1rIX3EyAAL6wMYVzL1kmADvy+yCXLgdU2zWGC0=	active	2026-11-11 20:50:29.313787+07	\N
bb9ccd00-cc78-48bb-9a87-8ae9c31420ef	dockdemo.16585@example.com	Dock Demo	v1.100000.gxfH8wv6109U2Y9FxOzIwQ==.OKI0eIxIcNPI1MRQjtFa9XdWyWQgnxPdoX0PNjg9wmM=	active	2026-11-12 09:15:55.156105+07	\N
45f8055f-6fa5-4fb3-8a0c-28f838a926e5	prefs.32165@example.com	Prefs Tester	v1.100000.RTe+3tg089rO8hP2ZMuYMw==.GZ3vdVAWuH+BAiqD7ema0l7TfTclY+zaUiPzu2mOhsQ=	active	2026-11-12 10:15:27.840275+07	\N
1c00e370-553a-4b57-814a-750592bde749	chat-alice-1794708064955-743@example.com	Chat alice	v1.100000.MUATurdtXK9ffALJR0Uv7A==.t7RDas232ScQ4335eK/Nnudh/bYldyUIr9EZE1c0/vk=	active	2026-11-15 09:01:09.978262+07	\N
f270f4b2-47d8-43af-87e6-b26b4f461be1	chat-bob-1794708074577-781@example.com	Chat bob	v1.100000.vtUQplj7HGtWcsMYoaw4Qg==.doAVbD8MRCv3Zh66T4W+KaD4wTDzuaXfEqbRNxkIC2k=	active	2026-11-15 09:01:16.198931+07	\N
84b454c4-cec0-48da-9bab-2e9c3d6fb757	chat-alice-1794708348372-492@example.com	Chat alice	v1.100000.K3LJEiSpjos5Fl5IzJ7GFA==.7p+aZLaoHYYPatbQnr1KrvBXiJKtNPpKSMCgmtxLEbU=	active	2026-11-15 09:05:51.718686+07	\N
fd4df0cb-5588-4e33-a2ca-b7a80154d8c9	chat-bob-1794708353850-83@example.com	Chat bob	v1.100000.BhszSAJuoAhW/T2VXsGwsw==.0wlX7zLuSFGV/NL5Ya1S2YuHHx8tsITa4tlGdn8YJIY=	active	2026-11-15 09:05:55.181947+07	\N
7853e257-27a1-4a2a-bf4b-1db151e13ff4	chat-alice-1794708754081-232@example.com	Chat alice	v1.100000.91sdLTW0V7JGM3RxwBXurw==.6ksx45hPGeR7fUXE64VilnruRhr0EbuMdO9t1/YWJT4=	active	2026-11-15 09:12:42.14654+07	\N
6f6e2f8b-a1bc-415e-a5bb-c3d1485503f9	chat-bob-1794708766191-726@example.com	Chat bob	v1.100000.WXfbdbw4+K0cH3v5cJt3fw==.VNFlMVw49vTUEgSPhUCqb6sz+8p6eEbxaPrnyURtdNs=	active	2026-11-15 09:12:48.294182+07	\N
35da2eb3-b7d1-43db-845e-d50c65568538	probe-1794708944283@example.com	Probe	v1.100000.WWCDKjxtFUsl7ju/RbiU/w==.vctyOmv5imp75AJ3XcwUTy73eR63LuDUbmbTZtV7QpE=	active	2026-11-15 09:15:48.895419+07	\N
454f2508-bab7-4c52-9397-375fbaf1b894	probe2-1794709295710@example.com	Probe	v1.100000.WtbRunJsAitEWQsiFqwwoA==.Rjs4+s3ZG0Rg2rGqw4HRc9YB1JSOH5gIR5rM/UO7gxQ=	active	2026-11-15 09:21:41.748751+07	\N
038646a7-db39-410c-8700-80857914e724	probe3-1794709415918@example.com	Probe	v1.100000./a50kbHs9TOgXJ3H83j7ng==.8gWKkT3L2DH5ot75uA1fxbHhyR5A5X2sUMxoaCRXERM=	active	2026-11-15 09:23:40.283059+07	\N
227da432-a60e-47d4-baaf-f81d767450d9	ui.test.1794719810495@example.com	Low End Test	v1.100000.So8vzhYp1dpHFKxaGsD0Pw==.DfjtztOp+DE2mcYdYrcYWIzn9sjh5zzaovHXulrxUmo=	active	2026-11-15 12:16:53.692647+07	\N
76bc1dc1-03a0-4d5e-8635-b4adf58fea46	ui.test2.1794719993586@example.com	Race Check	v1.100000.nEAXlDRZQJDFPF+mSoH5dA==.Bh8pThYu7UoZabG10VGTWckVyHM0B6Tf2usH0FitGYE=	active	2026-11-15 12:19:56.517617+07	\N
47fe91f4-83b0-4805-8422-17364d3f73ad	ui.test2.1794720839436@example.com	Race Check	v1.100000.B+IDCzIAPS8G3KdkXXsf/A==.FatOVAFpZu/4Y3DDZ+ZuE4il82NrTjtQkAEzONjAk1Q=	active	2026-11-15 12:34:02.556118+07	\N
0dba3d85-f6fe-43af-b556-60f5d33f1019	ui.test2.1794721522588@example.com	Race Check	v1.100000.kNhd96WpEBh/NvKIVh4M7g==.wd+P3/IfV6zMaIjC6STDCN3rsGgKvIZqy96aVnpt9PI=	active	2026-11-15 12:45:25.758787+07	\N
d1188e7b-c1b9-42a3-9a2f-7b236da5761d	ui.test.1794721595541@example.com	Low End Test	v1.100000.IIJ4lMklwMhVqUJJSDLDvw==.1JW3Ab7dr0Jgqzth6Hh4cf2LVwWag69mWH9sUW/4rVo=	active	2026-11-15 12:46:36.532762+07	\N
21198a95-6b09-47b6-8ff1-d9ba91125e30	race.1794740842146@example.com	Race Tester	v1.100000.D0rmR7+p6Nz/A/2qRYM80g==.XqmSMTgkn4miyIt0weFIalsATxiGgS+6XWrFUYULKH0=	active	2026-11-15 18:07:26.802245+07	\N
a8ff3d84-dbdf-4a85-87ea-517fb56ef91f	race.1794740898559@example.com	Race Tester	v1.100000.iZR3kMpWCx+qZ2gjOoVxlA==.WuiXQ5TL4kJXKL8pUMqaa3xCeqNVuEyUgivBCYyuxFM=	active	2026-11-15 18:08:19.318623+07	\N
2f591a6e-6f4f-4abe-8edc-61affd306a2c	race.1794741652808@example.com	Race Tester	v1.100000.WJEBq9+8wjOoCofTkeILIQ==.3RWn9G75t8R4EI6yFX9Yx6QRHDFUBK4EukJukRPulVM=	active	2026-11-15 18:20:55.959421+07	\N
\.

COPY notification.inbox_messages (event_id, event_type, processed_at) FROM stdin;
\.

COPY notification.notifications (id, recipient_user_id, type, actor_user_id, target_post_id, target_comment_id, preview, status, created_at, read_at, device_label, ip_address, location) FROM stdin;
0097d40b-ab43-48d2-827f-d0e720e283ea	22222222-2222-2222-2222-222222222222	friend_accepted	11111111-1111-1111-1111-111111111111	\N	\N	Alice Nguyen accepted your friend request	unread	2026-11-07 21:31:12.037498+07	\N	\N	\N	\N
cd85e5c2-982d-4163-9746-d30a5a166070	22222222-2222-2222-2222-222222222222	friend_accepted	11111111-1111-1111-1111-111111111111	\N	\N	Alice Nguyen accepted your friend request	unread	2026-11-07 21:50:00.317922+07	\N	\N	\N	\N
e3c4eb4c-939c-42ff-b33c-d71bb69d2ada	646a813a-c2f0-434a-90f3-0d489b96ca01	new_signin	\N	\N	\N	New sign-in from Chrome on Windows · Local network	unread	2026-11-12 13:32:19.629582+07	\N	\N	\N	\N
6168b55d-00ad-413f-836b-52507d519994	646a813a-c2f0-434a-90f3-0d489b96ca01	new_signin	\N	\N	\N	New sign-in from curl/8.22.0 · Local network	unread	2026-11-12 13:35:26.175059+07	\N	\N	\N	\N
6ff5b354-e221-4a59-9dc7-f06dd6d21baa	11111111-1111-1111-1111-111111111111	new_signin	\N	\N	\N	New sign-in from Mozilla/5.0 · Local network	read	2026-11-13 10:54:57.816281+07	2026-11-13 22:37:50.070831+07	\N	\N	\N
bc9cdaf2-0042-49cf-857b-ec19eb29b80c	11111111-1111-1111-1111-111111111111	new_signin	\N	\N	\N	New sign-in from Chrome on Windows · Local network	read	2026-11-13 11:01:23.170278+07	2026-11-13 22:37:50.070831+07	\N	\N	\N
5bc126b5-67f8-4df5-a314-fa6a55e9e525	11111111-1111-1111-1111-111111111111	new_signin	\N	\N	\N	New sign-in from Chrome on Windows · Local network	read	2026-11-13 11:02:16.770964+07	2026-11-13 22:37:50.070831+07	\N	\N	\N
408bbaa5-9092-43ca-8ec3-5b38ed3cc8f2	11111111-1111-1111-1111-111111111111	new_signin	\N	\N	\N	New sign-in from Mozilla/5.0 · Local network	read	2026-11-13 11:03:16.7246+07	2026-11-13 22:37:50.070831+07	\N	\N	\N
723d88b7-ed4b-400c-80d7-e2310129db97	11111111-1111-1111-1111-111111111111	new_signin	\N	\N	\N	New sign-in from Chrome on Windows · Local network	read	2026-11-13 11:03:54.669713+07	2026-11-13 22:37:50.070831+07	\N	\N	\N
eaf916e6-1751-4fee-93e4-d0f3518ad1e8	11111111-1111-1111-1111-111111111111	new_signin	\N	\N	\N	New sign-in from Chrome on Windows · Local network	read	2026-11-13 11:04:32.263315+07	2026-11-13 22:37:50.070831+07	\N	\N	\N
2da3184a-c70c-4f64-8f0f-8d1103050ea2	11111111-1111-1111-1111-111111111111	new_signin	\N	\N	\N	New sign-in from Edge on Windows · Local network	read	2026-11-13 11:10:51.111767+07	2026-11-13 22:37:50.070831+07	\N	\N	\N
56dc15e6-b59f-4f26-829e-fefc2c55e4bd	11111111-1111-1111-1111-111111111111	new_signin	\N	\N	\N	New sign-in from Chrome on Windows · Local network	read	2026-11-13 11:11:26.899448+07	2026-11-13 22:37:50.070831+07	\N	\N	\N
b7ef2c60-287b-46eb-9655-7563eb22155b	11111111-1111-1111-1111-111111111111	new_signin	\N	\N	\N	New sign-in from Chrome on Windows · Local network	read	2026-11-13 11:11:53.685729+07	2026-11-13 22:37:50.070831+07	\N	\N	\N
3c373e10-4518-4777-aee2-c4eb7298d6e1	11111111-1111-1111-1111-111111111111	new_signin	\N	\N	\N	New sign-in from Mozilla/5.0 · Local network	read	2026-11-13 11:11:55.275146+07	2026-11-13 22:37:50.070831+07	\N	\N	\N
923eb5e7-ee55-4c89-b135-f4d457195428	11111111-1111-1111-1111-111111111111	new_signin	\N	\N	\N	New sign-in from Mozilla/5.0 · Local network	read	2026-11-13 11:16:31.292231+07	2026-11-13 22:37:50.070831+07	\N	\N	\N
101ba9ac-5dc2-48c7-b4d1-30bfb11a6525	11111111-1111-1111-1111-111111111111	new_signin	\N	\N	\N	New sign-in from Chrome on Windows · Local network	read	2026-11-13 11:23:22.216832+07	2026-11-13 22:37:50.070831+07	\N	\N	\N
a5551d03-9e8c-40b7-8cd6-d817371e738c	11111111-1111-1111-1111-111111111111	new_signin	\N	\N	\N	New sign-in from Chrome on Windows · Local network	read	2026-11-13 11:26:09.725088+07	2026-11-13 22:37:50.070831+07	\N	\N	\N
dd895154-7dea-4907-9bff-aa6b401ef754	1c00e370-553a-4b57-814a-750592bde749	welcome	\N	\N	\N	Welcome to Connectly! Add a photo, a short bio and your city so people can find you.	unread	2026-11-15 09:01:14.132971+07	\N	\N	\N	\N
8c17592e-210e-402e-85eb-35183547f44a	f270f4b2-47d8-43af-87e6-b26b4f461be1	welcome	\N	\N	\N	Welcome to Connectly! Add a photo, a short bio and your city so people can find you.	unread	2026-11-15 09:01:16.216929+07	\N	\N	\N	\N
fc5f2596-3979-4d91-b89c-71d16564f8f6	84b454c4-cec0-48da-9bab-2e9c3d6fb757	welcome	\N	\N	\N	Welcome to Connectly! Add a photo, a short bio and your city so people can find you.	unread	2026-11-15 09:05:53.758413+07	\N	\N	\N	\N
f35ddece-a05f-4e8c-9f21-41694c97655e	fd4df0cb-5588-4e33-a2ca-b7a80154d8c9	welcome	\N	\N	\N	Welcome to Connectly! Add a photo, a short bio and your city so people can find you.	unread	2026-11-15 09:05:55.187073+07	\N	\N	\N	\N
e066738e-d631-439c-a7af-0d0f6a210adb	fd4df0cb-5588-4e33-a2ca-b7a80154d8c9	new_signin	\N	\N	\N	New sign-in from node · Local network	unread	2026-11-15 09:05:55.27171+07	\N	node	127.0.0.1	Local network
2b733936-8833-469a-b15c-aef5894bd519	7853e257-27a1-4a2a-bf4b-1db151e13ff4	welcome	\N	\N	\N	Welcome to Connectly! Add a photo, a short bio and your city so people can find you.	unread	2026-11-15 09:12:45.434117+07	\N	\N	\N	\N
26f2944d-4add-4ff6-9a99-259a852c0cbe	6f6e2f8b-a1bc-415e-a5bb-c3d1485503f9	welcome	\N	\N	\N	Welcome to Connectly! Add a photo, a short bio and your city so people can find you.	unread	2026-11-15 09:12:48.328682+07	\N	\N	\N	\N
f6deecd4-857c-4569-b1dd-1eef6bfbcc76	6f6e2f8b-a1bc-415e-a5bb-c3d1485503f9	new_signin	\N	\N	\N	New sign-in from node · Local network	unread	2026-11-15 09:12:48.969203+07	\N	node	127.0.0.1	Local network
8d1bbac9-82e6-4994-8ccf-3961d26f252f	35da2eb3-b7d1-43db-845e-d50c65568538	welcome	\N	\N	\N	Welcome to Connectly! Add a photo, a short bio and your city so people can find you.	unread	2026-11-15 09:15:50.965026+07	\N	\N	\N	\N
a6d9c51b-bf81-4aed-a4a6-d7afcf6368ce	35da2eb3-b7d1-43db-845e-d50c65568538	new_signin	\N	\N	\N	New sign-in from Windows · Local network	unread	2026-11-15 09:15:51.148839+07	\N	Windows	127.0.0.1	Local network
00019d93-198a-4f9e-a418-66b191c42f69	454f2508-bab7-4c52-9397-375fbaf1b894	welcome	\N	\N	\N	Welcome to Connectly! Add a photo, a short bio and your city so people can find you.	unread	2026-11-15 09:21:44.312155+07	\N	\N	\N	\N
8fa59458-10c5-4ad9-89b6-acdac1c4f5e0	454f2508-bab7-4c52-9397-375fbaf1b894	new_signin	\N	\N	\N	New sign-in from Windows · Local network	unread	2026-11-15 09:21:44.71179+07	\N	Windows	127.0.0.1	Local network
6344ab44-f5ba-460c-91b4-c6bc872c9a89	038646a7-db39-410c-8700-80857914e724	welcome	\N	\N	\N	Welcome to Connectly! Add a photo, a short bio and your city so people can find you.	unread	2026-11-15 09:23:42.346612+07	\N	\N	\N	\N
6d123a9e-76fd-4e7e-bbfc-d2fa3117edb4	038646a7-db39-410c-8700-80857914e724	new_signin	\N	\N	\N	New sign-in from Windows · Local network	unread	2026-11-15 09:23:44.424385+07	\N	Windows	127.0.0.1	Local network
82daf4b9-0b58-4b75-94a9-6ea7bd83da5d	22222222-2222-2222-2222-222222222222	new_signin	\N	\N	\N	New sign-in from Chrome on Windows · Local network	unread	2026-11-15 09:33:03.158912+07	\N	Chrome on Windows	127.0.0.1	Local network
c1d5bd47-2ba6-4b5b-b619-0773dcc155d8	22222222-2222-2222-2222-222222222222	new_signin	\N	\N	\N	New sign-in from node · Local network	unread	2026-11-15 09:33:03.570619+07	\N	node	127.0.0.1	Local network
1897ba95-9c5b-414c-b18c-443d7f019817	22222222-2222-2222-2222-222222222222	new_signin	\N	\N	\N	New sign-in from Chrome on Windows · Local network	unread	2026-11-15 10:01:48.591993+07	\N	Chrome on Windows	127.0.0.1	Local network
cd4d165e-cec4-4c40-9dfa-b3909b0f8596	22222222-2222-2222-2222-222222222222	new_signin	\N	\N	\N	New sign-in from node · Local network	unread	2026-11-15 10:01:48.771904+07	\N	node	127.0.0.1	Local network
14e8c284-43c0-4d4d-9a47-b1ad9cf77c0c	22222222-2222-2222-2222-222222222222	new_signin	\N	\N	\N	New sign-in from Chrome on Windows · Local network	unread	2026-11-15 10:04:17.366831+07	\N	Chrome on Windows	127.0.0.1	Local network
7a17fc68-8e90-492c-a187-a5459011a4a2	22222222-2222-2222-2222-222222222222	new_signin	\N	\N	\N	New sign-in from node · Local network	unread	2026-11-15 10:04:17.431561+07	\N	node	127.0.0.1	Local network
ca75b250-ce75-40e1-8e00-156b1d909507	22222222-2222-2222-2222-222222222222	new_signin	\N	\N	\N	New sign-in from Chrome on Windows · Local network	unread	2026-11-15 10:09:27.085901+07	\N	Chrome on Windows	127.0.0.1	Local network
1beabdd3-8358-4768-a0ff-ecb14bd4f5ee	22222222-2222-2222-2222-222222222222	new_signin	\N	\N	\N	New sign-in from node · Local network	unread	2026-11-15 10:09:27.214228+07	\N	node	127.0.0.1	Local network
c82ce9ab-abed-45ca-9726-1ec61526f726	227da432-a60e-47d4-baaf-f81d767450d9	welcome	\N	\N	\N	Welcome to Connectly! Add a photo, a short bio and your city so people can find you.	unread	2026-11-15 12:16:56.053937+07	\N	\N	\N	\N
947b11d2-8871-4b44-a91f-5c8a772765bb	76bc1dc1-03a0-4d5e-8635-b4adf58fea46	welcome	\N	\N	\N	Welcome to Connectly! Add a photo, a short bio and your city so people can find you.	unread	2026-11-15 12:19:58.55137+07	\N	\N	\N	\N
418b8146-712f-43f2-9dd2-ec77118fcdb3	11111111-1111-1111-1111-111111111111	new_signin	\N	\N	\N	New sign-in from Chrome on Windows · Local network	read	2026-11-15 09:33:00.999172+07	2026-11-15 12:23:06.142463+07	Chrome on Windows	127.0.0.1	Local network
73e1e311-c6e4-48ba-ade1-96d7101f909e	11111111-1111-1111-1111-111111111111	new_signin	\N	\N	\N	New sign-in from Chrome on Windows · Local network	read	2026-11-15 10:01:46.350385+07	2026-11-15 12:23:06.142463+07	Chrome on Windows	127.0.0.1	Local network
9b2fc575-84bf-46b6-bb9e-f145c6067553	11111111-1111-1111-1111-111111111111	new_signin	\N	\N	\N	New sign-in from Windows · Local network	read	2026-11-15 10:03:30.753826+07	2026-11-15 12:23:06.142463+07	Windows	127.0.0.1	Local network
db7bf5e1-0f79-4fa5-9efe-23cb54e1889d	11111111-1111-1111-1111-111111111111	new_signin	\N	\N	\N	New sign-in from Chrome on Windows · Local network	read	2026-11-15 10:04:15.959066+07	2026-11-15 12:23:06.142463+07	Chrome on Windows	127.0.0.1	Local network
05d15183-2877-44f6-9638-b11a16341293	11111111-1111-1111-1111-111111111111	new_signin	\N	\N	\N	New sign-in from Chrome on Windows · Local network	read	2026-11-15 10:09:25.227945+07	2026-11-15 12:23:06.142463+07	Chrome on Windows	127.0.0.1	Local network
f987bc9b-286d-4c99-8449-a759ff33929c	47fe91f4-83b0-4805-8422-17364d3f73ad	welcome	\N	\N	\N	Welcome to Connectly! Add a photo, a short bio and your city so people can find you.	unread	2026-11-15 12:34:04.911951+07	\N	\N	\N	\N
e35b54dd-36df-4ec7-8bec-e1bdf8a15a8d	0dba3d85-f6fe-43af-b556-60f5d33f1019	welcome	\N	\N	\N	Welcome to Connectly! Add a photo, a short bio and your city so people can find you.	unread	2026-11-15 12:45:28.23475+07	\N	\N	\N	\N
a443b958-66b6-4f34-8845-315338322963	d1188e7b-c1b9-42a3-9a2f-7b236da5761d	welcome	\N	\N	\N	Welcome to Connectly! Add a photo, a short bio and your city so people can find you.	unread	2026-11-15 12:46:36.544746+07	\N	\N	\N	\N
d55fd6a4-341e-4114-ad45-a2ac9e034a2b	21198a95-6b09-47b6-8ff1-d9ba91125e30	welcome	\N	\N	\N	Welcome to Connectly! Add a photo, a short bio and your city so people can find you.	unread	2026-11-15 18:07:30.464818+07	\N	\N	\N	\N
bc16d5fa-9fb9-4e4e-bf85-3aff29b189b7	a8ff3d84-dbdf-4a85-87ea-517fb56ef91f	welcome	\N	\N	\N	Welcome to Connectly! Add a photo, a short bio and your city so people can find you.	unread	2026-11-15 18:08:19.325524+07	\N	\N	\N	\N
44316094-6f65-4f53-830e-4375ef23e68a	2f591a6e-6f4f-4abe-8edc-61affd306a2c	welcome	\N	\N	\N	Welcome to Connectly! Add a photo, a short bio and your city so people can find you.	unread	2026-11-15 18:20:58.568391+07	\N	\N	\N	\N
\.

COPY notification.outbox_messages (id, event_type, payload, occurred_at, processed_at, attempts, last_error) FROM stdin;
\.

COPY social.comment_edits (id, comment_id, editor_user_id, previous_content, new_content, edited_at) FROM stdin;
b368d7c9-b8bc-4544-af84-45cc522d0bcc	81e7edca-7cda-4397-8846-716addf40544	11111111-1111-1111-1111-111111111111	Đẹp	Đẹp qjas	2026-11-12 11:08:16.139959+07
\.

COPY social.comment_mentions (comment_id, user_id, created_at) FROM stdin;
\.

COPY social.comment_reactions (comment_id, user_id, reaction_type, created_at) FROM stdin;
\.

COPY social.comments (id, post_id, author_user_id, parent_comment_id, content, status, created_at, updated_at) FROM stdin;
cc838dc4-0aca-4a6c-b718-694623c08765	1d48832f-9e2d-497f-a706-c5a6e3b72324	11111111-1111-1111-1111-111111111111	\N	sadsd	active	2026-11-08 12:09:08.570247+07	2026-11-08 12:09:08.570286+07
59b846af-c682-4292-923c-255f6f1b4044	93fae49b-620f-4e90-9403-3fe95ecc514a	11111111-1111-1111-1111-111111111111	\N	sadda	active	2026-11-08 12:33:48.564474+07	2026-11-08 12:33:48.564516+07
d1221177-4a0b-407a-81e2-3bf93c666943	93fae49b-620f-4e90-9403-3fe95ecc514a	11111111-1111-1111-1111-111111111111	\N	sadd	active	2026-11-08 12:33:53.575583+07	2026-11-08 12:33:53.575583+07
f455ca3f-407d-4261-9c77-d9fd390c3d9a	462c008e-1e79-4490-a4bb-ad5267c340f5	11111111-1111-1111-1111-111111111111	81e7edca-7cda-4397-8846-716addf40544	lllll	deleted	2026-11-12 11:12:02.000234+07	2026-11-12 12:38:17.682794+07
81e7edca-7cda-4397-8846-716addf40544	462c008e-1e79-4490-a4bb-ad5267c340f5	11111111-1111-1111-1111-111111111111	\N	Đẹp qjas	deleted	2026-11-12 11:08:03.371187+07	2026-11-12 12:38:17.682794+07
\.

COPY social.event_attendees (event_id, user_id, rsvp, created_at) FROM stdin;
\.

COPY social.events (id, title, description, location_text, online_url, starts_at, ends_at, host_user_id, group_id, created_at, updated_at) FROM stdin;
\.

COPY social.friendships (id, user_low_id, user_high_id, requested_by_user_id, status, created_at, responded_at) FROM stdin;
1a912918-72c0-475b-bd8a-83220ec6f6e2	11111111-1111-1111-1111-111111111111	22222222-2222-2222-2222-222222222222	11111111-1111-1111-1111-111111111111	1	2026-11-07 21:31:12.032263+07	2026-11-07 21:31:12.032263+07
\.

COPY social.group_members (group_id, user_id, role, status, joined_at) FROM stdin;
\.

COPY social.groups (id, name, description, visibility, created_by_user_id, created_at, updated_at) FROM stdin;
\.

COPY social.highlight_stories (highlight_id, story_id, sort_order) FROM stdin;
\.

COPY social.highlights (id, owner_user_id, title, created_at) FROM stdin;
\.

COPY social.inbox_messages (event_id, event_type, processed_at) FROM stdin;
fea310f3-4ece-4995-8236-53d4b8f3fdd9	identity.user-registered.v1	2026-11-15 12:45:27.68519+07
a74f5ef4-f146-4e49-81a2-7ed377889202	identity.user-registered.v1	2026-11-15 12:46:37.458551+07
56605472-9b93-466b-be6c-e03ee0295417	identity.user-registered.v1	2026-11-15 18:18:27.288095+07
2584d818-0bc3-4e02-88ae-dc7840290274	identity.user-registered.v1	2026-11-15 18:18:27.340054+07
ca91ece3-10b2-4fa4-ac45-4b830b63af02	identity.user-registered.v1	2026-11-15 18:20:59.244832+07
\.

COPY social.media_assets (id, owner_user_id, object_key, content_type, size_bytes, kind, status, created_at) FROM stdin;
9ef23527-7532-4e14-9229-7ee2d7b83d38	11111111-1111-1111-1111-111111111111	social-data/posts/2026/11/8624d6c0-b2b0-4a3f-8f9d-6c4a9740900d.bin	image/png	1960997	post	ready	2026-11-11 22:03:00.872056+07
30a25fb9-e2ec-40c9-8a03-9aabb958f54b	11111111-1111-1111-1111-111111111111	social-data/posts/2026/11/45df1645-0b07-4502-91a3-540e57d0624c.bin	image/png	1960997	post	ready	2026-11-11 22:03:43.678239+07
0fa336ca-3dbc-4eb6-8f3e-e173a817b3e3	11111111-1111-1111-1111-111111111111	social-data/posts/2026/11/225c7fb8-070d-413e-b24f-ba1f5f4a1184.bin	image/png	1960997	post	ready	2026-11-11 22:10:00.990221+07
c2e6ffb1-b0e2-4b87-9a0f-1d604c375fc6	11111111-1111-1111-1111-111111111111	social-data/posts/2026/11/25d2e898-1dd3-4229-bf66-334dcfb195ad.png	image/png	1960997	post	ready	2026-11-11 22:13:20.825277+07
0540e2f9-8cff-44a3-be08-8f73ebd362bd	11111111-1111-1111-1111-111111111111	social-data/posts/2026/11/d5516800-533b-486f-8232-b10f69bcdbb9.bin	image/png	1234	post	abandoned	2026-11-11 20:45:50.96078+07
4b665db8-91c3-41ca-a919-1c1013986144	11111111-1111-1111-1111-111111111111	social-data/posts/2026/11/8541f839-d7ef-4a89-9c20-60f78ac41e37.bin	image/png	1234	post	abandoned	2026-11-11 20:43:12.005735+07
4bf94a96-88c0-48cc-8b8b-12c9496aa3b9	11111111-1111-1111-1111-111111111111	social-data/posts/2026/11/0a553a57-d4b4-4ca6-af4c-13e929bea9ab.bin	image/jpeg	404792	post	abandoned	2026-11-11 19:44:21.902104+07
8f38cbf7-d1e6-41f7-83bd-1696cad37860	11111111-1111-1111-1111-111111111111	social-data/posts/2026/11/c234c599-3288-423f-9d2c-00e427b8086d.bin	image/jpeg	404792	post	abandoned	2026-11-11 19:44:09.458748+07
f27c7656-0df2-4beb-bd32-1843e76cd0d7	11111111-1111-1111-1111-111111111111	social-data/posts/2026/11/d85eaf3f-14dc-4347-afc2-0d51c3bb1bfc.bin	image/jpeg	735787	post	abandoned	2026-11-11 19:48:45.512773+07
\.

COPY social.outbox_messages (id, event_type, payload, occurred_at, processed_at, attempts, last_error) FROM stdin;
4db566f0-91f6-44c6-b00e-be1886665d11	social.reaction-changed.v1	{"eventId":"655ac841-259d-4e18-a430-56618bfae57e","eventType":"social.reaction-changed.v1","eventVersion":1,"occurredAt":"2026-11-13T05:10:14.2412005+00:00","producer":"connectly-social","correlationId":"e219cc8f-8d1e-4c1e-a1cf-5c5df815751e","payload":{"postId":"462c008e-1e79-4490-a4bb-ad5267c340f5","postAuthorUserId":"11111111-1111-1111-1111-111111111111","reactorUserId":"11111111-1111-1111-1111-111111111111","reactionType":"love","removed":true}}	2026-11-13 12:10:14.2412+07	2026-11-13 12:10:16.171793+07	0	\N
46b51a09-c71a-4ca1-8b5d-f47cefcc0d9f	social.post-published.v1	{"eventId":"58ff19c2-d52a-4c9c-bbbc-591104de8eba","eventType":"social.post-published.v1","eventVersion":1,"occurredAt":"2026-11-08T05:02:40.0535109+00:00","producer":"connectly-social","correlationId":"19139a82-9191-4b21-834a-79582767818d","payload":{"postId":"1d48832f-9e2d-497f-a706-c5a6e3b72324","authorUserId":"11111111-1111-1111-1111-111111111111","visibility":"Public","textPreview":"Hello t\\u1EEB Connectly! Feed th\\u1EADt \\u0111\\u00E3 ch\\u1EA1y \\uD83C\\uDF89"}}	2026-11-08 12:02:40.05351+07	2026-11-13 11:17:04.31377+07	715	None of the specified endpoints were reachable
efbf6cbd-6a67-4696-b511-4dfc3fcaaee6	social.comment-created.v1	{"eventId":"2fc3a212-a1ed-48b1-be07-9ea40045a7b3","eventType":"social.comment-created.v1","eventVersion":1,"occurredAt":"2026-11-08T05:09:08.5894218+00:00","producer":"connectly-social","correlationId":"91fe1d59-0edc-4a9c-8c24-e77df9a3751f","payload":{"commentId":"cc838dc4-0aca-4a6c-b718-694623c08765","postId":"1d48832f-9e2d-497f-a706-c5a6e3b72324","postAuthorUserId":"11111111-1111-1111-1111-111111111111","commenterUserId":"11111111-1111-1111-1111-111111111111","textPreview":"sadsd"}}	2026-11-08 12:09:08.589421+07	2026-11-13 11:17:04.31859+07	611	None of the specified endpoints were reachable
f8b59bda-9429-4f58-9ce4-66ca74b4286d	social.reaction-changed.v1	{"eventId":"2e2e24ee-2f38-4fd8-bbc8-71acb168ab29","eventType":"social.reaction-changed.v1","eventVersion":1,"occurredAt":"2026-11-08T05:13:39.0558572+00:00","producer":"connectly-social","correlationId":"e09ee41f-3de2-41d9-aa43-06a8cc834b49","payload":{"postId":"1d48832f-9e2d-497f-a706-c5a6e3b72324","postAuthorUserId":"11111111-1111-1111-1111-111111111111","reactorUserId":"11111111-1111-1111-1111-111111111111","reactionType":"Like","removed":false}}	2026-11-08 12:13:39.055857+07	2026-11-13 11:17:04.320295+07	593	None of the specified endpoints were reachable
c18cb602-720f-445e-9180-11f4c294596a	social.reaction-changed.v1	{"eventId":"d6d5b6b5-215f-492d-9e58-56f208ae3f84","eventType":"social.reaction-changed.v1","eventVersion":1,"occurredAt":"2026-11-13T05:10:15.8502667+00:00","producer":"connectly-social","correlationId":"1908daa5-da1b-492d-a6a1-b1347fc63b18","payload":{"postId":"462c008e-1e79-4490-a4bb-ad5267c340f5","postAuthorUserId":"11111111-1111-1111-1111-111111111111","reactorUserId":"11111111-1111-1111-1111-111111111111","reactionType":"like","removed":true}}	2026-11-13 12:10:15.850266+07	2026-11-13 12:10:16.174066+07	0	\N
b2fb6911-eef8-4af6-9c28-3727a1dc3c0f	social.reaction-changed.v1	{"eventId":"f0c7381d-2aa1-4680-b897-65da2c64eb88","eventType":"social.reaction-changed.v1","eventVersion":1,"occurredAt":"2026-11-13T05:10:17.7065682+00:00","producer":"connectly-social","correlationId":"d7c5f350-c2a7-4a15-aac4-73f78c8e91c9","payload":{"postId":"462c008e-1e79-4490-a4bb-ad5267c340f5","postAuthorUserId":"11111111-1111-1111-1111-111111111111","reactorUserId":"11111111-1111-1111-1111-111111111111","reactionType":"wow","removed":false}}	2026-11-13 12:10:17.706568+07	2026-11-13 12:10:18.183317+07	0	\N
84bf1ef3-6201-4108-b4b6-76f6ee52e0af	social.post-deleted.v1	{"eventId":"2ab3fe91-c908-4bed-81a0-6962a6651f05","eventType":"social.post-deleted.v1","eventVersion":1,"occurredAt":"2026-11-13T15:38:56.8885533+00:00","producer":"connectly-social","correlationId":"f12e4503-3eb6-4029-a38e-3ec08aeb9555","payload":{"postId":"1d48832f-9e2d-497f-a706-c5a6e3b72324","authorUserId":"11111111-1111-1111-1111-111111111111"}}	2026-11-13 22:38:56.888553+07	2026-11-15 09:19:40.248808+07	19507	Already closed: The AMQP operation was interrupted: AMQP close-reason, initiated by Peer, code=530, text='NOT_ALLOWED - access to vhost '/' refused for user 'connectly'', classId=10, methodId=40
0af82a74-a705-47c1-a22c-abbe032069cc	social.reaction-changed.v1	{"eventId":"d9737ed2-54c4-4350-affa-8f63f80da70d","eventType":"social.reaction-changed.v1","eventVersion":1,"occurredAt":"2026-11-08T05:13:39.9183838+00:00","producer":"connectly-social","correlationId":"95718344-2ff0-442d-b20a-9136023d55fa","payload":{"postId":"1d48832f-9e2d-497f-a706-c5a6e3b72324","postAuthorUserId":"11111111-1111-1111-1111-111111111111","reactorUserId":"11111111-1111-1111-1111-111111111111","reactionType":"Like","removed":true}}	2026-11-08 12:13:39.918383+07	2026-11-13 11:17:04.321369+07	587	None of the specified endpoints were reachable
33e0ee57-b018-4e1d-8dde-25bec9f38cc3	social.reaction-changed.v1	{"eventId":"3a080098-9107-4d82-840e-e77df6bbbe6c","eventType":"social.reaction-changed.v1","eventVersion":1,"occurredAt":"2026-11-13T05:10:15.2787003+00:00","producer":"connectly-social","correlationId":"ce085927-a904-490c-a006-dedcb22b2560","payload":{"postId":"462c008e-1e79-4490-a4bb-ad5267c340f5","postAuthorUserId":"11111111-1111-1111-1111-111111111111","reactorUserId":"11111111-1111-1111-1111-111111111111","reactionType":"like","removed":false}}	2026-11-13 12:10:15.2787+07	2026-11-13 12:10:16.17298+07	0	\N
42be229e-dc58-4f73-b4f7-83d7f091d596	social.reaction-changed.v1	{"eventId":"3d4f9a7f-c225-41b7-8d38-bc96f5d8b4de","eventType":"social.reaction-changed.v1","eventVersion":1,"occurredAt":"2026-11-13T05:10:21.0688455+00:00","producer":"connectly-social","correlationId":"df887ba6-cd4d-4452-a72f-d5730d8974f1","payload":{"postId":"462c008e-1e79-4490-a4bb-ad5267c340f5","postAuthorUserId":"11111111-1111-1111-1111-111111111111","reactorUserId":"11111111-1111-1111-1111-111111111111","reactionType":"angry","removed":false}}	2026-11-13 12:10:21.068845+07	2026-11-13 12:10:22.197358+07	0	\N
70aa54ae-8676-47ee-9e12-a9c542e5ad06	social.post-deleted.v1	{"eventId":"ae2aef2a-b609-483a-a3e9-6a2dc0c8e7ad","eventType":"social.post-deleted.v1","eventVersion":1,"occurredAt":"2026-11-13T15:38:59.8547163+00:00","producer":"connectly-social","correlationId":"d2c39cfe-6f5d-4544-a8ec-43f013e429a9","payload":{"postId":"1d48832f-9e2d-497f-a706-c5a6e3b72324","authorUserId":"11111111-1111-1111-1111-111111111111"}}	2026-11-13 22:38:59.854716+07	2026-11-15 09:19:40.234714+07	19367	Already closed: The AMQP operation was interrupted: AMQP close-reason, initiated by Peer, code=530, text='NOT_ALLOWED - access to vhost '/' refused for user 'connectly'', classId=10, methodId=40
9667e753-adc3-4bce-9317-757180e87503	social.post-published.v1	{"eventId":"0b8cc927-e223-423c-9b49-e0fd19cf383c","eventType":"social.post-published.v1","eventVersion":1,"occurredAt":"2026-11-08T05:23:03.0369197+00:00","producer":"connectly-social","correlationId":"0ecdcc32-d8bc-4c75-8958-a48d8844e336","payload":{"postId":"93fae49b-620f-4e90-9403-3fe95ecc514a","authorUserId":"11111111-1111-1111-1111-111111111111","visibility":"Public","textPreview":"kkk"}}	2026-11-08 12:23:03.036919+07	2026-11-13 11:17:04.322631+07	540	None of the specified endpoints were reachable
b5dafe71-a100-4e79-bff2-6cddd39de02a	social.comment-created.v1	{"eventId":"7d85d5ce-d7bd-4cff-9506-e2e945e29480","eventType":"social.comment-created.v1","eventVersion":1,"occurredAt":"2026-11-08T05:33:53.5758237+00:00","producer":"connectly-social","correlationId":"fc452559-a80d-4672-a3eb-8b4d3f7f74ca","payload":{"commentId":"d1221177-4a0b-407a-81e2-3bf93c666943","postId":"93fae49b-620f-4e90-9403-3fe95ecc514a","postAuthorUserId":"11111111-1111-1111-1111-111111111111","commenterUserId":"11111111-1111-1111-1111-111111111111","textPreview":"sadd"}}	2026-11-08 12:33:53.575823+07	2026-11-13 11:17:04.327629+07	477	None of the specified endpoints were reachable
5746bc6e-96c6-422c-85ef-a7bcac1e5ea4	social.reaction-changed.v1	{"eventId":"7183c73e-b29a-4fc8-85b5-b104e37d6e98","eventType":"social.reaction-changed.v1","eventVersion":1,"occurredAt":"2026-11-11T12:43:22.9559919+00:00","producer":"connectly-social","correlationId":"904fccd2-190e-4688-afa2-f0de35739906","payload":{"postId":"93fae49b-620f-4e90-9403-3fe95ecc514a","postAuthorUserId":"11111111-1111-1111-1111-111111111111","reactorUserId":"11111111-1111-1111-1111-111111111111","reactionType":"Like","removed":true}}	2026-11-11 19:43:22.955991+07	2026-11-13 11:17:04.328815+07	260	None of the specified endpoints were reachable
7137171c-76c9-4d93-a265-f330699e58fa	social.post-published.v1	{"eventId":"880f7c99-02b2-4353-94b9-c2f3669ba00c","eventType":"social.post-published.v1","eventVersion":1,"occurredAt":"2026-11-11T13:40:16.615109+00:00","producer":"connectly-social","correlationId":"6b4c0028-bc2b-4d19-9478-bca9b6b65c0b","payload":{"postId":"676e95af-a83d-4c80-900f-86f5311a12ce","authorUserId":"11111111-1111-1111-1111-111111111111","visibility":"Public","textPreview":"diagnostic post 134014"}}	2026-11-11 20:40:16.615109+07	2026-11-13 11:17:04.333903+07	179	None of the specified endpoints were reachable
daa11f6e-5e49-42c1-84eb-3a1779196653	social.post-deleted.v1	{"eventId":"064165de-7b46-4e75-9be6-05e2af688353","eventType":"social.post-deleted.v1","eventVersion":1,"occurredAt":"2026-11-13T05:37:36.2531396+00:00","producer":"connectly-social","correlationId":"971bd6b4-d83b-40dd-bee5-cec3f10534bd","payload":{"postId":"462c008e-1e79-4490-a4bb-ad5267c340f5","authorUserId":"11111111-1111-1111-1111-111111111111"}}	2026-11-13 12:37:36.253139+07	2026-11-13 12:37:36.789905+07	0	\N
41ce0135-5f77-4247-a2ce-ee4f648d3b02	social.post-deleted.v1	{"eventId":"eee2f5ad-6c30-45a4-aefc-32ce58d3d923","eventType":"social.post-deleted.v1","eventVersion":1,"occurredAt":"2026-11-11T13:57:20.4790845+00:00","producer":"connectly-social","correlationId":"61310dd7-9610-43f5-90a1-9cb1bbfedf85","payload":{"postId":"676e95af-a83d-4c80-900f-86f5311a12ce","authorUserId":"11111111-1111-1111-1111-111111111111"}}	2026-11-11 20:57:20.479084+07	2026-11-13 11:17:04.335159+07	160	None of the specified endpoints were reachable
a0f38eab-e12b-464f-b020-a8c27874c94f	social.reaction-changed.v1	{"eventId":"bbf50be6-f70f-47e5-9224-480bf39638a4","eventType":"social.reaction-changed.v1","eventVersion":1,"occurredAt":"2026-11-08T05:33:33.3716593+00:00","producer":"connectly-social","correlationId":"b7016ee7-f94b-4c39-a546-0769168c668e","payload":{"postId":"93fae49b-620f-4e90-9403-3fe95ecc514a","postAuthorUserId":"11111111-1111-1111-1111-111111111111","reactorUserId":"11111111-1111-1111-1111-111111111111","reactionType":"Like","removed":false}}	2026-11-08 12:33:33.371659+07	2026-11-13 11:17:04.323835+07	505	None of the specified endpoints were reachable
74d837cb-667f-42b2-b387-14d98f4aa15d	social.post-deleted.v1	{"eventId":"14b58e21-bd6e-4b7a-8864-05b0f1cbe100","eventType":"social.post-deleted.v1","eventVersion":1,"occurredAt":"2026-11-13T15:39:02.618593+00:00","producer":"connectly-social","correlationId":"97efa05c-07b0-44e7-a6ee-2bb860d023f3","payload":{"postId":"1d48832f-9e2d-497f-a706-c5a6e3b72324","authorUserId":"11111111-1111-1111-1111-111111111111"}}	2026-11-13 22:39:02.618593+07	2026-11-15 09:19:40.24046+07	19254	Already closed: The AMQP operation was interrupted: AMQP close-reason, initiated by Peer, code=530, text='NOT_ALLOWED - access to vhost '/' refused for user 'connectly'', classId=10, methodId=40
2fd48197-3f62-4d75-8093-bbb92e6bfbde	social.reaction-changed.v1	{"eventId":"3d01fe90-6ed6-4586-a290-9d14fbaf96f3","eventType":"social.reaction-changed.v1","eventVersion":1,"occurredAt":"2026-11-08T05:33:43.4858286+00:00","producer":"connectly-social","correlationId":"4f622091-2e6a-4f95-98cc-44c4900b6122","payload":{"postId":"1d48832f-9e2d-497f-a706-c5a6e3b72324","postAuthorUserId":"11111111-1111-1111-1111-111111111111","reactorUserId":"11111111-1111-1111-1111-111111111111","reactionType":"Like","removed":false}}	2026-11-08 12:33:43.485828+07	2026-11-13 11:17:04.325051+07	496	None of the specified endpoints were reachable
cac1c898-4c50-4509-a4d1-3e20c8962a68	social.post-deleted.v1	{"eventId":"194253e3-ab32-46d3-8561-e47557deae10","eventType":"social.post-deleted.v1","eventVersion":1,"occurredAt":"2026-11-11T13:57:24.8124679+00:00","producer":"connectly-social","correlationId":"26f8b06f-f250-4cb5-ab8e-c20c415351ed","payload":{"postId":"2fd6b91e-0c7d-4759-94f7-398349cc3d54","authorUserId":"11111111-1111-1111-1111-111111111111"}}	2026-11-11 20:57:24.812467+07	2026-11-13 11:17:04.336282+07	160	None of the specified endpoints were reachable
44d1c0d1-64c7-4519-bcd1-57b41876ba1a	social.comment-created.v1	{"eventId":"65908666-44f5-4f65-8869-b9401b4f47b4","eventType":"social.comment-created.v1","eventVersion":1,"occurredAt":"2026-11-08T05:33:48.5877118+00:00","producer":"connectly-social","correlationId":"2450e184-eefe-4e91-835c-1480adc14ca1","payload":{"commentId":"59b846af-c682-4292-923c-255f6f1b4044","postId":"93fae49b-620f-4e90-9403-3fe95ecc514a","postAuthorUserId":"11111111-1111-1111-1111-111111111111","commenterUserId":"11111111-1111-1111-1111-111111111111","textPreview":"sadda"}}	2026-11-08 12:33:48.587711+07	2026-11-13 11:17:04.326362+07	486	None of the specified endpoints were reachable
1609f087-ffc4-4418-a803-14e01e304167	social.post-deleted.v1	{"eventId":"6b6fd081-8dd0-4002-9a18-4b3c13b31182","eventType":"social.post-deleted.v1","eventVersion":1,"occurredAt":"2026-11-11T13:57:27.1357464+00:00","producer":"connectly-social","correlationId":"c151066f-372d-4743-b1a7-55cca703e6e1","payload":{"postId":"5ee94676-4f3d-40da-aac4-9af0ef695b5c","authorUserId":"11111111-1111-1111-1111-111111111111"}}	2026-11-11 20:57:27.135746+07	2026-11-13 11:17:04.337267+07	160	None of the specified endpoints were reachable
f23cf787-ad96-4de8-a8fa-1f6601d027e0	social.post-deleted.v1	{"eventId":"116fa690-e62e-48ed-8d69-f4f64eec07ef","eventType":"social.post-deleted.v1","eventVersion":1,"occurredAt":"2026-11-11T13:57:39.9157549+00:00","producer":"connectly-social","correlationId":"b383d994-42a7-4d1b-8649-c18521a22218","payload":{"postId":"93fae49b-620f-4e90-9403-3fe95ecc514a","authorUserId":"11111111-1111-1111-1111-111111111111"}}	2026-11-11 20:57:39.915754+07	2026-11-13 11:17:04.338373+07	159	None of the specified endpoints were reachable
3a3b3d1b-59e0-488e-90d7-7662c02301d5	social.post-published.v1	{"eventId":"b8cad089-8a8e-474d-b843-867d3ef65e24","eventType":"social.post-published.v1","eventVersion":1,"occurredAt":"2026-11-11T13:37:51.6660677+00:00","producer":"connectly-social","correlationId":"7bebacbe-e70a-44e1-8352-bed7a95812a5","payload":{"postId":"2fd6b91e-0c7d-4759-94f7-398349cc3d54","authorUserId":"11111111-1111-1111-1111-111111111111","visibility":"Public","textPreview":"diagnostic post 133751"}}	2026-11-11 20:37:51.666067+07	2026-11-13 11:17:04.332526+07	183	None of the specified endpoints were reachable
a19d08c7-81b6-4795-90b0-65d68f66f7e7	social.post-published.v1	{"eventId":"ab6a7dc7-2cd3-4127-b9ab-17291e86643b","eventType":"social.post-published.v1","eventVersion":1,"occurredAt":"2026-11-11T13:23:38.9352425+00:00","producer":"connectly-social","correlationId":"3066d0ff-d518-4ef7-b5cd-b87e5783d411","payload":{"postId":"5ee94676-4f3d-40da-aac4-9af0ef695b5c","authorUserId":"11111111-1111-1111-1111-111111111111","visibility":"Public","textPreview":"diagnostic post 132336"}}	2026-11-11 20:23:38.935242+07	2026-11-13 11:17:04.330476+07	202	None of the specified endpoints were reachable
b7d434e0-4ec4-4a8d-b1d3-52650cb0fcc6	social.post-published.v1	{"eventId":"a19291ab-ad3d-4d6c-a821-4bc469d188b3","eventType":"social.post-published.v1","eventVersion":1,"occurredAt":"2026-11-11T14:07:02.787362+00:00","producer":"connectly-social","correlationId":"17010984-26e5-44fe-b24a-28a97d9dc917","payload":{"postId":"652a97de-950e-42a3-a926-d77e72ad416a","authorUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01","visibility":"Public","textPreview":"hello text only"}}	2026-11-11 21:07:02.787362+07	2026-11-13 11:17:04.339545+07	150	None of the specified endpoints were reachable
b73311af-3843-46ce-8ad3-f765994ed938	social.reaction-changed.v1	{"eventId":"89b6c610-abbc-4ed8-aa53-8364e556f487","eventType":"social.reaction-changed.v1","eventVersion":1,"occurredAt":"2026-11-11T14:36:14.7251944+00:00","producer":"connectly-social","correlationId":"dcbe167c-0de5-4fb9-befe-b15bf781afb0","payload":{"postId":"1d48832f-9e2d-497f-a706-c5a6e3b72324","postAuthorUserId":"11111111-1111-1111-1111-111111111111","reactorUserId":"11111111-1111-1111-1111-111111111111","reactionType":"like","removed":false}}	2026-11-11 21:36:14.725194+07	2026-11-13 11:17:04.340845+07	125	None of the specified endpoints were reachable
2994f6b8-2606-432b-9830-db47aa0eefbe	social.reaction-changed.v1	{"eventId":"41a3f75c-146c-4f74-982c-cab5e1af8abb","eventType":"social.reaction-changed.v1","eventVersion":1,"occurredAt":"2026-11-11T14:36:15.9592432+00:00","producer":"connectly-social","correlationId":"907b08a6-0482-4c17-a322-ae72e3f63a6f","payload":{"postId":"1d48832f-9e2d-497f-a706-c5a6e3b72324","postAuthorUserId":"11111111-1111-1111-1111-111111111111","reactorUserId":"11111111-1111-1111-1111-111111111111","reactionType":"like","removed":true}}	2026-11-11 21:36:15.959243+07	2026-11-13 11:17:04.342125+07	125	None of the specified endpoints were reachable
206184f1-0632-4266-bced-c213bc8aba8e	social.reaction-changed.v1	{"eventId":"436f0fb5-41d2-43f7-b175-375525a6bba7","eventType":"social.reaction-changed.v1","eventVersion":1,"occurredAt":"2026-11-11T14:36:17.3378028+00:00","producer":"connectly-social","correlationId":"c50f041b-df4c-4311-b5c6-59a915a51661","payload":{"postId":"1d48832f-9e2d-497f-a706-c5a6e3b72324","postAuthorUserId":"11111111-1111-1111-1111-111111111111","reactorUserId":"11111111-1111-1111-1111-111111111111","reactionType":"like","removed":false}}	2026-11-11 21:36:17.337802+07	2026-11-13 11:17:04.343439+07	125	None of the specified endpoints were reachable
c50e081b-400c-4a63-a63d-87d6cb5e05b7	social.post-published.v1	{"eventId":"8475bf2e-9687-4f27-ba8f-54416332938d","eventType":"social.post-published.v1","eventVersion":1,"occurredAt":"2026-11-11T15:10:01.1262768+00:00","producer":"connectly-social","correlationId":"79f910ec-52b9-4026-b8be-7d27263d7052","payload":{"postId":"cf0e0630-98f3-448f-b95e-908a9f3cb484","authorUserId":"11111111-1111-1111-1111-111111111111","visibility":"Public","textPreview":"B\\u1EE9c h\\u00ECnh n\\u00E0y \\u0111\\u1EB9p qu\\u00E1 ta !"}}	2026-11-11 22:10:01.126276+07	2026-11-13 11:17:04.360196+07	105	None of the specified endpoints were reachable
b388b746-5c0c-42bc-8558-b54ed9b57831	social.post-published.v1	{"eventId":"814b7c1d-1192-4fe4-8fed-f63b448aacbf","eventType":"social.post-published.v1","eventVersion":1,"occurredAt":"2026-11-11T15:12:02.8750242+00:00","producer":"connectly-social","correlationId":"efa18fef-2cb9-430b-92b9-e4d81f788b5d","payload":{"postId":"ec10d26d-c226-49ca-bbec-d209462a8a4e","authorUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01","visibility":"Public","textPreview":"after fix image post"}}	2026-11-11 22:12:02.875024+07	2026-11-13 11:17:04.363034+07	104	None of the specified endpoints were reachable
fa9070e8-1a17-49f0-8833-398a2d693b11	social.post-published.v1	{"eventId":"825b57a2-b285-43c8-86eb-a2cbf40aed8a","eventType":"social.post-published.v1","eventVersion":1,"occurredAt":"2026-11-11T14:51:34.5358038+00:00","producer":"connectly-social","correlationId":"92a6b1ac-95de-4845-bff6-03162e514a87","payload":{"postId":"ab8ff1c6-4781-42d0-937a-274168050404","authorUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01","visibility":"Public","textPreview":"post with image real"}}	2026-11-11 21:51:34.535803+07	2026-11-13 11:17:04.348903+07	114	None of the specified endpoints were reachable
d5d61d3f-a90d-473a-90c3-a58f9871eeec	social.post-deleted.v1	{"eventId":"67a498d3-bdc9-4838-9151-0852a27a3e77","eventType":"social.post-deleted.v1","eventVersion":1,"occurredAt":"2026-11-11T15:06:45.2140364+00:00","producer":"connectly-social","correlationId":"88c290d7-faa7-4414-b1f9-10858fadda10","payload":{"postId":"d8c53ad5-a075-4532-ad71-8867b581ce9d","authorUserId":"11111111-1111-1111-1111-111111111111"}}	2026-11-11 22:06:45.214036+07	2026-11-13 11:17:04.358347+07	107	None of the specified endpoints were reachable
064f6359-4fd7-45f5-9b20-0b7dedd6803f	social.reaction-changed.v1	{"eventId":"0e54d669-263c-4a59-8fbb-4e1dae859ff2","eventType":"social.reaction-changed.v1","eventVersion":1,"occurredAt":"2026-11-11T15:10:06.979716+00:00","producer":"connectly-social","correlationId":"94e798ec-414e-4253-9288-5404a6278e89","payload":{"postId":"cf0e0630-98f3-448f-b95e-908a9f3cb484","postAuthorUserId":"11111111-1111-1111-1111-111111111111","reactorUserId":"11111111-1111-1111-1111-111111111111","reactionType":"like","removed":false}}	2026-11-11 22:10:06.979716+07	2026-11-13 11:17:04.361531+07	105	None of the specified endpoints were reachable
82169742-dfb2-4e80-8d06-b421368d5d51	social.post-published.v1	{"eventId":"c98a4746-d4be-46af-bd0f-59c6e2471431","eventType":"social.post-published.v1","eventVersion":1,"occurredAt":"2026-11-11T15:13:21.2980349+00:00","producer":"connectly-social","correlationId":"1d23d017-987f-4ec3-86ed-95406b3437dc","payload":{"postId":"462c008e-1e79-4490-a4bb-ad5267c340f5","authorUserId":"11111111-1111-1111-1111-111111111111","visibility":"Public","textPreview":"T\\u1EA5m h\\u00ECnh n\\u00E0y \\u0111\\u1EB9p!"}}	2026-11-11 22:13:21.298034+07	2026-11-13 11:17:04.367465+07	103	None of the specified endpoints were reachable
4776a4f7-3771-4d9b-ad9a-1cf0701af4a9	social.post-deleted.v1	{"eventId":"66398c20-92aa-47b3-b066-450e92a1a73b","eventType":"social.post-deleted.v1","eventVersion":1,"occurredAt":"2026-11-11T15:13:04.8322454+00:00","producer":"connectly-social","correlationId":"dc27279d-c07f-4397-be12-efca4ee46814","payload":{"postId":"cf0e0630-98f3-448f-b95e-908a9f3cb484","authorUserId":"11111111-1111-1111-1111-111111111111"}}	2026-11-11 22:13:04.832245+07	2026-11-13 11:17:04.365678+07	103	None of the specified endpoints were reachable
9461c904-9e24-40be-ac2f-e3463894de96	social.user-followed.v1	{"eventId":"8994836a-c8d8-4654-ae93-00de132146af","eventType":"social.user-followed.v1","eventVersion":1,"occurredAt":"2026-11-11T14:48:06.0088122+00:00","producer":"connectly-social","correlationId":"97debd9f-a658-4050-839f-e92889f72c4e","payload":{"followerId":"11111111-1111-1111-1111-111111111111","followeeId":"22222222-2222-2222-2222-222222222222"}}	2026-11-11 21:48:06.008812+07	2026-11-13 11:17:04.345783+07	116	None of the specified endpoints were reachable
0c8b6571-1967-4ab9-bc56-2356d8dd1c38	social.post-published.v1	{"eventId":"4fa42690-5349-416d-b5cc-6a03f23556ed","eventType":"social.post-published.v1","eventVersion":1,"occurredAt":"2026-11-11T14:59:08.1923268+00:00","producer":"connectly-social","correlationId":"0a0da671-db7d-4db7-83f3-6c05c588ba0b","payload":{"postId":"76fc00f8-32e2-4acf-a79d-5740bd808003","authorUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01","visibility":"Public","textPreview":"post with image real"}}	2026-11-11 21:59:08.192326+07	2026-11-13 11:17:04.350455+07	111	None of the specified endpoints were reachable
305c1b8d-57bb-4ca6-927e-ade8403bd42e	social.post-published.v1	{"eventId":"9d92203c-0f03-49d0-b156-ab562709841c","eventType":"social.post-published.v1","eventVersion":1,"occurredAt":"2026-11-11T15:00:28.1275593+00:00","producer":"connectly-social","correlationId":"1f946f59-83ee-4577-81da-ac4830ca3cee","payload":{"postId":"cde18401-87f2-4b28-86e5-43c8b12b576c","authorUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01","visibility":"Public","textPreview":"gateway image post"}}	2026-11-11 22:00:28.127559+07	2026-11-13 11:17:04.352381+07	110	None of the specified endpoints were reachable
1129a138-434d-420e-b7f0-2210e4bbc68f	social.post-published.v1	{"eventId":"db264b55-20aa-4c1b-a43d-7348f4c28429","eventType":"social.post-published.v1","eventVersion":1,"occurredAt":"2026-11-11T15:03:01.1132214+00:00","producer":"connectly-social","correlationId":"395cb2f7-d129-4743-9977-1a2282c205b4","payload":{"postId":"74c946de-141b-4bb3-953c-34d35dbd419c","authorUserId":"11111111-1111-1111-1111-111111111111","visibility":"Public","textPreview":"sadasd"}}	2026-11-11 22:03:01.113221+07	2026-11-13 11:17:04.353715+07	108	None of the specified endpoints were reachable
53dc6e8e-6202-43c8-99c7-6530a2bd19d3	social.post-published.v1	{"eventId":"8ad2f1f5-0b34-422b-92dd-4b969bb48a11","eventType":"social.post-published.v1","eventVersion":1,"occurredAt":"2026-11-11T15:03:43.8801663+00:00","producer":"connectly-social","correlationId":"c3bcf0c0-a8f2-463f-8e00-1d7edaa8643d","payload":{"postId":"d8c53ad5-a075-4532-ad71-8867b581ce9d","authorUserId":"11111111-1111-1111-1111-111111111111","visibility":"Public","textPreview":"Bkav l\\u00E0 g\\u00EC?\\nB\\u1EE9c h\\u00ECnh n\\u00E0y \\u0111\\u1EB9p qu\\u00E1!!!"}}	2026-11-11 22:03:43.880166+07	2026-11-13 11:17:04.35628+07	108	None of the specified endpoints were reachable
4220ad2f-9558-44bd-b092-be99c65853eb	social.post-deleted.v1	{"eventId":"8e634154-5aeb-4d3a-8c7b-c300a882d886","eventType":"social.post-deleted.v1","eventVersion":1,"occurredAt":"2026-11-11T15:03:27.2406403+00:00","producer":"connectly-social","correlationId":"98394837-43a1-4d82-b672-702b074decb4","payload":{"postId":"74c946de-141b-4bb3-953c-34d35dbd419c","authorUserId":"11111111-1111-1111-1111-111111111111"}}	2026-11-11 22:03:27.24064+07	2026-11-13 11:17:04.355084+07	108	None of the specified endpoints were reachable
85515838-56e6-4e0e-9711-b6a24cdd1881	social.reaction-changed.v1	{"eventId":"0dd0ccc3-e24d-4bb8-98d6-c6ac577b3e5f","eventType":"social.reaction-changed.v1","eventVersion":1,"occurredAt":"2026-11-11T15:13:37.5303538+00:00","producer":"connectly-social","correlationId":"87ff96f2-1f5b-49d4-bf1c-fcefd7d37567","payload":{"postId":"462c008e-1e79-4490-a4bb-ad5267c340f5","postAuthorUserId":"11111111-1111-1111-1111-111111111111","reactorUserId":"11111111-1111-1111-1111-111111111111","reactionType":"like","removed":false}}	2026-11-11 22:13:37.530353+07	2026-11-13 11:17:04.369199+07	103	None of the specified endpoints were reachable
6bf00003-05e6-457e-947d-e6591067dbad	social.post-deleted.v1	{"eventId":"7b0988f3-d941-438e-93f9-b6567b2d32dd","eventType":"social.post-deleted.v1","eventVersion":1,"occurredAt":"2026-11-12T03:17:49.9028127+00:00","producer":"connectly-social","correlationId":"5158f895-f0d7-4039-bcce-8a8de54d5f52","payload":{"postId":"cde18401-87f2-4b28-86e5-43c8b12b576c","authorUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01"}}	2026-11-12 10:17:49.902812+07	2026-11-13 11:17:04.300651+07	82	None of the specified endpoints were reachable
c880a80c-dea3-4651-8cda-6bca7f820676	social.post-deleted.v1	{"eventId":"7a96958e-e288-41d5-b4f8-01112fdab621","eventType":"social.post-deleted.v1","eventVersion":1,"occurredAt":"2026-11-12T03:17:52.0035446+00:00","producer":"connectly-social","correlationId":"8842762d-d059-4faf-a5a8-e7a8666f8814","payload":{"postId":"ec10d26d-c226-49ca-bbec-d209462a8a4e","authorUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01"}}	2026-11-12 10:17:52.003544+07	2026-11-13 11:17:04.30363+07	82	None of the specified endpoints were reachable
8876d2a6-597c-44e0-a45b-9137d8c3861a	social.post-published.v1	{"eventId":"3a4dd416-0938-4d06-aa5d-c2c5e4b5bae3","eventType":"social.post-published.v1","eventVersion":1,"occurredAt":"2026-11-12T03:33:56.3249383+00:00","producer":"connectly-social","correlationId":"4ef7247a-3ddb-4303-83a7-5e9d69663934","payload":{"postId":"9bd5517c-8e74-489e-acc6-687b361de12e","authorUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01","visibility":"Public","textPreview":"ban dau"}}	2026-11-12 10:33:56.324938+07	2026-11-13 11:17:04.30484+07	78	None of the specified endpoints were reachable
d4fa2ef9-7d3d-45a8-9eab-09e7732967ff	social.post-published.v1	{"eventId":"a62437ca-ec33-45a2-a341-7386e72df0c9","eventType":"social.post-published.v1","eventVersion":1,"occurredAt":"2026-11-12T03:36:50.7559195+00:00","producer":"connectly-social","correlationId":"43fe7818-0db5-41bc-90b8-991a5829fbd2","payload":{"postId":"1ce204b4-dada-4f53-a3b2-4e8c14d6bbb4","authorUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01","visibility":"Public","textPreview":"ban dau"}}	2026-11-12 10:36:50.755919+07	2026-11-13 11:17:04.307243+07	77	None of the specified endpoints were reachable
1f025967-e5eb-40eb-ae9d-caa35bc21654	social.comment-created.v1	{"eventId":"1fae0b64-2844-435a-a67a-56d9b3c98291","eventType":"social.comment-created.v1","eventVersion":1,"occurredAt":"2026-11-12T03:36:51.8202154+00:00","producer":"connectly-social","correlationId":"e8543786-6638-4937-b709-6e4638675b74","payload":{"commentId":"f8dda2c0-af78-442b-9df4-f4e20095aae8","postId":"1ce204b4-dada-4f53-a3b2-4e8c14d6bbb4","postAuthorUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01","commenterUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01","textPreview":"comment goc"}}	2026-11-12 10:36:51.820215+07	2026-11-13 11:17:04.308777+07	77	None of the specified endpoints were reachable
49fdcf52-77f2-46f1-b8d7-a8b1a3cb3972	social.post-published.v1	{"eventId":"58910b8b-8a78-48d3-b252-fc3186d7e4f1","eventType":"social.post-published.v1","eventVersion":1,"occurredAt":"2026-11-11T14:50:10.3580732+00:00","producer":"connectly-social","correlationId":"1f7b3b43-9ac0-482d-af43-af7ed0d10900","payload":{"postId":"1f81c046-a752-45b5-be40-571636f92985","authorUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01","visibility":"Public","textPreview":"post with image real"}}	2026-11-11 21:50:10.358073+07	2026-11-13 11:17:04.347463+07	115	None of the specified endpoints were reachable
96300aa7-ec8c-47e1-9c9f-f0308c7b05f5	social.reaction-changed.v1	{"eventId":"618a3263-2071-4b68-8044-5eb25cea15ce","eventType":"social.reaction-changed.v1","eventVersion":1,"occurredAt":"2026-11-11T15:13:44.3008459+00:00","producer":"connectly-social","correlationId":"d793cf26-454e-4697-a062-c0be8350dd07","payload":{"postId":"462c008e-1e79-4490-a4bb-ad5267c340f5","postAuthorUserId":"11111111-1111-1111-1111-111111111111","reactorUserId":"11111111-1111-1111-1111-111111111111","reactionType":"love","removed":false}}	2026-11-11 22:13:44.300845+07	2026-11-13 11:17:04.371246+07	103	None of the specified endpoints were reachable
5a9f1471-81ae-4aba-be4e-2508799d9c11	social.post-published.v1	{"eventId":"d9a6dd54-e647-43c9-9d50-b7f073b81d47","eventType":"social.post-published.v1","eventVersion":1,"occurredAt":"2026-11-11T15:35:04.7971337+00:00","producer":"connectly-social","correlationId":"b7c75450-14d4-450a-9e7d-9318aae774f2","payload":{"postId":"6d404805-4c83-4e48-b916-341d7ec7ed4c","authorUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01","visibility":"Public","textPreview":"env driven s3"}}	2026-11-11 22:35:04.797133+07	2026-11-13 11:17:04.372399+07	99	None of the specified endpoints were reachable
1b6065c0-c6eb-439e-8ee4-3b82a0a03a03	social.post-deleted.v1	{"eventId":"6376a72b-f42d-4339-a5aa-ac8a64d7bee2","eventType":"social.post-deleted.v1","eventVersion":1,"occurredAt":"2026-11-12T03:17:37.3835183+00:00","producer":"connectly-social","correlationId":"7a9607d7-a7c6-4889-a17a-dc3d866df145","payload":{"postId":"1f81c046-a752-45b5-be40-571636f92985","authorUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01"}}	2026-11-12 10:17:37.383518+07	2026-11-13 11:17:04.373276+07	84	None of the specified endpoints were reachable
d3763662-2356-46cd-9662-80808453778a	social.post-deleted.v1	{"eventId":"fbe8eba8-b0cd-4fa3-9047-ec45f2195e47","eventType":"social.post-deleted.v1","eventVersion":1,"occurredAt":"2026-11-12T03:17:41.1225204+00:00","producer":"connectly-social","correlationId":"98d94ffa-a530-4012-9c69-84bd6045e3ad","payload":{"postId":"652a97de-950e-42a3-a926-d77e72ad416a","authorUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01"}}	2026-11-12 10:17:41.12252+07	2026-11-13 11:17:04.374319+07	84	None of the specified endpoints were reachable
3901e393-77af-40a7-9fe2-86e8871423b2	social.post-deleted.v1	{"eventId":"f6c7ecd8-c7c5-448f-993b-cad9040fde5e","eventType":"social.post-deleted.v1","eventVersion":1,"occurredAt":"2026-11-12T03:17:43.6741236+00:00","producer":"connectly-social","correlationId":"c9b19040-9789-4dd2-9322-13a980e9989c","payload":{"postId":"ab8ff1c6-4781-42d0-937a-274168050404","authorUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01"}}	2026-11-12 10:17:43.674123+07	2026-11-13 11:17:04.375285+07	84	None of the specified endpoints were reachable
23b75076-e3e0-4b19-9520-abccda449476	social.post-deleted.v1	{"eventId":"74007a6c-fe70-4c27-b2bc-b0638f37fe22","eventType":"social.post-deleted.v1","eventVersion":1,"occurredAt":"2026-11-12T03:17:47.5220734+00:00","producer":"connectly-social","correlationId":"0bab6fc1-7c95-4942-8ecf-6117c1ad1f91","payload":{"postId":"76fc00f8-32e2-4acf-a79d-5740bd808003","authorUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01"}}	2026-11-12 10:17:47.522073+07	2026-11-13 11:17:04.29283+07	83	None of the specified endpoints were reachable
705559aa-6d2b-4050-8189-b3502cb9855d	social.post-published.v1	{"eventId":"128c6995-9859-4b5d-9b76-f1fd21d735ec","eventType":"social.post-published.v1","eventVersion":1,"occurredAt":"2026-11-12T03:40:34.6988866+00:00","producer":"connectly-social","correlationId":"07ff5022-ff9c-4377-b2ea-13c439c1ace1","payload":{"postId":"0431a2bf-9275-4405-be73-7d94436ea7d7","authorUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01","visibility":"Public","textPreview":"post co hinh de test modal"}}	2026-11-12 10:40:34.698886+07	2026-11-13 11:17:04.31034+07	76	None of the specified endpoints were reachable
48bb65cc-cf6f-45e8-b210-4fb6e3cbdc7b	social.comment-created.v1	{"eventId":"f465d3c7-8de6-42c0-aaf7-a8640ecc2bab","eventType":"social.comment-created.v1","eventVersion":1,"occurredAt":"2026-11-12T04:12:02.008921+00:00","producer":"connectly-social","correlationId":"d719bc73-d085-42eb-bd46-226ab9a3c014","payload":{"commentId":"f455ca3f-407d-4261-9c77-d9fd390c3d9a","postId":"462c008e-1e79-4490-a4bb-ad5267c340f5","postAuthorUserId":"11111111-1111-1111-1111-111111111111","commenterUserId":"11111111-1111-1111-1111-111111111111","textPreview":"lllll"}}	2026-11-12 11:12:02.008921+07	2026-11-13 11:17:04.376936+07	0	\N
c8e73c21-0999-4699-a597-772bc75fa3a4	social.friend-request-created.v1	{"eventId":"4e376ec0-ddc8-41a2-9bfe-bd1c9f44f1f5","eventType":"social.friend-request-created.v1","eventVersion":1,"occurredAt":"2026-11-12T04:20:21.9453308+00:00","producer":"connectly-social","correlationId":"16c51c4d-8317-446f-a5ca-70d39ac148a3","payload":{"friendRequestId":"8f18da31-fe7a-43bb-bdd3-3e6f91e1a28e","requesterUserId":"6a584a8c-3f56-4385-8e5a-c0c7ff30e85e","targetUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01"}}	2026-11-12 11:20:21.94533+07	2026-11-13 11:17:04.377855+07	0	\N
2cd765c1-7127-4758-b965-0a50d206a5ea	social.reaction-changed.v1	{"eventId":"1e4d5b60-3ab0-47cd-8aa3-ff3042ef06f2","eventType":"social.reaction-changed.v1","eventVersion":1,"occurredAt":"2026-11-11T14:36:17.8389031+00:00","producer":"connectly-social","correlationId":"5acb37c6-8730-495a-81b9-54e70b6ed172","payload":{"postId":"1d48832f-9e2d-497f-a706-c5a6e3b72324","postAuthorUserId":"11111111-1111-1111-1111-111111111111","reactorUserId":"11111111-1111-1111-1111-111111111111","reactionType":"like","removed":true}}	2026-11-11 21:36:17.838903+07	2026-11-13 11:17:04.344601+07	123	None of the specified endpoints were reachable
bfe7a47b-c4d4-411e-981a-b75532cb781e	social.comment-created.v1	{"eventId":"f22754df-f956-482d-8155-3703902b253e","eventType":"social.comment-created.v1","eventVersion":1,"occurredAt":"2026-11-12T04:08:03.3756343+00:00","producer":"connectly-social","correlationId":"17bbcd1c-8ff3-4db3-941d-4368e518adfa","payload":{"commentId":"81e7edca-7cda-4397-8846-716addf40544","postId":"462c008e-1e79-4490-a4bb-ad5267c340f5","postAuthorUserId":"11111111-1111-1111-1111-111111111111","commenterUserId":"11111111-1111-1111-1111-111111111111","textPreview":"\\u0110\\u1EB9p"}}	2026-11-12 11:08:03.375634+07	2026-11-13 11:17:04.376189+07	0	\N
c8d75db7-ea3f-4390-9ac7-70522fd7eab8	social.comment-created.v1	{"eventId":"d590779c-1e87-4565-812c-31ab62a5a71f","eventType":"social.comment-created.v1","eventVersion":1,"occurredAt":"2026-11-12T03:33:57.3917768+00:00","producer":"connectly-social","correlationId":"ac16e656-c39f-44fb-b736-6a983f264a5d","payload":{"commentId":"4f8facae-7de7-42f0-976c-dd2755340eb2","postId":"9bd5517c-8e74-489e-acc6-687b361de12e","postAuthorUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01","commenterUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01","textPreview":"comment goc"}}	2026-11-12 10:33:57.391776+07	2026-11-13 11:17:04.30611+07	78	None of the specified endpoints were reachable
9d1e6542-1902-4261-80e0-fe67492721b4	social.friendship-accepted.v1	{"eventId":"be3a2976-51fc-4a32-b041-7ea05a438423","eventType":"social.friendship-accepted.v1","eventVersion":1,"occurredAt":"2026-11-12T04:20:22.2237628+00:00","producer":"connectly-social","correlationId":"d5044014-ee60-4fb1-ac9d-3e2b7e3acb46","payload":{"userLowId":"646a813a-c2f0-434a-90f3-0d489b96ca01","userHighId":"6a584a8c-3f56-4385-8e5a-c0c7ff30e85e"}}	2026-11-12 11:20:22.223762+07	2026-11-13 11:17:04.379184+07	0	\N
5f9b9d12-efbf-4a73-815c-72db89faa5bc	social.friend-request-created.v1	{"eventId":"244ce409-512b-4fc9-949e-119b8b79150e","eventType":"social.friend-request-created.v1","eventVersion":1,"occurredAt":"2026-11-12T04:37:40.4905034+00:00","producer":"connectly-social","correlationId":"c43975ed-582b-4fe5-8efd-2a4544dde0c3","payload":{"friendRequestId":"0050f9a6-163c-4d5f-b484-af1e92055624","requesterUserId":"d34a8c37-724d-4f9b-9aa1-0a137112558c","targetUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01"}}	2026-11-12 11:37:40.490503+07	2026-11-13 11:17:04.380289+07	0	\N
811c68cd-5a24-4be4-94ee-badfca4acc10	social.friendship-accepted.v1	{"eventId":"2d96b8c8-5b95-48e2-a1e8-f24b0c351763","eventType":"social.friendship-accepted.v1","eventVersion":1,"occurredAt":"2026-11-12T04:37:40.6827616+00:00","producer":"connectly-social","correlationId":"4e27fbcc-9399-491d-8057-9f47f2a2e9f2","payload":{"userLowId":"646a813a-c2f0-434a-90f3-0d489b96ca01","userHighId":"d34a8c37-724d-4f9b-9aa1-0a137112558c"}}	2026-11-12 11:37:40.682761+07	2026-11-13 11:17:04.381676+07	0	\N
6b164af0-71e4-4768-a4e7-864d9d1d41e3	social.comment-created.v1	{"eventId":"8c28d305-ac86-42dd-8859-e0301f9ada70","eventType":"social.comment-created.v1","eventVersion":1,"occurredAt":"2026-11-12T04:37:40.8285373+00:00","producer":"connectly-social","correlationId":"b3521b13-144c-4027-9d21-ac26f16f0cb7","payload":{"commentId":"30a253c7-c35d-4c75-b690-53f5d5c7a373","postId":"0431a2bf-9275-4405-be73-7d94436ea7d7","postAuthorUserId":"646a813a-c2f0-434a-90f3-0d489b96ca01","commenterUserId":"d34a8c37-724d-4f9b-9aa1-0a137112558c","textPreview":"friend here"}}	2026-11-12 11:37:40.828537+07	2026-11-13 11:17:04.383414+07	0	\N
\.

COPY social.page_admins (page_id, user_id, role, added_at) FROM stdin;
\.

COPY social.pages (id, name, description, category, avatar_object_key, cover_object_key, owner_user_id, created_at, updated_at) FROM stdin;
\.

COPY social.poll_options (id, post_id, text, sort_order) FROM stdin;
\.

COPY social.poll_votes (post_id, option_id, user_id, created_at) FROM stdin;
\.

COPY social.polls (post_id, question, allow_multiple, created_at) FROM stdin;
\.

COPY social.post_bookmarks (post_id, user_id, created_at) FROM stdin;
\.

COPY social.post_edits (id, post_id, editor_user_id, previous_text, new_text, edited_at) FROM stdin;
38bdcd59-112b-4eb2-ac94-d84108bfe0be	462c008e-1e79-4490-a4bb-ad5267c340f5	11111111-1111-1111-1111-111111111111	Tấm hình này đẹp!	Tấm hình này đẹp nha	2026-11-12 14:09:11.39103+07
\.

COPY social.post_hashtags (post_id, tag, created_at) FROM stdin;
\.

COPY social.post_media (id, post_id, object_key, content_type, size_bytes, sort_order) FROM stdin;
21ac6c79-9650-49c4-83c5-95afa3965423	74c946de-141b-4bb3-953c-34d35dbd419c	social-data/posts/2026/11/8624d6c0-b2b0-4a3f-8f9d-6c4a9740900d.bin	image/png	1960997	0
5c260b1b-0f07-4d62-87ab-9ab850998be2	d8c53ad5-a075-4532-ad71-8867b581ce9d	social-data/posts/2026/11/45df1645-0b07-4502-91a3-540e57d0624c.bin	image/png	1960997	0
f9e83914-0133-42a3-b2bb-b9f919906f97	cf0e0630-98f3-448f-b95e-908a9f3cb484	social-data/posts/2026/11/225c7fb8-070d-413e-b24f-ba1f5f4a1184.bin	image/png	1960997	0
f4671d8f-a4ae-4037-8ec5-7437fd7f1d8b	462c008e-1e79-4490-a4bb-ad5267c340f5	social-data/posts/2026/11/25d2e898-1dd3-4229-bf66-334dcfb195ad.png	image/png	1960997	0
\.

COPY social.post_mentions (post_id, user_id, created_at) FROM stdin;
\.

COPY social.post_reactions (post_id, user_id, reaction_type, created_at) FROM stdin;
cf0e0630-98f3-448f-b95e-908a9f3cb484	11111111-1111-1111-1111-111111111111	like	2026-11-11 22:10:06.954049+07
462c008e-1e79-4490-a4bb-ad5267c340f5	11111111-1111-1111-1111-111111111111	angry	2026-11-13 12:10:17.706184+07
\.

COPY social.post_shares (id, post_id, user_id, created_at) FROM stdin;
\.

COPY social.posts (id, author_user_id, text_content, visibility, status, created_at, updated_at, published_at, edited_at, deleted_at, group_id, page_id, is_reel) FROM stdin;
676e95af-a83d-4c80-900f-86f5311a12ce	11111111-1111-1111-1111-111111111111	diagnostic post 134014	0	3	2026-11-11 20:40:16.605978+07	2026-11-11 20:40:16.605978+07	2026-11-11 20:40:16.605978+07	\N	2026-11-11 20:57:20.478675+07	\N	\N	f
2fd6b91e-0c7d-4759-94f7-398349cc3d54	11111111-1111-1111-1111-111111111111	diagnostic post 133751	0	3	2026-11-11 20:37:51.656391+07	2026-11-11 20:37:51.656391+07	2026-11-11 20:37:51.656391+07	\N	2026-11-11 20:57:24.812464+07	\N	\N	f
5ee94676-4f3d-40da-aac4-9af0ef695b5c	11111111-1111-1111-1111-111111111111	diagnostic post 132336	0	3	2026-11-11 20:23:38.797707+07	2026-11-11 20:23:38.797707+07	2026-11-11 20:23:38.797707+07	\N	2026-11-11 20:57:27.135743+07	\N	\N	f
93fae49b-620f-4e90-9403-3fe95ecc514a	11111111-1111-1111-1111-111111111111	kkk	0	3	2026-11-08 12:23:02.977142+07	2026-11-08 12:23:02.977142+07	2026-11-08 12:23:02.977142+07	\N	2026-11-11 20:57:39.915748+07	\N	\N	f
74c946de-141b-4bb3-953c-34d35dbd419c	11111111-1111-1111-1111-111111111111	sadasd	0	3	2026-11-11 22:03:01.09597+07	2026-11-11 22:03:01.09597+07	2026-11-11 22:03:01.09597+07	\N	2026-11-11 22:03:27.240231+07	\N	\N	f
d8c53ad5-a075-4532-ad71-8867b581ce9d	11111111-1111-1111-1111-111111111111	Bkav là gì?\nBức hình này đẹp quá!!!	0	3	2026-11-11 22:03:43.861531+07	2026-11-11 22:03:43.861531+07	2026-11-11 22:03:43.861531+07	\N	2026-11-11 22:06:45.213966+07	\N	\N	f
cf0e0630-98f3-448f-b95e-908a9f3cb484	11111111-1111-1111-1111-111111111111	Bức hình này đẹp quá ta !	0	3	2026-11-11 22:10:01.113934+07	2026-11-11 22:10:01.113934+07	2026-11-11 22:10:01.113934+07	\N	2026-11-11 22:13:04.830869+07	\N	\N	f
462c008e-1e79-4490-a4bb-ad5267c340f5	11111111-1111-1111-1111-111111111111	Tấm hình này đẹp nha	0	3	2026-11-11 22:13:21.231751+07	2026-11-12 14:09:11.39103+07	2026-11-11 22:13:21.231751+07	2026-11-12 14:09:11.39103+07	2026-11-13 12:37:36.252382+07	\N	\N	f
1d48832f-9e2d-497f-a706-c5a6e3b72324	11111111-1111-1111-1111-111111111111	Hello từ Connectly! Feed thật đã chạy 🎉	0	3	2026-11-08 12:02:39.926344+07	2026-11-08 12:02:39.926344+07	2026-11-08 12:02:39.926344+07	\N	2026-11-13 22:39:02.61859+07	\N	\N	f
\.

COPY social.profiles (id, user_id, display_name, bio, avatar_object_key, cover_object_key, website, location_text, created_at, updated_at, username, avatar_audience, bio_audience, birthday_audience, city, city_audience, contact_email, cover_audience, date_of_birth, default_post_visibility, email_audience, following_audience, friend_list_audience, friend_request_policy, hometown, hometown_audience, location_audience, phone_audience, phone_number, website_audience, comment_audience, followers_audience, searchable_audience) FROM stdin;
2884e3a2-c294-4eb4-8bf9-fcb4c344ea43	646a813a-c2f0-434a-90f3-0d489b96ca01	Bug Tester	\N	\N	\N	\N	\N	2026-11-12 11:19:52.701049+07	2026-11-12 12:43:30.240674+07	\N	0	0	1	\N	0	\N	0	\N	0	3	0	0	0	\N	0	0	3	\N	0	0	0	0
58ea8d18-7300-44f2-a1af-a93af320d76f	0dba3d85-f6fe-43af-b556-60f5d33f1019	Race Check	\N	\N	\N	\N	\N	2026-11-15 12:45:27.224522+07	2026-11-15 12:45:27.224623+07	race_check	0	0	1	\N	0	\N	0	\N	0	3	0	0	0	\N	0	0	3	\N	0	0	0	0
9aa447bd-6d3c-4af4-b1df-9ead76c93c04	d1188e7b-c1b9-42a3-9a2f-7b236da5761d	Low End Test	\N	\N	\N	\N	\N	2026-11-15 12:46:37.454954+07	2026-11-15 12:46:37.454954+07	low_end_test	0	0	1	\N	0	\N	0	\N	0	3	0	0	0	\N	0	0	3	\N	0	0	0	0
dca655d0-7a46-489d-8886-8f2e5f572c14	11111111-1111-1111-1111-111111111111	Alice Nguyen	Software engineer, coffee lover ☕	\N	\N	\N	\N	2026-11-07 21:31:12.031073+07	2026-11-07 21:31:12.031073+07	alice	0	0	0	\N	0	\N	0	\N	0	0	0	0	0	\N	0	0	0	\N	0	0	0	0
9268245f-6922-4c95-b47a-194d0d1a2653	22222222-2222-2222-2222-222222222222	Bob Tran	Product designer 🎨	\N	\N	\N	\N	2026-11-07 21:31:12.031073+07	2026-11-07 21:31:12.031073+07	bob	0	0	0	\N	0	\N	0	\N	0	0	0	0	0	\N	0	0	0	\N	0	0	0	0
f3ccb457-3d96-4a15-8a3c-f98f9c189b0b	33333333-3333-3333-3333-333333333333	Carol Le	DevOps enthusiast 🚀	\N	\N	\N	\N	2026-11-07 21:31:12.031073+07	2026-11-07 21:31:12.031073+07	carol	0	0	0	\N	0	\N	0	\N	0	0	0	0	0	\N	0	0	0	\N	0	0	0	0
39b7ec57-2986-4b0e-961b-6a0b09194e33	a8ff3d84-dbdf-4a85-87ea-517fb56ef91f	Race Tester	\N	\N	\N	\N	\N	2026-11-15 18:08:21.590609+07	2026-11-15 18:08:21.590718+07	race_tester	0	0	1	\N	0	\N	0	\N	0	3	0	0	0	\N	0	0	3	\N	0	0	0	0
8f844e93-eb99-4122-9ad5-3efdf44088bc	21198a95-6b09-47b6-8ff1-d9ba91125e30	Race Tester	\N	\N	\N	\N	\N	2026-11-15 18:18:27.26379+07	2026-11-15 18:18:27.26379+07	race_tester_2	0	0	1	\N	0	\N	0	\N	0	3	0	0	0	\N	0	0	3	\N	0	0	0	0
103aac02-0ddf-480c-82c9-215ecf4b6fde	2f591a6e-6f4f-4abe-8edc-61affd306a2c	Race Tester	\N	\N	\N	\N	\N	2026-11-15 18:20:58.906968+07	2026-11-15 18:20:58.907021+07	race_tester_3	0	0	1	\N	0	\N	0	\N	0	3	0	0	0	\N	0	0	3	\N	0	0	0	0
\.

COPY social.reel_views (id, post_id, viewer_user_id, watched_ms, viewed_at) FROM stdin;
\.

COPY social.stories (id, author_user_id, media_asset_id, caption, visibility, created_at, expires_at) FROM stdin;
\.

COPY social.story_views (story_id, viewer_user_id, viewed_at) FROM stdin;
\.

COPY social.user_blocks (blocker_id, blocked_user_id, created_at) FROM stdin;
\.

COPY social.user_follows (follower_id, followee_id, created_at) FROM stdin;
11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	2026-11-07 21:31:12.03331+07
11111111-1111-1111-1111-111111111111	22222222-2222-2222-2222-222222222222	2026-11-11 21:48:06.002476+07
\.

COPY social.user_mutes (muter_id, muted_user_id, created_at) FROM stdin;
\.

-- migration history rows
COPY identity."__EFMigrationsHistory" ("MigrationId", "ProductVersion") FROM stdin;
20261107134548_Initial	10.0.0
20261112030858_AddUserPreferences	10.0.0
20261112061010_AddSessionMetadata	10.0.0
\.

COPY social."__EFMigrationsHistory" ("MigrationId", "ProductVersion") FROM stdin;
20261107134609_Initial	10.0.0
20261109022616_AddReactionsSharesHashtags	10.0.0
20261109035209_AddGroupsAndEvents	10.0.0
20261109073354_AddPolls	10.0.0
20261109095549_AddPages	10.0.0
20261109110855_AddStories	10.0.0
20261111042646_AddMentions	10.0.0
20261111052120_AddReels	10.0.0
20261112032925_AddContentEditHistory	10.0.0
20261112041544_AddProfilePrivacySettings	10.0.0
20261112043348_AddMorePrivacySettings	10.0.0
\.

COPY chat."__EFMigrationsHistory" ("MigrationId", "ProductVersion") FROM stdin;
20261107134632_Initial	10.0.0
20261111103513_AddChatMessageActions	10.0.0
20261112041555_AddChatUserSettings	10.0.0
20261114143307_AddMessageHiddenForUsers	10.0.0
\.

COPY notification."__EFMigrationsHistory" ("MigrationId", "ProductVersion") FROM stdin;
20261107134646_Initial	10.0.0
20261113045051_AddNotificationSessionMetadata	10.0.0
\.

\unrestrict 7fQ2mVb9XkLp4RtZ1sYwNcE6JhG3uA8Df5iO0xPqMvBnK2


-- ============================================================================
--  SECTION 7 - sequence values
-- ============================================================================

SELECT pg_catalog.setval('hangfire.aggregatedcounter_id_seq', 15, true);
SELECT pg_catalog.setval('hangfire.counter_id_seq', 17, true);
SELECT pg_catalog.setval('hangfire.hash_id_seq', 9, true);
SELECT pg_catalog.setval('hangfire.job_id_seq', 5, true);
SELECT pg_catalog.setval('hangfire.jobparameter_id_seq', 15, true);
SELECT pg_catalog.setval('hangfire.jobqueue_id_seq', 5, true);
SELECT pg_catalog.setval('hangfire.list_id_seq', 1, false);
SELECT pg_catalog.setval('hangfire.set_id_seq', 6, true);
SELECT pg_catalog.setval('hangfire.state_id_seq', 15, true);


-- ============================================================================
--  SECTION 8 - primary keys, unique and check constraints
-- ============================================================================

ALTER TABLE ONLY chat.chat_user_settings
    ADD CONSTRAINT "PK_chat_user_settings" PRIMARY KEY (user_id);
ALTER TABLE ONLY chat.message_hidden_for_users
    ADD CONSTRAINT "PK_message_hidden_for_users" PRIMARY KEY (message_id, user_id);
ALTER TABLE ONLY chat.blocked_pair_projections
    ADD CONSTRAINT blocked_pair_projections_pkey PRIMARY KEY (blocker_id, blocked_user_id);
ALTER TABLE ONLY chat.conversation_members
    ADD CONSTRAINT conversation_members_pkey PRIMARY KEY (conversation_id, user_id);
ALTER TABLE ONLY chat.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY chat.inbox_messages
    ADD CONSTRAINT inbox_messages_pkey PRIMARY KEY (event_id);
ALTER TABLE ONLY chat.message_attachments
    ADD CONSTRAINT message_attachments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY chat.message_reactions
    ADD CONSTRAINT message_reactions_pkey PRIMARY KEY (message_id, user_id, reaction_type);
ALTER TABLE ONLY chat.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY chat.outbox_messages
    ADD CONSTRAINT outbox_messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY hangfire.aggregatedcounter
    ADD CONSTRAINT aggregatedcounter_key_key UNIQUE (key);
ALTER TABLE ONLY hangfire.aggregatedcounter
    ADD CONSTRAINT aggregatedcounter_pkey PRIMARY KEY (id);
ALTER TABLE ONLY hangfire.counter
    ADD CONSTRAINT counter_pkey PRIMARY KEY (id);
ALTER TABLE ONLY hangfire.hash
    ADD CONSTRAINT hash_key_field_key UNIQUE (key, field);
ALTER TABLE ONLY hangfire.hash
    ADD CONSTRAINT hash_pkey PRIMARY KEY (id);
ALTER TABLE ONLY hangfire.job
    ADD CONSTRAINT job_pkey PRIMARY KEY (id);
ALTER TABLE ONLY hangfire.jobparameter
    ADD CONSTRAINT jobparameter_pkey PRIMARY KEY (id);
ALTER TABLE ONLY hangfire.jobqueue
    ADD CONSTRAINT jobqueue_pkey PRIMARY KEY (id);
ALTER TABLE ONLY hangfire.list
    ADD CONSTRAINT list_pkey PRIMARY KEY (id);
ALTER TABLE ONLY hangfire.lock
    ADD CONSTRAINT lock_resource_key UNIQUE (resource);
ALTER TABLE ONLY hangfire.schema
    ADD CONSTRAINT schema_pkey PRIMARY KEY (version);
ALTER TABLE ONLY hangfire.server
    ADD CONSTRAINT server_pkey PRIMARY KEY (id);
ALTER TABLE ONLY hangfire.set
    ADD CONSTRAINT set_key_value_key UNIQUE (key, value);
ALTER TABLE ONLY hangfire.set
    ADD CONSTRAINT set_pkey PRIMARY KEY (id);
ALTER TABLE ONLY hangfire.state
    ADD CONSTRAINT state_pkey PRIMARY KEY (id);
ALTER TABLE ONLY identity.user_preferences
    ADD CONSTRAINT "PK_user_preferences" PRIMARY KEY (user_id);
ALTER TABLE ONLY identity."__EFMigrationsHistory"
    ADD CONSTRAINT "__EFMigrationsHistory_pkey" PRIMARY KEY ("MigrationId");
ALTER TABLE ONLY identity.inbox_messages
    ADD CONSTRAINT inbox_messages_pkey PRIMARY KEY (event_id);
ALTER TABLE ONLY identity.outbox_messages
    ADD CONSTRAINT outbox_messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY identity.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);
ALTER TABLE ONLY identity.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);
ALTER TABLE ONLY identity.users
    ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE ONLY identity.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY notification.inbox_messages
    ADD CONSTRAINT inbox_messages_pkey PRIMARY KEY (event_id);
ALTER TABLE ONLY notification.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY notification.outbox_messages
    ADD CONSTRAINT outbox_messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social.comment_edits
    ADD CONSTRAINT "PK_comment_edits" PRIMARY KEY (id);
ALTER TABLE ONLY social.post_edits
    ADD CONSTRAINT "PK_post_edits" PRIMARY KEY (id);
ALTER TABLE ONLY social.comment_mentions
    ADD CONSTRAINT comment_mentions_pkey PRIMARY KEY (comment_id, user_id);
ALTER TABLE ONLY social.comment_reactions
    ADD CONSTRAINT comment_reactions_pkey PRIMARY KEY (comment_id, user_id);
ALTER TABLE ONLY social.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social.event_attendees
    ADD CONSTRAINT event_attendees_pkey PRIMARY KEY (event_id, user_id);
ALTER TABLE ONLY social.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social.friendships
    ADD CONSTRAINT friendships_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social.group_members
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (group_id, user_id);
ALTER TABLE ONLY social.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social.highlight_stories
    ADD CONSTRAINT highlight_stories_pkey PRIMARY KEY (highlight_id, story_id);
ALTER TABLE ONLY social.highlights
    ADD CONSTRAINT highlights_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social.inbox_messages
    ADD CONSTRAINT inbox_messages_pkey PRIMARY KEY (event_id);
ALTER TABLE ONLY social.media_assets
    ADD CONSTRAINT media_assets_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social.outbox_messages
    ADD CONSTRAINT outbox_messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social.page_admins
    ADD CONSTRAINT page_admins_pkey PRIMARY KEY (page_id, user_id);
ALTER TABLE ONLY social.pages
    ADD CONSTRAINT pages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social.poll_options
    ADD CONSTRAINT poll_options_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social.poll_votes
    ADD CONSTRAINT poll_votes_pkey PRIMARY KEY (post_id, option_id, user_id);
ALTER TABLE ONLY social.polls
    ADD CONSTRAINT polls_pkey PRIMARY KEY (post_id);
ALTER TABLE ONLY social.post_bookmarks
    ADD CONSTRAINT post_bookmarks_pkey PRIMARY KEY (post_id, user_id);
ALTER TABLE ONLY social.post_hashtags
    ADD CONSTRAINT post_hashtags_pkey PRIMARY KEY (post_id, tag);
ALTER TABLE ONLY social.post_media
    ADD CONSTRAINT post_media_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social.post_mentions
    ADD CONSTRAINT post_mentions_pkey PRIMARY KEY (post_id, user_id);
ALTER TABLE ONLY social.post_reactions
    ADD CONSTRAINT post_reactions_pkey PRIMARY KEY (post_id, user_id);
ALTER TABLE ONLY social.post_shares
    ADD CONSTRAINT post_shares_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
ALTER TABLE ONLY social.reel_views
    ADD CONSTRAINT reel_views_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social.stories
    ADD CONSTRAINT stories_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social.story_views
    ADD CONSTRAINT story_views_pkey PRIMARY KEY (story_id, viewer_user_id);
ALTER TABLE ONLY social.friendships
    ADD CONSTRAINT uq_friendship_pair UNIQUE (user_low_id, user_high_id);
ALTER TABLE ONLY social.user_blocks
    ADD CONSTRAINT user_blocks_pkey PRIMARY KEY (blocker_id, blocked_user_id);
ALTER TABLE ONLY social.user_follows
    ADD CONSTRAINT user_follows_pkey PRIMARY KEY (follower_id, followee_id);
ALTER TABLE ONLY social.user_mutes
    ADD CONSTRAINT user_mutes_pkey PRIMARY KEY (muter_id, muted_user_id);

ALTER TABLE ONLY social."__EFMigrationsHistory"
    ADD CONSTRAINT "__EFMigrationsHistory_pkey" PRIMARY KEY ("MigrationId");
ALTER TABLE ONLY chat."__EFMigrationsHistory"
    ADD CONSTRAINT "__EFMigrationsHistory_pkey" PRIMARY KEY ("MigrationId");
ALTER TABLE ONLY notification."__EFMigrationsHistory"
    ADD CONSTRAINT "__EFMigrationsHistory_pkey" PRIMARY KEY ("MigrationId");


-- ============================================================================
--  SECTION 9 - indexes
-- ============================================================================

CREATE INDEX "IX_message_hidden_for_users_user_id" ON chat.message_hidden_for_users USING btree (user_id);
CREATE INDEX ix_chat_conversation_members_user_id ON chat.conversation_members USING btree (user_id);
CREATE INDEX ix_chat_message_attachments_message ON chat.message_attachments USING btree (message_id);
CREATE INDEX ix_chat_message_reactions_message ON chat.message_reactions USING btree (message_id);
CREATE INDEX ix_chat_message_reactions_user ON chat.message_reactions USING btree (user_id);
CREATE INDEX ix_chat_messages_conversation_sent ON chat.messages USING btree (conversation_id, sent_at);
CREATE INDEX ix_chat_messages_reply_to ON chat.messages USING btree (reply_to_message_id);
CREATE INDEX ix_chat_messages_sender ON chat.messages USING btree (sender_user_id);
CREATE INDEX ix_chat_outbox_messages_processed_occurred ON chat.outbox_messages USING btree (processed_at, occurred_at);
CREATE INDEX ix_hangfire_counter_expireat ON hangfire.counter USING btree (expireat);
CREATE INDEX ix_hangfire_counter_key ON hangfire.counter USING btree (key);
CREATE INDEX ix_hangfire_hash_expireat ON hangfire.hash USING btree (expireat);
CREATE INDEX ix_hangfire_job_expireat ON hangfire.job USING btree (expireat);
CREATE INDEX ix_hangfire_job_statename ON hangfire.job USING btree (statename);
CREATE INDEX ix_hangfire_job_statename_is_not_null ON hangfire.job USING btree (statename) INCLUDE (id) WHERE (statename IS NOT NULL);
CREATE INDEX ix_hangfire_jobparameter_jobidandname ON hangfire.jobparameter USING btree (jobid, name);
CREATE INDEX ix_hangfire_jobqueue_fetchedat_queue_jobid ON hangfire.jobqueue USING btree (fetchedat NULLS FIRST, queue, jobid);
CREATE INDEX ix_hangfire_jobqueue_jobidandqueue ON hangfire.jobqueue USING btree (jobid, queue);
CREATE INDEX ix_hangfire_jobqueue_queueandfetchedat ON hangfire.jobqueue USING btree (queue, fetchedat);
CREATE INDEX ix_hangfire_list_expireat ON hangfire.list USING btree (expireat);
CREATE INDEX ix_hangfire_set_expireat ON hangfire.set USING btree (expireat);
CREATE INDEX ix_hangfire_set_key_score ON hangfire.set USING btree (key, score);
CREATE INDEX ix_hangfire_state_jobid ON hangfire.state USING btree (jobid);
CREATE INDEX "IX_refresh_tokens_user_id_device_id" ON identity.refresh_tokens USING btree (user_id, device_id);
CREATE INDEX ix_identity_outbox_messages_processed_occurred ON identity.outbox_messages USING btree (processed_at, occurred_at);
CREATE INDEX ix_identity_refresh_tokens_token_hash ON identity.refresh_tokens USING btree (token_hash);
CREATE INDEX ix_identity_refresh_tokens_user_id ON identity.refresh_tokens USING btree (user_id);
CREATE INDEX ix_notification_notifications_recipient_created ON notification.notifications USING btree (recipient_user_id, created_at);
CREATE INDEX ix_notification_notifications_recipient_status ON notification.notifications USING btree (recipient_user_id, status);
CREATE INDEX ix_notification_outbox_messages_processed_occurred ON notification.outbox_messages USING btree (processed_at, occurred_at);
CREATE INDEX "IX_comment_edits_comment_id_edited_at" ON social.comment_edits USING btree (comment_id, edited_at);
CREATE INDEX "IX_post_edits_post_id_edited_at" ON social.post_edits USING btree (post_id, edited_at);
CREATE INDEX ix_comment_mentions_user_id ON social.comment_mentions USING btree (user_id);
CREATE INDEX ix_comment_reactions_comment_type ON social.comment_reactions USING btree (comment_id, reaction_type);
CREATE INDEX ix_event_attendees_user_rsvp ON social.event_attendees USING btree (user_id, rsvp);
CREATE INDEX ix_events_group_starts_at ON social.events USING btree (group_id, starts_at);
CREATE INDEX ix_events_host_starts_at ON social.events USING btree (host_user_id, starts_at);
CREATE INDEX ix_events_starts_at ON social.events USING btree (starts_at);
CREATE INDEX ix_group_members_group_status ON social.group_members USING btree (group_id, status);
CREATE INDEX ix_group_members_user_status ON social.group_members USING btree (user_id, status);
CREATE INDEX ix_groups_created_by ON social.groups USING btree (created_by_user_id);
CREATE INDEX ix_groups_visibility_created_at ON social.groups USING btree (visibility, created_at DESC);
CREATE INDEX ix_highlight_stories_story_id ON social.highlight_stories USING btree (story_id);
CREATE INDEX ix_highlights_owner_user_id ON social.highlights USING btree (owner_user_id);
CREATE INDEX ix_page_admins_user_id ON social.page_admins USING btree (user_id);
CREATE INDEX ix_pages_name ON social.pages USING btree (name);
CREATE INDEX ix_pages_owner_user_id ON social.pages USING btree (owner_user_id);
CREATE INDEX ix_poll_options_post_sort_order ON social.poll_options USING btree (post_id, sort_order);
CREATE INDEX ix_poll_votes_post_user ON social.poll_votes USING btree (post_id, user_id);
CREATE INDEX ix_post_bookmarks_user_created_at ON social.post_bookmarks USING btree (user_id, created_at DESC);
CREATE INDEX ix_post_hashtags_tag ON social.post_hashtags USING btree (tag);
CREATE INDEX ix_post_mentions_user_id ON social.post_mentions USING btree (user_id);
CREATE INDEX ix_post_shares_post_created_at ON social.post_shares USING btree (post_id, created_at DESC);
CREATE INDEX ix_post_shares_user_created_at ON social.post_shares USING btree (user_id, created_at DESC);
CREATE INDEX ix_posts_group_published_at ON social.posts USING btree (group_id, published_at DESC);
CREATE INDEX ix_posts_is_reel_published_at ON social.posts USING btree (is_reel, published_at);
CREATE INDEX ix_posts_page_published_at ON social.posts USING btree (page_id, published_at DESC);
CREATE UNIQUE INDEX ix_profiles_username ON social.profiles USING btree (username);
CREATE INDEX ix_reel_views_post_id_viewed_at ON social.reel_views USING btree (post_id, viewed_at);
CREATE INDEX ix_reel_views_viewer_user_id_viewed_at ON social.reel_views USING btree (viewer_user_id, viewed_at);
CREATE INDEX ix_social_comments_parent ON social.comments USING btree (parent_comment_id);
CREATE INDEX ix_social_comments_post_created ON social.comments USING btree (post_id, created_at);
CREATE INDEX ix_social_friendships_high_status ON social.friendships USING btree (user_high_id, status);
CREATE INDEX ix_social_friendships_low_status ON social.friendships USING btree (user_low_id, status);
CREATE INDEX ix_social_media_assets_owner_status ON social.media_assets USING btree (owner_user_id, status);
CREATE INDEX ix_social_outbox_messages_processed_occurred ON social.outbox_messages USING btree (processed_at, occurred_at);
CREATE INDEX ix_social_post_media_post_sort ON social.post_media USING btree (post_id, sort_order);
CREATE INDEX ix_social_post_reactions_post_type ON social.post_reactions USING btree (post_id, reaction_type);
CREATE INDEX ix_social_posts_author_published ON social.posts USING btree (author_user_id, published_at);
CREATE INDEX ix_social_posts_status_published ON social.posts USING btree (status, published_at);
CREATE INDEX ix_social_profiles_user_id ON social.profiles USING btree (user_id);
CREATE INDEX ix_social_user_blocks_blocked ON social.user_blocks USING btree (blocked_user_id);
CREATE INDEX ix_social_user_follows_followee ON social.user_follows USING btree (followee_id, created_at);
CREATE INDEX ix_social_user_follows_follower ON social.user_follows USING btree (follower_id, created_at);
CREATE INDEX ix_stories_author_user_id_created_at ON social.stories USING btree (author_user_id, created_at);
CREATE INDEX ix_stories_expires_at ON social.stories USING btree (expires_at);
CREATE INDEX ix_story_views_viewer_user_id ON social.story_views USING btree (viewer_user_id);

-- declared by SocialDbContext (HasIndex(m => m.Id).IsUnique()) but absent from
-- the original dump; without it a future migration that drops the index fails
CREATE UNIQUE INDEX "IX_media_assets_Id" ON social.media_assets USING btree (id);


-- ============================================================================
--  SECTION 10 - foreign keys
-- ============================================================================

ALTER TABLE ONLY chat.message_hidden_for_users
    ADD CONSTRAINT "FK_message_hidden_for_users_messages_message_id" FOREIGN KEY (message_id) REFERENCES chat.messages(id) ON DELETE CASCADE;
ALTER TABLE ONLY chat.conversation_members
    ADD CONSTRAINT conversation_members_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES chat.conversations(id) ON DELETE CASCADE;
ALTER TABLE ONLY chat.message_attachments
    ADD CONSTRAINT message_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES chat.messages(id) ON DELETE CASCADE;
ALTER TABLE ONLY chat.message_reactions
    ADD CONSTRAINT message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES chat.messages(id) ON DELETE CASCADE;
ALTER TABLE ONLY chat.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES chat.conversations(id) ON DELETE CASCADE;
ALTER TABLE ONLY chat.messages
    ADD CONSTRAINT messages_reply_to_message_id_fkey FOREIGN KEY (reply_to_message_id) REFERENCES chat.messages(id) ON DELETE SET NULL;
ALTER TABLE ONLY hangfire.jobparameter
    ADD CONSTRAINT jobparameter_jobid_fkey FOREIGN KEY (jobid) REFERENCES hangfire.job(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY hangfire.state
    ADD CONSTRAINT state_jobid_fkey FOREIGN KEY (jobid) REFERENCES hangfire.job(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY identity.user_preferences
    ADD CONSTRAINT "FK_user_preferences_users_user_id" FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY identity.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY social.comment_edits
    ADD CONSTRAINT "FK_comment_edits_comments_comment_id" FOREIGN KEY (comment_id) REFERENCES social.comments(id) ON DELETE CASCADE;
ALTER TABLE ONLY social.post_edits
    ADD CONSTRAINT "FK_post_edits_posts_post_id" FOREIGN KEY (post_id) REFERENCES social.posts(id) ON DELETE CASCADE;
ALTER TABLE ONLY social.comment_mentions
    ADD CONSTRAINT comment_mentions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES social.comments(id) ON DELETE CASCADE;
ALTER TABLE ONLY social.comment_reactions
    ADD CONSTRAINT comment_reactions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES social.comments(id) ON DELETE CASCADE;
ALTER TABLE ONLY social.comments
    ADD CONSTRAINT comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES social.comments(id) ON DELETE CASCADE;
ALTER TABLE ONLY social.comments
    ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES social.posts(id) ON DELETE CASCADE;
ALTER TABLE ONLY social.event_attendees
    ADD CONSTRAINT event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES social.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY social.events
    ADD CONSTRAINT events_group_id_fkey FOREIGN KEY (group_id) REFERENCES social.groups(id) ON DELETE CASCADE;
ALTER TABLE ONLY social.group_members
    ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES social.groups(id) ON DELETE CASCADE;
ALTER TABLE ONLY social.page_admins
    ADD CONSTRAINT page_admins_page_id_fkey FOREIGN KEY (page_id) REFERENCES social.pages(id) ON DELETE CASCADE;
ALTER TABLE ONLY social.poll_options
    ADD CONSTRAINT poll_options_post_id_fkey FOREIGN KEY (post_id) REFERENCES social.polls(post_id) ON DELETE CASCADE;
ALTER TABLE ONLY social.poll_votes
    ADD CONSTRAINT poll_votes_option_id_fkey FOREIGN KEY (option_id) REFERENCES social.poll_options(id) ON DELETE CASCADE;
ALTER TABLE ONLY social.poll_votes
    ADD CONSTRAINT poll_votes_post_id_fkey FOREIGN KEY (post_id) REFERENCES social.polls(post_id) ON DELETE CASCADE;
ALTER TABLE ONLY social.polls
    ADD CONSTRAINT polls_post_id_fkey FOREIGN KEY (post_id) REFERENCES social.posts(id) ON DELETE CASCADE;
ALTER TABLE ONLY social.post_bookmarks
    ADD CONSTRAINT post_bookmarks_post_id_fkey FOREIGN KEY (post_id) REFERENCES social.posts(id) ON DELETE CASCADE;
ALTER TABLE ONLY social.post_hashtags
    ADD CONSTRAINT post_hashtags_post_id_fkey FOREIGN KEY (post_id) REFERENCES social.posts(id) ON DELETE CASCADE;
ALTER TABLE ONLY social.post_media
    ADD CONSTRAINT post_media_post_id_fkey FOREIGN KEY (post_id) REFERENCES social.posts(id) ON DELETE CASCADE;
ALTER TABLE ONLY social.post_mentions
    ADD CONSTRAINT post_mentions_post_id_fkey FOREIGN KEY (post_id) REFERENCES social.posts(id) ON DELETE CASCADE;
ALTER TABLE ONLY social.post_reactions
    ADD CONSTRAINT post_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES social.posts(id) ON DELETE CASCADE;
ALTER TABLE ONLY social.post_shares
    ADD CONSTRAINT post_shares_post_id_fkey FOREIGN KEY (post_id) REFERENCES social.posts(id) ON DELETE CASCADE;
ALTER TABLE ONLY social.reel_views
    ADD CONSTRAINT reel_views_post_id_fkey FOREIGN KEY (post_id) REFERENCES social.posts(id) ON DELETE CASCADE;


-- ============================================================================
--  SECTION 11 - privileges
--  Replaces the 73 per-table GRANTs of the original dump with the equivalent
--  per-schema statements, and adds the sequence privileges the dump never
--  granted (Hangfire needs nextval() to insert jobs).
-- ============================================================================

GRANT USAGE ON SCHEMA identity TO :"app_role";
GRANT USAGE ON SCHEMA social TO :"app_role";
GRANT USAGE ON SCHEMA chat TO :"app_role";
GRANT USAGE ON SCHEMA notification TO :"app_role";
GRANT USAGE ON SCHEMA hangfire TO :"app_role";

GRANT SELECT, INSERT, DELETE, UPDATE ON ALL TABLES IN SCHEMA identity TO :"app_role";
GRANT SELECT, INSERT, DELETE, UPDATE ON ALL TABLES IN SCHEMA social TO :"app_role";
GRANT SELECT, INSERT, DELETE, UPDATE ON ALL TABLES IN SCHEMA chat TO :"app_role";
GRANT SELECT, INSERT, DELETE, UPDATE ON ALL TABLES IN SCHEMA notification TO :"app_role";
GRANT SELECT, INSERT, DELETE, UPDATE ON ALL TABLES IN SCHEMA hangfire TO :"app_role";

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA identity TO :"app_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA social TO :"app_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA chat TO :"app_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA notification TO :"app_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA hangfire TO :"app_role";

-- anything created later by this role is readable and writable by the app role
ALTER DEFAULT PRIVILEGES IN SCHEMA identity
    GRANT SELECT, INSERT, DELETE, UPDATE ON TABLES TO :"app_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA social
    GRANT SELECT, INSERT, DELETE, UPDATE ON TABLES TO :"app_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA chat
    GRANT SELECT, INSERT, DELETE, UPDATE ON TABLES TO :"app_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA notification
    GRANT SELECT, INSERT, DELETE, UPDATE ON TABLES TO :"app_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA hangfire
    GRANT SELECT, INSERT, DELETE, UPDATE ON TABLES TO :"app_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA identity
    GRANT USAGE, SELECT ON SEQUENCES TO :"app_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA social
    GRANT USAGE, SELECT ON SEQUENCES TO :"app_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA chat
    GRANT USAGE, SELECT ON SEQUENCES TO :"app_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA notification
    GRANT USAGE, SELECT ON SEQUENCES TO :"app_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA hangfire
    GRANT USAGE, SELECT ON SEQUENCES TO :"app_role";


-- ============================================================================
--  End of provisioning script
-- ============================================================================
