<?php
/**
 * ============================================================
 *  АДМИНКА: «ГЛЮК-АТАКА» — вопросы и темы
 *
 *  Вопросы лежат в glitch_questions, темы — в glitch_themes
 *  (миграция db/migrations/004-glitch.sql). Игра берёт их
 *  отсюда же на каждой партии, кэша нет — правка видна сразу.
 *
 *  Что можно:
 *    — добавлять, править, скрывать и удалять вопросы;
 *    — править название, цвет и порядок тем, скрывать темы,
 *      добавлять новые.
 *  Тему с вопросами удалить нельзя — только скрыть (или сначала
 *  перенести/удалить её вопросы).
 *
 *  Цвет темы = цвет рамки темы в игре = цвет призрака.
 * ============================================================
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/csrf.php';
require_once dirname(__DIR__) . '/includes/glitch.php';
requireAdmin();

$tableReady = glitch_tables_ready();
$msg = '';
$msgType = 'success';

/** Короткая строка для лога и сообщений. */
function glitch_adm_short(string $s, int $n = 50): string {
    $s = trim(preg_replace('/\s+/u', ' ', $s) ?? $s);
    return mb_strlen($s, 'UTF-8') > $n ? mb_substr($s, 0, $n - 1, 'UTF-8') . '…' : $s;
}

/** Проверка и сборка полей вопроса из формы. Возвращает [данные, ошибка]. */
function glitch_adm_question_from_post(array $themes): array {
    $theme = trim((string)($_POST['theme_id'] ?? ''));
    $question = trim((string)($_POST['question'] ?? ''));
    $answers = [];
    for ($i = 1; $i <= 4; $i++) $answers[] = trim((string)($_POST['answer' . $i] ?? ''));
    $correct = (int)($_POST['correct'] ?? -1);
    $explain = trim((string)($_POST['explanation'] ?? ''));

    if (!isset($themes[$theme])) return [null, 'Выберите тему'];
    if ($question === '') return [null, 'Нужен текст вопроса'];
    if (mb_strlen($question, 'UTF-8') > GLITCH_Q_MAX) return [null, 'Вопрос длиннее ' . GLITCH_Q_MAX . ' символов'];
    foreach ($answers as $i => $a) {
        if ($a === '') return [null, 'Заполните все 4 варианта ответа'];
        if (mb_strlen($a, 'UTF-8') > GLITCH_A_MAX) return [null, 'Вариант ' . ($i + 1) . ' длиннее ' . GLITCH_A_MAX . ' символов'];
    }
    $lower = array_map(static fn($a) => mb_strtolower($a, 'UTF-8'), $answers);
    if (count(array_unique($lower)) !== 4) return [null, 'Варианты ответа не должны повторяться'];
    if ($correct < 0 || $correct > 3) return [null, 'Отметьте правильный вариант'];
    if (mb_strlen($explain, 'UTF-8') > GLITCH_EXP_MAX) return [null, 'Пояснение длиннее ' . GLITCH_EXP_MAX . ' символов'];

    return [[
        'theme_id' => $theme, 'question' => $question,
        'answer1' => $answers[0], 'answer2' => $answers[1], 'answer3' => $answers[2], 'answer4' => $answers[3],
        'correct' => $correct, 'explanation' => $explain,
    ], null];
}

function glitch_adm_slug(string $text): string {
    $map = ['а'=>'a','б'=>'b','в'=>'v','г'=>'g','д'=>'d','е'=>'e','ё'=>'e','ж'=>'zh','з'=>'z','и'=>'i','й'=>'y',
            'к'=>'k','л'=>'l','м'=>'m','н'=>'n','о'=>'o','п'=>'p','р'=>'r','с'=>'s','т'=>'t','у'=>'u','ф'=>'f',
            'х'=>'h','ц'=>'c','ч'=>'ch','ш'=>'sh','щ'=>'sch','ъ'=>'','ы'=>'y','ь'=>'','э'=>'e','ю'=>'yu','я'=>'ya'];
    $text = strtr(mb_strtolower(trim($text), 'UTF-8'), $map);
    $text = trim(preg_replace('/[^a-z0-9]+/', '-', $text) ?? '', '-');
    return substr($text !== '' ? $text : 'theme', 0, 16);
}

$themesAll = $tableReady ? glitch_themes(false) : [];
$themeMap = [];
foreach ($themesAll as $t) $themeMap[$t['id']] = $t;

// ------------------------------------------------------------
// Действия
// ------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    admin_csrf_check();
    $action = (string)($_POST['action'] ?? '');
    $qid = (int)($_POST['id'] ?? 0);
    $back = 'glitch.php' . (isset($_POST['filter']) && $_POST['filter'] !== '' ? '?theme=' . rawurlencode((string)$_POST['filter']) : '');

    if (!$tableReady) {
        $msg = 'Таблиц игры ещё нет — прогоните db/migrations/004-glitch.sql';
        $msgType = 'error';

    } elseif ($action === 'q_create' || $action === 'q_save') {
        [$data, $err] = glitch_adm_question_from_post($themeMap);
        if ($err) {
            $msg = $err; $msgType = 'error';
        } elseif ($action === 'q_create') {
            $ok = gamecode_pg_exec(
                'INSERT INTO glitch_questions (theme_id, question, answer1, answer2, answer3, answer4, correct, explanation)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                array_values($data)
            );
            if ($ok) { writeLog('Глюк-атака: добавлен вопрос', glitch_adm_short($data['question'])); $msg = 'Вопрос добавлен'; }
            else { $msg = 'Не удалось сохранить вопрос'; $msgType = 'error'; }
        } else {
            $res = gamecode_pg_exec(
                'UPDATE glitch_questions SET theme_id = $1, question = $2, answer1 = $3, answer2 = $4, answer3 = $5,
                        answer4 = $6, correct = $7, explanation = $8, updated_at = now()
                 WHERE id = $9',
                array_merge(array_values($data), [$qid])
            );
            if ($res && pg_affected_rows($res) === 1) {
                writeLog('Глюк-атака: изменён вопрос #' . $qid, glitch_adm_short($data['question']));
                $msg = 'Вопрос #' . $qid . ' сохранён';
                $back = 'glitch.php?theme=' . rawurlencode($data['theme_id']);
            } else { $msg = 'Вопрос не найден'; $msgType = 'error'; }
        }

    } elseif ($action === 'q_toggle') {
        $hide = ($_POST['hide'] ?? '') === '1';
        $res = gamecode_pg_exec('UPDATE glitch_questions SET hidden = $1, updated_at = now() WHERE id = $2', [$hide ? 't' : 'f', $qid]);
        if ($res && pg_affected_rows($res) === 1) {
            writeLog($hide ? 'Глюк-атака: вопрос скрыт' : 'Глюк-атака: вопрос возвращён', '#' . $qid);
            $msg = $hide ? 'Вопрос скрыт — в игру он больше не попадёт' : 'Вопрос снова в игре';
        } else { $msg = 'Вопрос не найден'; $msgType = 'error'; }

    } elseif ($action === 'q_delete') {
        $q = glitch_question($qid);
        $res = gamecode_pg_exec('DELETE FROM glitch_questions WHERE id = $1', [$qid]);
        if ($q && $res && pg_affected_rows($res) === 1) {
            writeLog('Глюк-атака: удалён вопрос #' . $qid, glitch_adm_short((string)$q['question']));
            $msg = 'Вопрос #' . $qid . ' удалён';
        } else { $msg = 'Вопрос не найден'; $msgType = 'error'; }

    } elseif ($action === 't_save') {
        $tid = (string)($_POST['theme_id'] ?? '');
        $name = mb_strtoupper(trim((string)($_POST['name'] ?? '')), 'UTF-8');
        $color = strtolower(trim((string)($_POST['color'] ?? '')));
        $sort = max(0, min(10000, (int)($_POST['sort_order'] ?? 0)));
        if (!isset($themeMap[$tid])) { $msg = 'Тема не найдена'; $msgType = 'error'; }
        elseif ($name === '' || mb_strlen($name, 'UTF-8') > 40) { $msg = 'Название темы: от 1 до 40 символов'; $msgType = 'error'; }
        elseif (!preg_match('/^#[0-9a-f]{6}$/', $color)) { $msg = 'Цвет — в формате #rrggbb'; $msgType = 'error'; }
        else {
            gamecode_pg_exec('UPDATE glitch_themes SET name = $1, color = $2, sort_order = $3 WHERE id = $4', [$name, $color, $sort, $tid]);
            writeLog('Глюк-атака: изменена тема', $tid . ' → ' . $name);
            $msg = 'Тема «' . $name . '» сохранена';
        }

    } elseif ($action === 't_toggle') {
        $tid = (string)($_POST['theme_id'] ?? '');
        $hide = ($_POST['hide'] ?? '') === '1';
        if (!isset($themeMap[$tid])) { $msg = 'Тема не найдена'; $msgType = 'error'; }
        else {
            gamecode_pg_exec('UPDATE glitch_themes SET hidden = $1 WHERE id = $2', [$hide ? 't' : 'f', $tid]);
            writeLog($hide ? 'Глюк-атака: тема скрыта' : 'Глюк-атака: тема возвращена', $tid);
            $msg = $hide ? 'Тема скрыта — в меню игры её не будет' : 'Тема снова в игре';
        }

    } elseif ($action === 't_create') {
        $name = mb_strtoupper(trim((string)($_POST['name'] ?? '')), 'UTF-8');
        $color = strtolower(trim((string)($_POST['color'] ?? '#00e5ff')));
        if ($name === '' || mb_strlen($name, 'UTF-8') > 40) { $msg = 'Название темы: от 1 до 40 символов'; $msgType = 'error'; }
        elseif (!preg_match('/^#[0-9a-f]{6}$/', $color)) { $msg = 'Цвет — в формате #rrggbb'; $msgType = 'error'; }
        else {
            $base = glitch_adm_slug($name);
            $tid = $base;
            for ($n = 2; isset($themeMap[$tid]) && $n < 100; $n++) $tid = substr($base, 0, 13) . '-' . $n;
            $maxSort = 0;
            foreach ($themesAll as $t) $maxSort = max($maxSort, $t['sort']);
            $ok = gamecode_pg_exec('INSERT INTO glitch_themes (id, name, color, sort_order) VALUES ($1, $2, $3, $4)', [$tid, $name, $color, $maxSort + 10]);
            if ($ok) { writeLog('Глюк-атака: добавлена тема', $tid . ' — ' . $name); $msg = 'Тема «' . $name . '» добавлена. Пока в ней нет вопросов, в меню игры её не видно.'; }
            else { $msg = 'Не удалось добавить тему'; $msgType = 'error'; }
        }

    } elseif ($action === 't_delete') {
        $tid = (string)($_POST['theme_id'] ?? '');
        if (!isset($themeMap[$tid])) { $msg = 'Тема не найдена'; $msgType = 'error'; }
        elseif ($themeMap[$tid]['total'] > 0) { $msg = 'В теме есть вопросы — её можно только скрыть'; $msgType = 'error'; }
        else {
            gamecode_pg_exec('DELETE FROM glitch_themes WHERE id = $1', [$tid]);
            writeLog('Глюк-атака: удалена тема', $tid);
            $msg = 'Тема удалена';
        }
    }

    // PRG: после успешного действия — свежая страница без повторной отправки формы
    if ($msgType === 'success') {
        $_SESSION['gc_glitch_msg'] = $msg;
        header('Location: ' . $back);
        exit;
    }
}

if (!empty($_SESSION['gc_glitch_msg'])) {
    $msg = (string)$_SESSION['gc_glitch_msg'];
    $msgType = 'success';
    unset($_SESSION['gc_glitch_msg']);
}

// ------------------------------------------------------------
// Данные для страницы
// ------------------------------------------------------------
$themesAll = $tableReady ? glitch_themes(false) : [];
$themeMap = [];
foreach ($themesAll as $t) $themeMap[$t['id']] = $t;

$filter = (string)($_GET['theme'] ?? '');
if ($filter !== '' && !isset($themeMap[$filter])) $filter = '';

$questions = [];
if ($tableReady) {
    $questions = $filter !== ''
        ? gamecode_pg_query_all('SELECT * FROM glitch_questions WHERE theme_id = $1 ORDER BY id ASC', [$filter])
        : gamecode_pg_query_all('SELECT q.* FROM glitch_questions q JOIN glitch_themes t ON t.id = q.theme_id ORDER BY t.sort_order ASC, q.id ASC');
    if (!is_array($questions)) $questions = [];
}

$edit = null;
if ($tableReady && isset($_GET['edit'])) $edit = glitch_question((int)$_GET['edit']);

// Если форма не прошла проверку — возвращаем введённое, чтобы не набирать заново
$form = [
    'id' => $edit ? (int)$edit['id'] : 0,
    'theme_id' => $edit['theme_id'] ?? ($filter !== '' ? $filter : ($themesAll[0]['id'] ?? '')),
    'question' => $edit['question'] ?? '',
    'answer1' => $edit['answer1'] ?? '', 'answer2' => $edit['answer2'] ?? '',
    'answer3' => $edit['answer3'] ?? '', 'answer4' => $edit['answer4'] ?? '',
    'correct' => isset($edit['correct']) ? (int)$edit['correct'] : 0,
    'explanation' => $edit['explanation'] ?? '',
];
if ($msgType === 'error' && in_array($_POST['action'] ?? '', ['q_create', 'q_save'], true)) {
    foreach (['theme_id', 'question', 'answer1', 'answer2', 'answer3', 'answer4', 'explanation'] as $k) $form[$k] = (string)($_POST[$k] ?? '');
    $form['correct'] = (int)($_POST['correct'] ?? 0);
    $form['id'] = (int)($_POST['id'] ?? 0);
}

$visibleTotal = 0;
foreach ($themesAll as $t) if (!$t['hidden']) $visibleTotal += $t['count'];
$h = static fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Глюк-атака — Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="<?= $h(asset_url('admin.css', 'admin/admin.css')) ?>"/>
</head>
<body>
<?php include __DIR__ . '/sidebar.php'; ?>
<div class="adm-main">
  <div class="adm-topbar">
    <h1 class="adm-page-title pixel">// ГЛЮК-АТАКА</h1>
    <a href="logout.php" class="adm-btn-danger pixel">[ ВЫЙТИ ]</a>
  </div>

  <?php if (!$tableReady): ?>
    <div class="adm-alert adm-alert-error pixel">
      Таблиц игры ещё нет. Прогоните db/migrations/004-glitch.sql (локально — scripts\migrate-local.cmd, на сервере — само при деплое).
    </div>
  <?php endif; ?>

  <div class="adm-hint pixel">
    Игра берёт вопросы прямо из базы на каждой партии — правка видна сразу. Короткие тексты читаются лучше: вопрос до ~90 символов, вариант до ~40.
    Скрытый вопрос не попадает в игру, но остаётся здесь. Чтобы партию можно было начать, в выбранных темах должно быть не меньше <?= GLITCH_MIN_Q ?> видимых вопросов.
  </div>

  <?php if ($msg): ?>
  <div class="adm-alert adm-alert-<?= $msgType === 'error' ? 'error' : 'success' ?> pixel"><?= $h($msg) ?></div>
  <?php endif; ?>

  <!-- ТЕМЫ -->
  <div class="adm-panel">
    <div class="adm-panel-header">
      <span class="pixel">ТЕМЫ</span>
      <span class="adm-link pixel">в игре: <?= $visibleTotal ?> вопр.</span>
    </div>
    <table class="adm-table adm-table-full">
      <thead>
        <tr>
          <th class="pixel">ЦВЕТ</th>
          <th class="pixel" colspan="2">НАЗВАНИЕ, ЦВЕТ, ПОРЯДОК</th>
          <th class="pixel">ВОПРОСОВ</th>
          <th class="pixel">СТАТУС</th>
          <th class="pixel">ДЕЙСТВИЯ</th>
        </tr>
      </thead>
      <tbody>
      <?php foreach ($themesAll as $t): ?>
        <tr class="<?= $t['hidden'] ? 'row-hidden' : '' ?>">
          <td><span class="adm-glitch-chip pixel" style="--c:<?= $h($t['color']) ?>"><?= $h($t['name']) ?></span></td>
          <td colspan="2">
            <form method="POST" class="adm-shop-row-form">
              <?= admin_csrf_field() ?>
              <input type="hidden" name="action" value="t_save"/>
              <input type="hidden" name="theme_id" value="<?= $h($t['id']) ?>"/>
              <input class="adm-inline-input" type="text" name="name" maxlength="40" value="<?= $h($t['name']) ?>"/>
              <input class="adm-glitch-color" type="color" name="color" value="<?= $h($t['color']) ?>" title="Цвет рамки и призрака"/>
              <input class="adm-inline-input adm-inline-input--num" type="number" name="sort_order" min="0" max="10000" value="<?= (int)$t['sort'] ?>" title="Порядок в меню игры"/>
              <button type="submit" class="adm-btn-sm adm-btn-save" title="Сохранить">💾</button>
            </form>
          </td>
          <td class="pixel">
            <a class="adm-link" href="glitch.php?theme=<?= rawurlencode($t['id']) ?>#questions"><?= $t['count'] ?><?= $t['total'] > $t['count'] ? ' <span class="dim">(+' . ($t['total'] - $t['count']) . ' скрыт.)</span>' : '' ?></a>
          </td>
          <td>
            <?php if ($t['hidden']): ?>
              <span class="adm-badge wip pixel">СКРЫТА</span>
            <?php elseif ($t['count'] === 0): ?>
              <span class="adm-badge wip pixel">ПУСТАЯ</span>
            <?php else: ?>
              <span class="adm-badge active pixel">В ИГРЕ</span>
            <?php endif; ?>
          </td>
          <td>
            <div class="adm-actions">
              <form method="POST" style="display:inline">
                <?= admin_csrf_field() ?>
                <input type="hidden" name="action" value="t_toggle"/>
                <input type="hidden" name="theme_id" value="<?= $h($t['id']) ?>"/>
                <input type="hidden" name="hide" value="<?= $t['hidden'] ? '0' : '1' ?>"/>
                <button type="submit" class="adm-btn-sm adm-btn-warn pixel" title="<?= $t['hidden'] ? 'Вернуть в игру' : 'Скрыть тему' ?>"><?= $t['hidden'] ? '👁' : '🚫' ?></button>
              </form>
              <form method="POST" style="display:inline" onsubmit="return confirm('Удалить тему?')">
                <?= admin_csrf_field() ?>
                <input type="hidden" name="action" value="t_delete"/>
                <input type="hidden" name="theme_id" value="<?= $h($t['id']) ?>"/>
                <button type="submit" class="adm-btn-sm adm-btn-danger pixel"
                        <?= $t['total'] > 0 ? 'disabled title="В теме есть вопросы — её можно только скрыть"' : 'title="Удалить"' ?>>🗑</button>
              </form>
            </div>
          </td>
        </tr>
      <?php endforeach; ?>
        <tr>
          <td><span class="pixel dim">＋</span></td>
          <td colspan="5">
            <form method="POST" class="adm-shop-row-form">
              <?= admin_csrf_field() ?>
              <input type="hidden" name="action" value="t_create"/>
              <input class="adm-inline-input" type="text" name="name" maxlength="40" placeholder="Новая тема, например БЕЗОПАСНОСТЬ" required/>
              <input class="adm-glitch-color" type="color" name="color" value="#00e5ff" title="Цвет рамки и призрака"/>
              <button type="submit" class="adm-btn-sm adm-btn-save pixel" title="Добавить тему" <?= $tableReady ? '' : 'disabled' ?>>＋</button>
            </form>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ФОРМА ВОПРОСА -->
  <div class="adm-panel" id="form">
    <div class="adm-panel-header">
      <span class="pixel"><?= $form['id'] ? '✎ ВОПРОС #' . (int)$form['id'] : '＋ НОВЫЙ ВОПРОС' ?></span>
      <?php if ($form['id']): ?><a class="adm-link pixel" href="glitch.php">отменить</a><?php endif; ?>
    </div>
    <div style="padding:20px 24px;">
      <form method="POST">
        <?= admin_csrf_field() ?>
        <input type="hidden" name="action" value="<?= $form['id'] ? 'q_save' : 'q_create' ?>"/>
        <input type="hidden" name="id" value="<?= (int)$form['id'] ?>"/>
        <input type="hidden" name="filter" value="<?= $h($filter) ?>"/>

        <div class="adm-field">
          <label class="adm-label pixel">// ТЕМА</label>
          <div class="adm-glitch-themes">
            <?php foreach ($themesAll as $t): ?>
              <label class="adm-glitch-radio pixel" style="--c:<?= $h($t['color']) ?>">
                <input type="radio" name="theme_id" value="<?= $h($t['id']) ?>" <?= $form['theme_id'] === $t['id'] ? 'checked' : '' ?>/>
                <span><?= $h($t['name']) ?></span>
              </label>
            <?php endforeach; ?>
          </div>
        </div>

        <div class="adm-field">
          <label class="adm-label pixel">// ВОПРОС</label>
          <textarea class="adm-textarea" name="question" rows="2" maxlength="<?= GLITCH_Q_MAX ?>" required placeholder="Например: Что означает аббревиатура CPU?"><?= $h($form['question']) ?></textarea>
        </div>

        <div class="adm-field">
          <label class="adm-label pixel">// ВАРИАНТЫ — ОТМЕТЬТЕ ВЕРНЫЙ</label>
          <div class="adm-glitch-answers">
            <?php for ($i = 1; $i <= 4; $i++): ?>
              <label class="adm-glitch-answer">
                <input type="radio" name="correct" value="<?= $i - 1 ?>" <?= $form['correct'] === $i - 1 ? 'checked' : '' ?> title="Это правильный ответ"/>
                <input class="adm-input" type="text" name="answer<?= $i ?>" maxlength="<?= GLITCH_A_MAX ?>" required value="<?= $h($form['answer' . $i]) ?>" placeholder="Вариант <?= $i ?>"/>
              </label>
            <?php endfor; ?>
          </div>
          <div class="adm-file-note pixel">В игре варианты каждый раз перемешиваются, так что порядок здесь не важен.</div>
        </div>

        <div class="adm-field">
          <label class="adm-label pixel">// ПОЯСНЕНИЕ ДЛЯ РАЗБОРА ОШИБОК</label>
          <textarea class="adm-textarea" name="explanation" rows="2" maxlength="<?= GLITCH_EXP_MAX ?>" placeholder="Коротко: почему верен именно этот ответ"><?= $h($form['explanation']) ?></textarea>
        </div>

        <button type="submit" class="adm-btn-primary pixel" <?= ($tableReady && $themesAll) ? '' : 'disabled' ?>><?= $form['id'] ? '[ СОХРАНИТЬ ]' : '[ ДОБАВИТЬ ]' ?></button>
      </form>
    </div>
  </div>

  <!-- ВОПРОСЫ -->
  <div class="adm-panel" id="questions">
    <div class="adm-panel-header">
      <span class="pixel">ВОПРОСЫ<?= $filter !== '' ? ' · ' . $h($themeMap[$filter]['name']) : '' ?></span>
      <span class="adm-link pixel"><?= count($questions) ?> шт.</span>
    </div>
    <div class="adm-glitch-filter">
      <a class="adm-glitch-chip pixel <?= $filter === '' ? 'on' : '' ?>" style="--c:#c8d8f0" href="glitch.php#questions">ВСЕ</a>
      <?php foreach ($themesAll as $t): ?>
        <a class="adm-glitch-chip pixel <?= $filter === $t['id'] ? 'on' : '' ?>" style="--c:<?= $h($t['color']) ?>" href="glitch.php?theme=<?= rawurlencode($t['id']) ?>#questions"><?= $h($t['name']) ?></a>
      <?php endforeach; ?>
    </div>

    <table class="adm-table adm-table-full">
      <thead>
        <tr>
          <th class="pixel">#</th>
          <th class="pixel">ТЕМА</th>
          <th class="pixel">ВОПРОС И ВАРИАНТЫ</th>
          <th class="pixel">СТАТУС</th>
          <th class="pixel">ДЕЙСТВИЯ</th>
        </tr>
      </thead>
      <tbody>
      <?php foreach ($questions as $q):
          $qid = (int)$q['id'];
          $hidden = gamecode_db_bool($q['hidden']);
          $t = $themeMap[$q['theme_id']] ?? ['name' => $q['theme_id'], 'color' => '#00e5ff'];
      ?>
        <tr class="<?= $hidden ? 'row-hidden' : '' ?>">
          <td class="pixel dim"><?= $qid ?></td>
          <td><span class="adm-glitch-chip pixel" style="--c:<?= $h($t['color']) ?>"><?= $h($t['name']) ?></span></td>
          <td class="adm-glitch-q">
            <div class="adm-glitch-qtext"><?= $h($q['question']) ?></div>
            <ol class="adm-glitch-opts">
              <?php for ($i = 1; $i <= 4; $i++): $isRight = (int)$q['correct'] === $i - 1; ?>
                <li class="<?= $isRight ? 'right' : '' ?>"><?= $isRight ? '✓ ' : '' ?><?= $h($q['answer' . $i]) ?></li>
              <?php endfor; ?>
            </ol>
            <?php if (trim((string)$q['explanation']) !== ''): ?>
              <div class="adm-glitch-exp"><?= $h($q['explanation']) ?></div>
            <?php endif; ?>
          </td>
          <td>
            <?php if ($hidden): ?><span class="adm-badge wip pixel">СКРЫТ</span>
            <?php else: ?><span class="adm-badge active pixel">В ИГРЕ</span><?php endif; ?>
          </td>
          <td>
            <div class="adm-actions">
              <a class="adm-btn-sm pixel" href="glitch.php?edit=<?= $qid ?><?= $filter !== '' ? '&theme=' . rawurlencode($filter) : '' ?>#form" title="Изменить">✎</a>
              <form method="POST" style="display:inline">
                <?= admin_csrf_field() ?>
                <input type="hidden" name="action" value="q_toggle"/>
                <input type="hidden" name="id" value="<?= $qid ?>"/>
                <input type="hidden" name="hide" value="<?= $hidden ? '0' : '1' ?>"/>
                <input type="hidden" name="filter" value="<?= $h($filter) ?>"/>
                <button type="submit" class="adm-btn-sm adm-btn-warn pixel" title="<?= $hidden ? 'Вернуть в игру' : 'Скрыть' ?>"><?= $hidden ? '👁' : '🚫' ?></button>
              </form>
              <form method="POST" style="display:inline" onsubmit="return confirm('Удалить вопрос #<?= $qid ?>?')">
                <?= admin_csrf_field() ?>
                <input type="hidden" name="action" value="q_delete"/>
                <input type="hidden" name="id" value="<?= $qid ?>"/>
                <input type="hidden" name="filter" value="<?= $h($filter) ?>"/>
                <button type="submit" class="adm-btn-sm adm-btn-danger pixel" title="Удалить">🗑</button>
              </form>
            </div>
          </td>
        </tr>
      <?php endforeach; ?>
      <?php if (!$questions): ?>
        <tr><td colspan="5" class="pixel" style="text-align:center;padding:24px;opacity:.6">Пусто</td></tr>
      <?php endif; ?>
      </tbody>
    </table>
  </div>
</div>
</body>
</html>
