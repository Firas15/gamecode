-- ============================================================
--  GameCode: структура базы данных (без данных).
--  Для локальной разработки: docker compose поднимет базу и
--  выполнит этот файл при первом старте пустого тома.
--  Боевые данные сюда не входят — в них хеши паролей игроков.
-- ============================================================

--
-- PostgreSQL database dump
--

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_log; Type: TABLE; Schema: public; Owner: gamecode_user
--

CREATE TABLE public.admin_log (
    id bigint NOT NULL,
    acted_at timestamp with time zone NOT NULL,
    action character varying(60) NOT NULL,
    detail text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.admin_log OWNER TO gamecode_user;

--
-- Name: admin_log_id_seq; Type: SEQUENCE; Schema: public; Owner: gamecode_user
--

CREATE SEQUENCE public.admin_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.admin_log_id_seq OWNER TO gamecode_user;

--
-- Name: admin_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gamecode_user
--

ALTER SEQUENCE public.admin_log_id_seq OWNED BY public.admin_log.id;

--
-- Name: chat_faq; Type: TABLE; Schema: public; Owner: gamecode_user
--

CREATE TABLE public.chat_faq (
    id integer NOT NULL,
    question character varying(255) NOT NULL,
    answer text NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.chat_faq OWNER TO gamecode_user;

--
-- Name: chat_faq_id_seq; Type: SEQUENCE; Schema: public; Owner: gamecode_user
--

CREATE SEQUENCE public.chat_faq_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.chat_faq_id_seq OWNER TO gamecode_user;

--
-- Name: chat_faq_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gamecode_user
--

ALTER SEQUENCE public.chat_faq_id_seq OWNED BY public.chat_faq.id;

--
-- Name: chat_faq_keywords; Type: TABLE; Schema: public; Owner: gamecode_user
--

CREATE TABLE public.chat_faq_keywords (
    id integer NOT NULL,
    faq_id integer NOT NULL,
    keyword character varying(100) NOT NULL
);

ALTER TABLE public.chat_faq_keywords OWNER TO gamecode_user;

--
-- Name: chat_faq_keywords_id_seq; Type: SEQUENCE; Schema: public; Owner: gamecode_user
--

CREATE SEQUENCE public.chat_faq_keywords_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.chat_faq_keywords_id_seq OWNER TO gamecode_user;

--
-- Name: chat_faq_keywords_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gamecode_user
--

ALTER SEQUENCE public.chat_faq_keywords_id_seq OWNED BY public.chat_faq_keywords.id;

--
-- Name: games; Type: TABLE; Schema: public; Owner: gamecode_user
--

CREATE TABLE public.games (
    id character varying(30) NOT NULL,
    title character varying(100) NOT NULL,
    emoji character varying(10) DEFAULT ''::character varying NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    level character varying(20) DEFAULT 'beginner'::character varying NOT NULL,
    stars smallint DEFAULT 1 NOT NULL,
    wip boolean DEFAULT false NOT NULL,
    link character varying(255) DEFAULT ''::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT games_stars_check CHECK (((stars >= 1) AND (stars <= 5)))
);

ALTER TABLE public.games OWNER TO gamecode_user;

--
-- Name: news; Type: TABLE; Schema: public; Owner: gamecode_user
--

CREATE TABLE public.news (
    id character varying(60) NOT NULL,
    title character varying(255) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    image character varying(255) DEFAULT ''::character varying NOT NULL,
    layout character varying(10) DEFAULT 'left'::character varying NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT news_layout_check CHECK (((layout)::text = ANY ((ARRAY['left'::character varying, 'right'::character varying])::text[])))
);

ALTER TABLE public.news OWNER TO gamecode_user;

--
-- Name: pixelgame_levels; Type: TABLE; Schema: public; Owner: gamecode_user
--

CREATE TABLE public.pixelgame_levels (
    id integer NOT NULL,
    level_number integer NOT NULL,
    title text NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.pixelgame_levels OWNER TO gamecode_user;

--
-- Name: pixelgame_levels_id_seq; Type: SEQUENCE; Schema: public; Owner: gamecode_user
--

CREATE SEQUENCE public.pixelgame_levels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.pixelgame_levels_id_seq OWNER TO gamecode_user;

--
-- Name: pixelgame_levels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gamecode_user
--

ALTER SEQUENCE public.pixelgame_levels_id_seq OWNED BY public.pixelgame_levels.id;

--
-- Name: pixelgame_monster_questions; Type: TABLE; Schema: public; Owner: gamecode_user
--

CREATE TABLE public.pixelgame_monster_questions (
    id integer NOT NULL,
    topic text DEFAULT 'go'::text NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.pixelgame_monster_questions OWNER TO gamecode_user;

--
-- Name: pixelgame_monster_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: gamecode_user
--

CREATE SEQUENCE public.pixelgame_monster_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.pixelgame_monster_questions_id_seq OWNER TO gamecode_user;

--
-- Name: pixelgame_monster_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gamecode_user
--

ALTER SEQUENCE public.pixelgame_monster_questions_id_seq OWNED BY public.pixelgame_monster_questions.id;

--
-- Name: question_answers; Type: TABLE; Schema: public; Owner: gamecode_user
--

CREATE TABLE public.question_answers (
    id integer NOT NULL,
    question_id integer NOT NULL,
    answer_text text NOT NULL,
    is_correct boolean DEFAULT false NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL
);

ALTER TABLE public.question_answers OWNER TO gamecode_user;

--
-- Name: question_answers_id_seq; Type: SEQUENCE; Schema: public; Owner: gamecode_user
--

CREATE SEQUENCE public.question_answers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.question_answers_id_seq OWNER TO gamecode_user;

--
-- Name: question_answers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gamecode_user
--

ALTER SEQUENCE public.question_answers_id_seq OWNED BY public.question_answers.id;

--
-- Name: questions; Type: TABLE; Schema: public; Owner: gamecode_user
--

CREATE TABLE public.questions (
    id integer NOT NULL,
    game_id character varying(30) NOT NULL,
    question text NOT NULL,
    difficulty character varying(10) DEFAULT 'easy'::character varying NOT NULL,
    lang character varying(20) DEFAULT ''::character varying NOT NULL,
    explanation text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.questions OWNER TO gamecode_user;

--
-- Name: questions_id_seq; Type: SEQUENCE; Schema: public; Owner: gamecode_user
--

CREATE SEQUENCE public.questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.questions_id_seq OWNER TO gamecode_user;

--
-- Name: questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gamecode_user
--

ALTER SEQUENCE public.questions_id_seq OWNED BY public.questions.id;

--
-- Name: scores; Type: TABLE; Schema: public; Owner: gamecode_user
--

CREATE TABLE public.scores (
    id bigint NOT NULL,
    user_id integer,
    game_id character varying(30) NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.scores OWNER TO gamecode_user;

--
-- Name: scores_id_seq; Type: SEQUENCE; Schema: public; Owner: gamecode_user
--

CREATE SEQUENCE public.scores_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.scores_id_seq OWNER TO gamecode_user;

--
-- Name: scores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gamecode_user
--

ALTER SEQUENCE public.scores_id_seq OWNED BY public.scores.id;

--
-- Name: users; Type: TABLE; Schema: public; Owner: gamecode_user
--

CREATE TABLE public.users (
    id integer NOT NULL,
    nickname character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    bio text DEFAULT ''::text NOT NULL,
    favorite_lang character varying(50) DEFAULT ''::character varying NOT NULL,
    favorite_game character varying(100) DEFAULT ''::character varying NOT NULL,
    games_played integer DEFAULT 0 NOT NULL,
    best_score integer DEFAULT 0 NOT NULL,
    avatar_emoji character varying(20) DEFAULT 'avatar1'::character varying NOT NULL,
    secret_question text DEFAULT ''::text NOT NULL,
    secret_answer_hash character varying(255) DEFAULT ''::character varying NOT NULL,
    banned boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.users OWNER TO gamecode_user;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: gamecode_user
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.users_id_seq OWNER TO gamecode_user;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gamecode_user
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

--
-- Name: admin_log id; Type: DEFAULT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.admin_log ALTER COLUMN id SET DEFAULT nextval('public.admin_log_id_seq'::regclass);

--
-- Name: chat_faq id; Type: DEFAULT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.chat_faq ALTER COLUMN id SET DEFAULT nextval('public.chat_faq_id_seq'::regclass);

--
-- Name: chat_faq_keywords id; Type: DEFAULT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.chat_faq_keywords ALTER COLUMN id SET DEFAULT nextval('public.chat_faq_keywords_id_seq'::regclass);

--
-- Name: pixelgame_levels id; Type: DEFAULT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.pixelgame_levels ALTER COLUMN id SET DEFAULT nextval('public.pixelgame_levels_id_seq'::regclass);

--
-- Name: pixelgame_monster_questions id; Type: DEFAULT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.pixelgame_monster_questions ALTER COLUMN id SET DEFAULT nextval('public.pixelgame_monster_questions_id_seq'::regclass);

--
-- Name: question_answers id; Type: DEFAULT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.question_answers ALTER COLUMN id SET DEFAULT nextval('public.question_answers_id_seq'::regclass);

--
-- Name: questions id; Type: DEFAULT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.questions ALTER COLUMN id SET DEFAULT nextval('public.questions_id_seq'::regclass);

--
-- Name: scores id; Type: DEFAULT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.scores ALTER COLUMN id SET DEFAULT nextval('public.scores_id_seq'::regclass);

--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

--
-- Data for Name: admin_log; Type: TABLE DATA; Schema: public; Owner: gamecode_user
--

--
-- Data for Name: chat_faq; Type: TABLE DATA; Schema: public; Owner: gamecode_user
--

--
-- Data for Name: chat_faq_keywords; Type: TABLE DATA; Schema: public; Owner: gamecode_user
--

--
-- Data for Name: games; Type: TABLE DATA; Schema: public; Owner: gamecode_user
--

--
-- Data for Name: news; Type: TABLE DATA; Schema: public; Owner: gamecode_user
--

--
-- Data for Name: pixelgame_levels; Type: TABLE DATA; Schema: public; Owner: gamecode_user
--

--
-- Data for Name: pixelgame_monster_questions; Type: TABLE DATA; Schema: public; Owner: gamecode_user
--

--
-- Data for Name: question_answers; Type: TABLE DATA; Schema: public; Owner: gamecode_user
--

--
-- Data for Name: questions; Type: TABLE DATA; Schema: public; Owner: gamecode_user
--

--
-- Data for Name: scores; Type: TABLE DATA; Schema: public; Owner: gamecode_user
--

--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: gamecode_user
--

--
-- Name: admin_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gamecode_user
--

--
-- Name: chat_faq_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gamecode_user
--

--
-- Name: chat_faq_keywords_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gamecode_user
--

--
-- Name: pixelgame_levels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gamecode_user
--

--
-- Name: pixelgame_monster_questions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gamecode_user
--

--
-- Name: question_answers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gamecode_user
--

--
-- Name: questions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gamecode_user
--

--
-- Name: scores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gamecode_user
--

--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gamecode_user
--

--
-- Name: admin_log admin_log_pkey; Type: CONSTRAINT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.admin_log
    ADD CONSTRAINT admin_log_pkey PRIMARY KEY (id);

--
-- Name: chat_faq_keywords chat_faq_keywords_pkey; Type: CONSTRAINT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.chat_faq_keywords
    ADD CONSTRAINT chat_faq_keywords_pkey PRIMARY KEY (id);

--
-- Name: chat_faq chat_faq_pkey; Type: CONSTRAINT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.chat_faq
    ADD CONSTRAINT chat_faq_pkey PRIMARY KEY (id);

--
-- Name: games games_pkey; Type: CONSTRAINT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_pkey PRIMARY KEY (id);

--
-- Name: news news_pkey; Type: CONSTRAINT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_pkey PRIMARY KEY (id);

--
-- Name: pixelgame_levels pixelgame_levels_level_number_key; Type: CONSTRAINT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.pixelgame_levels
    ADD CONSTRAINT pixelgame_levels_level_number_key UNIQUE (level_number);

--
-- Name: pixelgame_levels pixelgame_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.pixelgame_levels
    ADD CONSTRAINT pixelgame_levels_pkey PRIMARY KEY (id);

--
-- Name: pixelgame_monster_questions pixelgame_monster_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.pixelgame_monster_questions
    ADD CONSTRAINT pixelgame_monster_questions_pkey PRIMARY KEY (id);

--
-- Name: question_answers question_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.question_answers
    ADD CONSTRAINT question_answers_pkey PRIMARY KEY (id);

--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);

--
-- Name: scores scores_pkey; Type: CONSTRAINT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.scores
    ADD CONSTRAINT scores_pkey PRIMARY KEY (id);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- Name: idx_admin_log_acted_at; Type: INDEX; Schema: public; Owner: gamecode_user
--

CREATE INDEX idx_admin_log_acted_at ON public.admin_log USING btree (acted_at DESC);

--
-- Name: idx_answers_question_id; Type: INDEX; Schema: public; Owner: gamecode_user
--

CREATE INDEX idx_answers_question_id ON public.question_answers USING btree (question_id);

--
-- Name: idx_faq_keywords_faq_id; Type: INDEX; Schema: public; Owner: gamecode_user
--

CREATE INDEX idx_faq_keywords_faq_id ON public.chat_faq_keywords USING btree (faq_id);

--
-- Name: idx_faq_keywords_keyword; Type: INDEX; Schema: public; Owner: gamecode_user
--

CREATE INDEX idx_faq_keywords_keyword ON public.chat_faq_keywords USING btree (keyword);

--
-- Name: idx_questions_game_id; Type: INDEX; Schema: public; Owner: gamecode_user
--

CREATE INDEX idx_questions_game_id ON public.questions USING btree (game_id);

--
-- Name: idx_scores_game_id; Type: INDEX; Schema: public; Owner: gamecode_user
--

CREATE INDEX idx_scores_game_id ON public.scores USING btree (game_id);

--
-- Name: idx_scores_leaderboard; Type: INDEX; Schema: public; Owner: gamecode_user
--

CREATE INDEX idx_scores_leaderboard ON public.scores USING btree (user_id, score DESC);

--
-- Name: idx_scores_user_game; Type: INDEX; Schema: public; Owner: gamecode_user
--

CREATE INDEX idx_scores_user_game ON public.scores USING btree (user_id, game_id);

--
-- Name: idx_scores_user_id; Type: INDEX; Schema: public; Owner: gamecode_user
--

CREATE INDEX idx_scores_user_id ON public.scores USING btree (user_id);

--
-- Name: idx_users_best_score; Type: INDEX; Schema: public; Owner: gamecode_user
--

CREATE INDEX idx_users_best_score ON public.users USING btree (best_score DESC);

--
-- Name: idx_users_nickname_lower; Type: INDEX; Schema: public; Owner: gamecode_user
--

CREATE UNIQUE INDEX idx_users_nickname_lower ON public.users USING btree (lower((nickname)::text));

--
-- Name: chat_faq_keywords chat_faq_keywords_faq_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.chat_faq_keywords
    ADD CONSTRAINT chat_faq_keywords_faq_id_fkey FOREIGN KEY (faq_id) REFERENCES public.chat_faq(id) ON DELETE CASCADE;

--
-- Name: question_answers question_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.question_answers
    ADD CONSTRAINT question_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;

--
-- Name: questions questions_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id);

--
-- Name: scores scores_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.scores
    ADD CONSTRAINT scores_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE RESTRICT;

--
-- Name: scores scores_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gamecode_user
--

ALTER TABLE ONLY public.scores
    ADD CONSTRAINT scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO gamecode_user;

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

--
-- PostgreSQL database dump complete
--

