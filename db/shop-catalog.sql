--
-- PostgreSQL database dump
--

\restrict Dwukc0USn3S4vLvdqMR5fMIUviWEaUUuQQqDnSs9X895KmmWKMcvYIj2a4DLZip

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

--
-- Data for Name: shop_items; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.shop_items VALUES ('frame_none', 'frame', 'Без рамки', 0, true, false, '', 10, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('frame_cyan', 'frame', 'Неоновый контур', 50, false, false, 'gc-frame--cyan', 20, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('frame_green', 'frame', 'Матрица', 90, false, false, 'gc-frame--green', 30, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('frame_gold', 'frame', 'Золото', 200, false, false, 'gc-frame--gold', 50, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('frame_dashed', 'frame', 'Бегущая строка', 300, false, false, 'gc-frame--dashed', 60, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('frame_rgb', 'frame', 'RGB', 700, false, false, 'gc-frame--rgb', 80, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('title_none', 'title', 'Без титула', 0, true, false, '', 10, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('title_net', 'title', 'Сетевой инженер', 100, false, false, 'СЕТЕВОЙ ИНЖЕНЕР', 40, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('skin_default', 'skin', 'Базовый', 0, true, false, '', 10, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('frame_glitch', 'frame', 'Глитч', 550, false, false, 'gc-frame--glitch', 70, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('skin_crimson', 'skin', 'Красный', 250, false, false, 'crimson', 30, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('avatar4-gold', 'avatar', 'Золотой', 200, false, true, 'avatar4-gold', 90, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('avatar2-ice', 'avatar', 'Лёд', 120, false, true, 'avatar2-ice', 70, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('custom-lyagushonok', 'avatar', 'Лягушонок', 120, false, false, 'custom-lyagushonok', 120, '2026-09-10 19:52:48.582689+03');
INSERT INTO public.shop_items VALUES ('avatar1', 'avatar', 'Грибок', 0, true, false, 'avatar1', 10, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('avatar2', 'avatar', 'Догги', 0, true, false, 'avatar2', 20, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('avatar3', 'avatar', 'Звёздочка', 0, true, false, 'avatar3', 30, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('avatar4', 'avatar', 'Диск', 0, true, false, 'avatar4', 40, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('skin_green', 'skin', 'Зелёный', 250, false, false, 'green', 20, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('custom-utenok', 'avatar', 'Утёнок', 120, false, false, 'custom-utenok', 130, '2026-09-10 19:55:29.788255+03');
INSERT INTO public.shop_items VALUES ('avatar5', 'avatar', 'Муся', 0, true, false, 'avatar5', 50, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('skin_void', 'skin', 'Чёрный', 250, false, false, 'void', 50, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('custom-picca', 'avatar', 'Пицца', 120, false, false, 'custom-picca', 140, '2026-09-10 20:12:38.999038+03');
INSERT INTO public.shop_items VALUES ('custom-klubnichka', 'avatar', 'Клубничка', 300, false, false, 'custom-klubnichka', 180, '2026-09-10 20:10:44.164497+03');
INSERT INTO public.shop_items VALUES ('custom-rybka', 'avatar', 'Рыбка', 200, false, false, 'custom-rybka-2', 170, '2026-09-10 20:06:19.251143+03');
INSERT INTO public.shop_items VALUES ('custom-bimo', 'avatar', 'Бимо', 120, false, false, 'custom-bimo', 150, '2026-09-10 20:13:50.212009+03');
INSERT INTO public.shop_items VALUES ('custom-kotenok', 'avatar', 'Котенок', 200, false, false, 'custom-kotenok', 160, '2026-09-10 19:59:37.337945+03');
INSERT INTO public.shop_items VALUES ('title_novice', 'title', 'Ученик', 40, false, false, 'УЧЕНИК', 20, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('title_debug', 'title', 'Тестировщик', 70, false, false, 'ТЕСТИРОВЩИК', 30, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('title_sorter', 'title', 'Мастер сортировки', 125, false, false, 'МАСТЕР СОРТИРОВКИ', 50, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('title_legend', 'title', 'Легенда GameCode', 1000, false, false, 'ЛЕГЕНДА GAMECODE', 90, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('title_hacker', 'title', 'Хакер', 500, false, false, 'ХАКЕР', 70, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('title_quiz', 'title', 'Сеньор', 300, false, false, 'СЕНЬОР', 60, '2026-09-10 19:46:57.428448+03');
INSERT INTO public.shop_items VALUES ('frame_pink', 'frame', 'Красный шум', 140, false, false, 'gc-frame--pink', 40, '2026-09-10 19:46:57.428448+03');


--
-- PostgreSQL database dump complete
--

\unrestrict Dwukc0USn3S4vLvdqMR5fMIUviWEaUUuQQqDnSs9X895KmmWKMcvYIj2a4DLZip

