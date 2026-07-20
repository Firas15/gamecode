<?php
require_once __DIR__ . '/config.php';
requireAdmin();

$msg = ''; $msgType = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    // Добавить игру
    if ($action === 'add') {
        $id    = preg_replace('/[^a-z0-9_\-]/', '', strtolower(trim($_POST['id'] ?? '')));
        $title = trim($_POST['title'] ?? '');
        $desc  = trim($_POST['desc'] ?? '');
        $emoji = trim($_POST['emoji'] ?? '🎮');
        $level = in_array($_POST['level'] ?? '', ['beginner','medium','expert']) ? $_POST['level'] : 'beginner';
        $stars = max(1, min(5, (int)($_POST['stars'] ?? 1)));
        $link  = trim($_POST['link'] ?? '#');
        $wip   = isset($_POST['wip']) ? 1 : 0;

        if (!$id || !$title) {
            $msg = 'ID и название обязательны'; $msgType = 'error';
        } else {
            $games = readGames();
            foreach ($games as $g) {
                if ($g['id'] === $id) { $msg = 'Игра с таким ID уже существует'; $msgType = 'error'; break; }
            }
            if (!$msg) {
                $games[] = compact('id','title','desc','emoji','level','stars','link','wip') + ['created_at' => date('Y-m-d H:i:s')];
                cached_write_games($games);
                writeLog('Добавлена игра', $title);
                $msg = "Игра «{$title}» добавлена!"; $msgType = 'success';
            }
        }
    }

    // Удалить игру
    if ($action === 'delete' && !empty($_POST['game_id'])) {
        $gid   = $_POST['game_id'];
        $games = readGames();
        $title = '';
        $games = array_filter($games, function($g) use ($gid, &$title) {
            if ($g['id'] === $gid) { $title = $g['title']; return false; }
            return true;
        });
        cached_write_games(array_values($games));
        writeLog('Удалена игра', $title);
        $msg = "Игра «{$title}» удалена."; $msgType = 'success';
    }

    // Переключить WIP
    if ($action === 'toggle_wip' && !empty($_POST['game_id'])) {
        $gid   = $_POST['game_id'];
        $games = readGames();
        foreach ($games as &$g) {
            if ($g['id'] === $gid) {
                $g['wip'] = $g['wip'] ? 0 : 1;
                $status = $g['wip'] ? 'WIP' : 'LIVE';
                writeLog("Игра переведена в {$status}", $g['title']);
                $msg = "Статус изменён на {$status}"; $msgType = 'success';
                break;
            }
        } unset($g);
        cached_write_games($games);
    }
}

$games = readGames();
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Игры — Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('admin.css', 'admin/admin.css'), ENT_QUOTES, 'UTF-8') ?>"/>
</head>
<body>
<?php include __DIR__ . '/sidebar.php'; ?>
<div class="adm-main">
  <div class="adm-topbar">
    <h1 class="adm-page-title pixel">// УПРАВЛЕНИЕ ИГРАМИ</h1>
    <a href="logout.php" class="adm-btn-danger pixel">[ ВЫЙТИ ]</a>
  </div>

  <?php if ($msg): ?>
  <div class="adm-alert adm-alert-<?= $msgType ?> pixel"><?= htmlspecialchars($msg) ?></div>
  <?php endif; ?>

  <!-- Форма добавления -->
  <div class="adm-panel">
    <div class="adm-panel-header">
      <span class="pixel">➕ ДОБАВИТЬ ИГРУ</span>
      <button class="adm-link pixel" onclick="toggleForm()" id="formToggle">[ ОТКРЫТЬ ]</button>
    </div>
    <div id="addForm" style="display:none; padding:20px 24px;">
      <form method="POST" class="adm-form-grid">
        <input type="hidden" name="action" value="add"/>
        <div class="adm-field">
          <label class="adm-label pixel">// ID (латиница)</label>
          <div class="adm-input-wrap">
            <input class="adm-input" type="text" name="id" placeholder="my-game" required pattern="[a-z0-9_\-]+"/>
          </div>
        </div>
        <div class="adm-field">
          <label class="adm-label pixel">// НАЗВАНИЕ</label>
          <div class="adm-input-wrap">
            <input class="adm-input" type="text" name="title" placeholder="Моя игра" required/>
          </div>
        </div>
        <div class="adm-field">
          <label class="adm-label pixel">// ЭМОДЗИ</label>
          <div class="adm-input-wrap">
            <input class="adm-input" type="text" name="emoji" value="🎮" maxlength="4"/>
          </div>
        </div>
        <div class="adm-field">
          <label class="adm-label pixel">// УРОВЕНЬ</label>
          <div class="adm-input-wrap">
            <select class="adm-input" name="level">
              <option value="beginner">Новичок</option>
              <option value="medium">Практик</option>
              <option value="expert">Эксперт</option>
            </select>
          </div>
        </div>
        <div class="adm-field">
          <label class="adm-label pixel">// ЗВЁЗД (1-5)</label>
          <div class="adm-input-wrap">
            <input class="adm-input" type="number" name="stars" value="1" min="1" max="5"/>
          </div>
        </div>
        <div class="adm-field">
          <label class="adm-label pixel">// ССЫЛКА</label>
          <div class="adm-input-wrap">
            <input class="adm-input" type="text" name="link" placeholder="games/mygame/index.html"/>
          </div>
        </div>
        <div class="adm-field" style="grid-column:1/-1">
          <label class="adm-label pixel">// ОПИСАНИЕ</label>
          <div class="adm-input-wrap">
            <input class="adm-input" type="text" name="desc" placeholder="Краткое описание игры..."/>
          </div>
        </div>
        <div class="adm-field" style="grid-column:1/-1">
          <label class="adm-toggle-label pixel">
            <input type="checkbox" name="wip"/>
            <span class="adm-checkbox-custom"></span>
            В разработке (WIP)
          </label>
        </div>
        <div style="grid-column:1/-1">
          <button type="submit" class="adm-btn-primary pixel">[ ДОБАВИТЬ ИГРУ ]</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Список игр -->
  <div class="adm-panel" style="margin-top:20px">
    <div class="adm-panel-header">
      <span class="pixel">🎮 ВСЕ ИГРЫ (<?= count($games) ?>)</span>
    </div>
    <table class="adm-table adm-table-full">
      <thead>
        <tr><th>Эмодзи</th><th>ID</th><th>Название</th><th>Уровень</th><th>Звёзды</th><th>Статус</th><th>Добавлена</th><th>Действия</th></tr>
      </thead>
      <tbody>
        <?php foreach ($games as $g): ?>
        <tr>
          <td style="font-size:22px"><?= htmlspecialchars($g['emoji']) ?></td>
          <td class="pixel dim"><?= htmlspecialchars($g['id']) ?></td>
          <td class="pixel"><a href="../<?= htmlspecialchars($g['link']) ?>" target="_blank" class="adm-link"><?= htmlspecialchars($g['title']) ?></a></td>
          <td class="pixel"><?= htmlspecialchars($g['level']) ?></td>
          <td><?= str_repeat('⭐', (int)$g['stars']) ?></td>
          <td>
            <?php if ($g['wip']): ?>
            <span class="adm-badge wip pixel">WIP</span>
            <?php else: ?>
            <span class="adm-badge active pixel">LIVE</span>
            <?php endif; ?>
          </td>
          <td class="pixel dim"><?= htmlspecialchars(substr($g['created_at'] ?? '', 0, 10)) ?></td>
          <td class="adm-actions">
            <form method="POST" style="display:inline">
              <input type="hidden" name="action" value="toggle_wip"/>
              <input type="hidden" name="game_id" value="<?= htmlspecialchars($g['id']) ?>"/>
              <button type="submit" class="adm-btn-sm adm-btn-warn pixel" title="<?= $g['wip'] ? 'Сделать LIVE' : 'Сделать WIP' ?>">
                <?= $g['wip'] ? '▶' : '⏸' ?>
              </button>
            </form>
            <form method="POST" style="display:inline"
                  onsubmit="return confirm('Удалить «<?= htmlspecialchars($g['title'], ENT_QUOTES) ?>»?')">
              <input type="hidden" name="action" value="delete"/>
              <input type="hidden" name="game_id" value="<?= htmlspecialchars($g['id']) ?>"/>
              <button type="submit" class="adm-btn-sm adm-btn-danger pixel">🗑</button>
            </form>
          </td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>

</div>
<script>
  function toggleForm() {
    const f = document.getElementById('addForm');
    const b = document.getElementById('formToggle');
    const open = f.style.display === 'none';
    f.style.display = open ? 'block' : 'none';
    b.textContent = open ? '[ ЗАКРЫТЬ ]' : '[ ОТКРЫТЬ ]';
  }
</script>
</body>
</html>
