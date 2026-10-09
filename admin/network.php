<?php
/**
 * ============================================================
 *  АДМИНКА: «СЕТЕВОЙ МАРШРУТ» — теоретические вопросы
 *
 *  Числовые задания (адреса, маски, шлюзы, маршрутизация) игра
 *  генерирует сама — includes/network.php. Здесь правится только
 *  теория из таблицы network_questions (миграция 006-network.sql)
 *  и можно посмотреть примеры сгенерированных заданий.
 *
 *  У вопроса есть «уровень» — с какого уровня игры он может выпасть:
 *  1 — на всех, 2 — Практик и Эксперт, 3 — только Эксперт.
 * ============================================================
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/csrf.php';
require_once dirname(__DIR__) . '/includes/network.php';
requireAdmin();

$tableReady = network_tables_ready();
$msg = '';
$msgType = 'success';

const NET_ADM_LEVELS = [
    1 => ['name' => 'С НОВИЧКА',  'color' => '#39ff14'],
    2 => ['name' => 'С ПРАКТИКА', 'color' => '#f5d800'],
    3 => ['name' => 'ЭКСПЕРТ',    'color' => '#ff4d6d'],
];

function net_adm_short(string $s, int $n = 50): string {
    $s = trim(preg_replace('/\s+/u', ' ', $s) ?? $s);
    return mb_strlen($s, 'UTF-8') > $n ? mb_substr($s, 0, $n - 1, 'UTF-8') . '…' : $s;
}

function net_adm_question(int $id): ?array {
    $rows = gamecode_pg_query_all('SELECT * FROM network_questions WHERE id = $1', [$id]);
    return (is_array($rows) && $rows) ? $rows[0] : null;
}

/** Проверка и сборка полей вопроса из формы. Возвращает [данные, ошибка]. */
function net_adm_from_post(): array {
    $level = (int)($_POST['level'] ?? 0);
    $question = trim((string)($_POST['question'] ?? ''));
    $answers = [];
    for ($i = 1; $i <= 4; $i++) $answers[] = trim((string)($_POST['answer' . $i] ?? ''));
    $correct = (int)($_POST['correct'] ?? -1);
    $explain = trim((string)($_POST['explanation'] ?? ''));

    if (!isset(NET_ADM_LEVELS[$level])) return [null, 'Выберите уровень'];
    if ($question === '') return [null, 'Нужен текст вопроса'];
    if (mb_strlen($question, 'UTF-8') > NET_Q_MAX) return [null, 'Вопрос длиннее ' . NET_Q_MAX . ' символов'];
    foreach ($answers as $i => $a) {
        if ($a === '') return [null, 'Заполните все 4 варианта ответа'];
        if (mb_strlen($a, 'UTF-8') > NET_A_MAX) return [null, 'Вариант ' . ($i + 1) . ' длиннее ' . NET_A_MAX . ' символов'];
    }
    $lower = array_map(static fn($a) => mb_strtolower($a, 'UTF-8'), $answers);
    if (count(array_unique($lower)) !== 4) return [null, 'Варианты ответа не должны повторяться'];
    if ($correct < 0 || $correct > 3) return [null, 'Отметьте правильный вариант'];
    if (mb_strlen($explain, 'UTF-8') > NET_EXP_MAX) return [null, 'Пояснение длиннее ' . NET_EXP_MAX . ' символов'];

    return [[
        'level' => $level, 'question' => $question,
        'answer1' => $answers[0], 'answer2' => $answers[1], 'answer3' => $answers[2], 'answer4' => $answers[3],
        'correct' => $correct, 'explanation' => $explain,
    ], null];
}

// ------------------------------------------------------------
// Действия
// ------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    admin_csrf_check();
    $action = (string)($_POST['action'] ?? '');
    $qid = (int)($_POST['id'] ?? 0);
    $filterPost = (int)($_POST['filter'] ?? 0);
    $back = 'network.php' . ($filterPost ? '?level=' . $filterPost : '');

    if (!$tableReady) {
        $msg = 'Таблицы ещё нет — прогоните db/migrations/006-network.sql';
        $msgType = 'error';

    } elseif ($action === 'q_create' || $action === 'q_save') {
        [$data, $err] = net_adm_from_post();
        if ($err) {
            $msg = $err; $msgType = 'error';
        } elseif ($action === 'q_create') {
            $ok = gamecode_pg_exec(
                'INSERT INTO network_questions (level, question, answer1, answer2, answer3, answer4, correct, explanation)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                array_values($data)
            );
            if ($ok) { writeLog('Сетевой маршрут: добавлен вопрос', net_adm_short($data['question'])); $msg = 'Вопрос добавлен'; }
            else { $msg = 'Не удалось сохранить вопрос'; $msgType = 'error'; }
        } else {
            $res = gamecode_pg_exec(
                'UPDATE network_questions SET level = $1, question = $2, answer1 = $3, answer2 = $4, answer3 = $5,
                        answer4 = $6, correct = $7, explanation = $8, updated_at = now()
                 WHERE id = $9',
                array_merge(array_values($data), [$qid])
            );
            if ($res && pg_affected_rows($res) === 1) {
                writeLog('Сетевой маршрут: изменён вопрос #' . $qid, net_adm_short($data['question']));
                $msg = 'Вопрос #' . $qid . ' сохранён';
            } else { $msg = 'Вопрос не найден'; $msgType = 'error'; }
        }

    } elseif ($action === 'q_toggle') {
        $hide = ($_POST['hide'] ?? '') === '1';
        $res = gamecode_pg_exec('UPDATE network_questions SET hidden = $1, updated_at = now() WHERE id = $2', [$hide ? 't' : 'f', $qid]);
        if ($res && pg_affected_rows($res) === 1) {
            writeLog($hide ? 'Сетевой маршрут: вопрос скрыт' : 'Сетевой маршрут: вопрос возвращён', '#' . $qid);
            $msg = $hide ? 'Вопрос скрыт — в игру он больше не попадёт' : 'Вопрос снова в игре';
        } else { $msg = 'Вопрос не найден'; $msgType = 'error'; }

    } elseif ($action === 'q_delete') {
        $q = net_adm_question($qid);
        $res = gamecode_pg_exec('DELETE FROM network_questions WHERE id = $1', [$qid]);
        if ($q && $res && pg_affected_rows($res) === 1) {
            writeLog('Сетевой маршрут: удалён вопрос #' . $qid, net_adm_short((string)$q['question']));
            $msg = 'Вопрос #' . $qid . ' удалён';
        } else { $msg = 'Вопрос не найден'; $msgType = 'error'; }
    }

    if ($msgType === 'success') {
        $_SESSION['gc_network_msg'] = $msg;
        header('Location: ' . $back);
        exit;
    }
}

if (!empty($_SESSION['gc_network_msg'])) {
    $msg = (string)$_SESSION['gc_network_msg'];
    $msgType = 'success';
    unset($_SESSION['gc_network_msg']);
}

// ------------------------------------------------------------
// Данные для страницы
// ------------------------------------------------------------
$filter = (int)($_GET['level'] ?? 0);
if (!isset(NET_ADM_LEVELS[$filter])) $filter = 0;

$questions = [];
$counts = [1 => 0, 2 => 0, 3 => 0];
if ($tableReady) {
    $questions = $filter
        ? gamecode_pg_query_all('SELECT * FROM network_questions WHERE level = $1 ORDER BY id ASC', [$filter])
        : gamecode_pg_query_all('SELECT * FROM network_questions ORDER BY level ASC, id ASC');
    if (!is_array($questions)) $questions = [];
    $rows = gamecode_pg_query_all('SELECT level, COUNT(*) FILTER (WHERE NOT hidden) AS n FROM network_questions GROUP BY level');
    foreach ((is_array($rows) ? $rows : []) as $r) $counts[(int)$r['level']] = (int)$r['n'];
}

$edit = ($tableReady && isset($_GET['edit'])) ? net_adm_question((int)$_GET['edit']) : null;
$form = [
    'id' => $edit ? (int)$edit['id'] : 0,
    'level' => isset($edit['level']) ? (int)$edit['level'] : ($filter ?: 1),
    'question' => $edit['question'] ?? '',
    'answer1' => $edit['answer1'] ?? '', 'answer2' => $edit['answer2'] ?? '',
    'answer3' => $edit['answer3'] ?? '', 'answer4' => $edit['answer4'] ?? '',
    'correct' => isset($edit['correct']) ? (int)$edit['correct'] : 0,
    'explanation' => $edit['explanation'] ?? '',
];
if ($msgType === 'error' && in_array($_POST['action'] ?? '', ['q_create', 'q_save'], true)) {
    foreach (['question', 'answer1', 'answer2', 'answer3', 'answer4', 'explanation'] as $k) $form[$k] = (string)($_POST[$k] ?? '');
    $form['level'] = (int)($_POST['level'] ?? 1);
    $form['correct'] = (int)($_POST['correct'] ?? 0);
    $form['id'] = (int)($_POST['id'] ?? 0);
}

// Примеры сгенерированных заданий — по одному каждого типа выбранного уровня
$preview = (int)($_GET['preview'] ?? 0);
$samples = [];
if (isset(NET_LEVELS[$preview])) {
    foreach (array_keys(NET_LEVELS[$preview]['plan']) as $type) {
        if ($type !== 'theory') $samples[] = network_generate($type, $preview);
    }
}

$h = static fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Сетевой маршрут — Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="<?= $h(asset_url('admin.css', 'admin/admin.css')) ?>"/>
</head>
<body>
<?php include __DIR__ . '/sidebar.php'; ?>
<div class="adm-main">
  <div class="adm-topbar">
    <h1 class="adm-page-title pixel">// СЕТЕВОЙ МАРШРУТ</h1>
    <a href="logout.php" class="adm-btn-danger pixel">[ ВЫЙТИ ]</a>
  </div>

  <?php if (!$tableReady): ?>
    <div class="adm-alert adm-alert-error pixel">
      Таблицы вопросов ещё нет. Прогоните db/migrations/006-network.sql (локально — scripts\migrate-local.cmd, на сервере — само при деплое).
    </div>
  <?php endif; ?>

  <div class="adm-hint pixel">
    Задания про адреса, маски, шлюзы и маршрутизацию игра генерирует сама — каждый раз новые и с верным ответом.
    Здесь — теоретические вопросы: в партии Новичка их 2, Практика 2, Эксперта 1. Если подходящих вопросов не хватит, игра заменит их сгенерированными.
  </div>

  <?php if ($msg): ?>
  <div class="adm-alert adm-alert-<?= $msgType === 'error' ? 'error' : 'success' ?> pixel"><?= $h($msg) ?></div>
  <?php endif; ?>

  <!-- ПРИМЕРЫ ГЕНЕРАТОРА -->
  <div class="adm-panel" id="preview">
    <div class="adm-panel-header">
      <span class="pixel">ПРИМЕРЫ СГЕНЕРИРОВАННЫХ ЗАДАНИЙ</span>
      <span>
        <?php foreach (NET_LEVELS as $id => $cfg): ?>
          <a class="adm-glitch-chip pixel <?= $preview === $id ? 'on' : '' ?>" style="--c:<?= $h(NET_ADM_LEVELS[$id]['color']) ?>" href="network.php?preview=<?= $id ?>#preview"><?= $h($cfg['name']) ?></a>
        <?php endforeach; ?>
      </span>
    </div>
    <?php if ($samples): ?>
    <table class="adm-table adm-table-full">
      <thead><tr><th class="pixel">ТИП</th><th class="pixel">ЗАДАНИЕ И ВАРИАНТЫ</th></tr></thead>
      <tbody>
      <?php foreach ($samples as $s): ?>
        <tr>
          <td><span class="adm-glitch-chip pixel" style="--c:#00e5ff"><?= $h(NET_TYPE_LABELS[$s['type']]) ?></span></td>
          <td class="adm-glitch-q">
            <div class="adm-glitch-qtext"><?= $h($s['text']) ?></div>
            <?php if ($s['type'] === 'route'): ?>
              <div class="adm-glitch-exp"><?php foreach ($s['data']['table'] as $r) echo $h($r['dest'] . ' → ' . $r['iface'] . ' (' . $r['label'] . ')') . '<br>'; ?></div>
            <?php endif; ?>
            <ol class="adm-glitch-opts">
              <?php foreach ($s['options'] as $i => $o): $isRight = $i === (int)$s['answer']; ?>
                <li class="<?= $isRight ? 'right' : '' ?>"><?= $isRight ? '✓ ' : '' ?><?= $h($o) ?></li>
              <?php endforeach; ?>
            </ol>
            <div class="adm-glitch-exp"><?= $h($s['explain']) ?></div>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
    <?php else: ?>
      <div class="adm-hint pixel" style="margin:16px 20px">Выберите уровень — покажу по одному заданию каждого типа. Каждый клик — новые адреса.</div>
    <?php endif; ?>
  </div>

  <!-- ФОРМА ВОПРОСА -->
  <div class="adm-panel" id="form">
    <div class="adm-panel-header">
      <span class="pixel"><?= $form['id'] ? '✎ ВОПРОС #' . (int)$form['id'] : '＋ НОВЫЙ ВОПРОС' ?></span>
      <?php if ($form['id']): ?><a class="adm-link pixel" href="network.php">отменить</a><?php endif; ?>
    </div>
    <div style="padding:20px 24px;">
      <form method="POST">
        <?= admin_csrf_field() ?>
        <input type="hidden" name="action" value="<?= $form['id'] ? 'q_save' : 'q_create' ?>"/>
        <input type="hidden" name="id" value="<?= (int)$form['id'] ?>"/>
        <input type="hidden" name="filter" value="<?= (int)$filter ?>"/>

        <div class="adm-field">
          <label class="adm-label pixel">// С КАКОГО УРОВНЯ ПОКАЗЫВАТЬ</label>
          <div class="adm-glitch-themes">
            <?php foreach (NET_ADM_LEVELS as $id => $l): ?>
              <label class="adm-glitch-radio pixel" style="--c:<?= $h($l['color']) ?>">
                <input type="radio" name="level" value="<?= $id ?>" <?= $form['level'] === $id ? 'checked' : '' ?>/>
                <span><?= $h($l['name']) ?></span>
              </label>
            <?php endforeach; ?>
          </div>
        </div>

        <div class="adm-field">
          <label class="adm-label pixel">// ВОПРОС</label>
          <textarea class="adm-textarea" name="question" rows="2" maxlength="<?= NET_Q_MAX ?>" required placeholder="Например: Какой порт по умолчанию у DNS?"><?= $h($form['question']) ?></textarea>
        </div>

        <div class="adm-field">
          <label class="adm-label pixel">// ВАРИАНТЫ — ОТМЕТЬТЕ ВЕРНЫЙ</label>
          <div class="adm-glitch-answers">
            <?php for ($i = 1; $i <= 4; $i++): ?>
              <label class="adm-glitch-answer">
                <input type="radio" name="correct" value="<?= $i - 1 ?>" <?= $form['correct'] === $i - 1 ? 'checked' : '' ?> title="Это правильный ответ"/>
                <input class="adm-input" type="text" name="answer<?= $i ?>" maxlength="<?= NET_A_MAX ?>" required value="<?= $h($form['answer' . $i]) ?>" placeholder="Вариант <?= $i ?>"/>
              </label>
            <?php endfor; ?>
          </div>
          <div class="adm-file-note pixel">В игре варианты перемешиваются, порядок здесь не важен. Короткие варианты (до ~40 символов) читаются лучше.</div>
        </div>

        <div class="adm-field">
          <label class="adm-label pixel">// ПОЯСНЕНИЕ — ЕГО ГОВОРИТ ГЕККОН ПОСЛЕ ОТВЕТА</label>
          <textarea class="adm-textarea" name="explanation" rows="2" maxlength="<?= NET_EXP_MAX ?>" placeholder="Коротко: почему верен именно этот ответ"><?= $h($form['explanation']) ?></textarea>
        </div>

        <button type="submit" class="adm-btn-primary pixel" <?= $tableReady ? '' : 'disabled' ?>><?= $form['id'] ? '[ СОХРАНИТЬ ]' : '[ ДОБАВИТЬ ]' ?></button>
      </form>
    </div>
  </div>

  <!-- ВОПРОСЫ -->
  <div class="adm-panel" id="questions">
    <div class="adm-panel-header">
      <span class="pixel">ТЕОРИЯ</span>
      <span class="adm-link pixel"><?= count($questions) ?> шт.</span>
    </div>
    <div class="adm-glitch-filter">
      <a class="adm-glitch-chip pixel <?= $filter === 0 ? 'on' : '' ?>" style="--c:#c8d8f0" href="network.php#questions">ВСЕ</a>
      <?php foreach (NET_ADM_LEVELS as $id => $l): ?>
        <a class="adm-glitch-chip pixel <?= $filter === $id ? 'on' : '' ?>" style="--c:<?= $h($l['color']) ?>" href="network.php?level=<?= $id ?>#questions"><?= $h($l['name']) ?> · <?= $counts[$id] ?></a>
      <?php endforeach; ?>
    </div>

    <table class="adm-table adm-table-full">
      <thead>
        <tr>
          <th class="pixel">#</th>
          <th class="pixel">УРОВЕНЬ</th>
          <th class="pixel">ВОПРОС И ВАРИАНТЫ</th>
          <th class="pixel">СТАТУС</th>
          <th class="pixel">ДЕЙСТВИЯ</th>
        </tr>
      </thead>
      <tbody>
      <?php foreach ($questions as $q):
          $qid = (int)$q['id'];
          $hidden = gamecode_db_bool($q['hidden']);
          $l = NET_ADM_LEVELS[(int)$q['level']] ?? NET_ADM_LEVELS[1];
      ?>
        <tr class="<?= $hidden ? 'row-hidden' : '' ?>">
          <td class="pixel dim"><?= $qid ?></td>
          <td><span class="adm-glitch-chip pixel" style="--c:<?= $h($l['color']) ?>"><?= $h($l['name']) ?></span></td>
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
              <a class="adm-btn-sm pixel" href="network.php?edit=<?= $qid ?><?= $filter ? '&level=' . $filter : '' ?>#form" title="Изменить">✎</a>
              <form method="POST" style="display:inline">
                <?= admin_csrf_field() ?>
                <input type="hidden" name="action" value="q_toggle"/>
                <input type="hidden" name="id" value="<?= $qid ?>"/>
                <input type="hidden" name="hide" value="<?= $hidden ? '0' : '1' ?>"/>
                <input type="hidden" name="filter" value="<?= (int)$filter ?>"/>
                <button type="submit" class="adm-btn-sm adm-btn-warn pixel" title="<?= $hidden ? 'Вернуть в игру' : 'Скрыть' ?>"><?= $hidden ? '👁' : '🚫' ?></button>
              </form>
              <form method="POST" style="display:inline" onsubmit="return confirm('Удалить вопрос #<?= $qid ?>?')">
                <?= admin_csrf_field() ?>
                <input type="hidden" name="action" value="q_delete"/>
                <input type="hidden" name="id" value="<?= $qid ?>"/>
                <input type="hidden" name="filter" value="<?= (int)$filter ?>"/>
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
