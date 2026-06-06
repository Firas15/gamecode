<?php
require_once __DIR__ . '/config.php';
requireAdmin();

function findNewsById(array $news, string $id): ?array {
    foreach ($news as $item) {
        if (($item['id'] ?? '') === $id) return $item;
    }
    return null;
}

function findNewsIndexById(array $news, string $id): int {
    foreach ($news as $index => $item) {
        if (($item['id'] ?? '') === $id) return $index;
    }
    return -1;
}

function removeNewsImage(?string $relativePath): void {
    if (!$relativePath || !is_string($relativePath)) return;
    $relativePath = str_replace('\\', '/', $relativePath);
    if (strpos($relativePath, NEWS_UPLOAD_WEB . '/') !== 0) return;

    $fullPath = dirname(__DIR__) . '/' . $relativePath;
    $uploadRoot = realpath(NEWS_UPLOAD_DIR);
    $fullReal = realpath($fullPath);
    if ($uploadRoot && $fullReal && strpos($fullReal, $uploadRoot) === 0 && is_file($fullReal)) {
        @unlink($fullReal);
    }
}

function uploadNewsImage(string $newsId, array $file): array {
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        return [null, 'Не удалось загрузить изображение'];
    }

    $tmpName = $file['tmp_name'] ?? '';
    if (!is_uploaded_file($tmpName)) {
        return [null, 'Файл загрузки не найден'];
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = $finfo ? finfo_file($finfo, $tmpName) : '';
    if ($finfo) finfo_close($finfo);

    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        'image/gif'  => 'gif',
    ];

    if (!isset($allowed[$mime])) {
        return [null, 'Разрешены только JPG, PNG, WEBP или GIF'];
    }

    if (!is_dir(NEWS_UPLOAD_DIR)) {
        mkdir(NEWS_UPLOAD_DIR, 0755, true);
    }

    $fileName = $newsId . '-' . time() . '.' . $allowed[$mime];
    $target = NEWS_UPLOAD_DIR . '/' . $fileName;
    if (!move_uploaded_file($tmpName, $target)) {
        return [null, 'Не удалось сохранить изображение'];
    }

    return [NEWS_UPLOAD_WEB . '/' . $fileName, ''];
}

$news = readNews();
$msg = '';
$msgType = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    if ($action === 'save') {
        $news = readNews();
        $existingId = preg_replace('/[^a-z0-9_-]/', '', strtolower(trim($_POST['existing_id'] ?? '')));
        $title = trim($_POST['title'] ?? '');
        $description = trim($_POST['description'] ?? '');
        $layout = ($_POST['layout'] ?? 'left') === 'right' ? 'right' : 'left';
        $existing = $existingId ? findNewsById($news, $existingId) : null;
        $slugBase = preg_replace('/[^a-z0-9_-]/', '-', strtolower(trim($_POST['slug'] ?? '')));
        $slugBase = trim((string)$slugBase, '-');
        $newsId = $existing['id'] ?? ($slugBase !== '' ? $slugBase : 'news-' . substr(md5(uniqid('', true)), 0, 8));

        $duplicate = !$existing && findNewsById($news, $newsId);

        if ($title === '' || $description === '') {
            $msg = 'Заполни заголовок и описание';
            $msgType = 'error';
        } elseif ($duplicate) {
            $msg = 'Новость с таким slug уже существует';
            $msgType = 'error';
        } elseif (!$existing && count($news) >= 3) {
            $msg = 'Максимум 3 новости в карусели';
            $msgType = 'error';
        } else {
            $imagePath = $existing['image'] ?? '';
            if (!empty($_FILES['image']['name'])) {
                [$uploadedPath, $uploadError] = uploadNewsImage($newsId, $_FILES['image']);
                if ($uploadError !== '') {
                    $msg = $uploadError;
                    $msgType = 'error';
                } else {
                    removeNewsImage($imagePath);
                    $imagePath = $uploadedPath;
                }
            }

            if ($msg === '' && $imagePath === '') {
                $msg = 'Для новости нужно загрузить изображение';
                $msgType = 'error';
            }

            if ($msg === '') {
                $record = [
                    'id' => $newsId,
                    'title' => $title,
                    'description' => $description,
                    'image' => $imagePath,
                    'layout' => $layout,
                    'created_at' => $existing['created_at'] ?? date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s'),
                ];

                $saved = false;
                foreach ($news as $index => $item) {
                    if (($item['id'] ?? '') === $newsId) {
                        $news[$index] = $record;
                        $saved = true;
                        break;
                    }
                }
                if (!$saved) $news[] = $record;

                writeNews(array_slice(array_values($news), 0, 3));
                writeLog($existing ? 'Обновлена новость' : 'Добавлена новость', $title);
                $msg = $existing ? 'Новость обновлена' : 'Новость добавлена';
                $msgType = 'success';
                $news = readNews();
            }
        }
    }

    if ($action === 'delete') {
        $news = readNews();
        $newsId = preg_replace('/[^a-z0-9_-]/', '', strtolower(trim($_POST['news_id'] ?? '')));
        $removedTitle = '';
        $nextNews = [];

        foreach ($news as $item) {
            if (($item['id'] ?? '') === $newsId) {
                $removedTitle = (string)($item['title'] ?? '');
                removeNewsImage($item['image'] ?? '');
                continue;
            }
            $nextNews[] = $item;
        }

        writeNews($nextNews);
        writeLog('Удалена новость', $removedTitle);
        $msg = 'Новость удалена';
        $msgType = 'success';
        $news = readNews();
    }

    if ($action === 'move') {
        $news = readNews();
        $newsId = preg_replace('/[^a-z0-9_-]/', '', strtolower(trim($_POST['news_id'] ?? '')));
        $direction = ($_POST['direction'] ?? '') === 'up' ? 'up' : 'down';
        $index = findNewsIndexById($news, $newsId);

        if ($index >= 0) {
            $swapIndex = $direction === 'up' ? $index - 1 : $index + 1;
            if (isset($news[$swapIndex])) {
                $currentItem = $news[$index];
                $news[$index] = $news[$swapIndex];
                $news[$swapIndex] = $currentItem;
                writeNews($news);
                writeLog('Изменен порядок новостей', (string)($currentItem['title'] ?? ''));
                $msg = 'Порядок новостей обновлен';
                $msgType = 'success';
                $news = readNews();
            }
        }
    }
}

$editId = preg_replace('/[^a-z0-9_-]/', '', strtolower(trim($_GET['edit'] ?? '')));
$editItem = $editId ? findNewsById($news, $editId) : null;
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Новости — Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('admin.css', 'admin/admin.css'), ENT_QUOTES, 'UTF-8') ?>"/>
</head>
<body>
<?php include __DIR__ . '/sidebar.php'; ?>
<div class="adm-main">
  <div class="adm-topbar">
    <h1 class="adm-page-title pixel">// НОВОСТИ GAMECODE</h1>
    <a href="logout.php" class="adm-btn-danger pixel">[ ВЫЙТИ ]</a>
  </div>

  <div class="adm-hint pixel">Лимит: максимум 3 новости. Для каждой записи можно загрузить картинку, задать пиксельный текст и выбрать, с какой стороны будет изображение. Дата на карточке ставится автоматически по дню создания новости.</div>

  <?php if ($msg): ?>
  <div class="adm-alert adm-alert-<?= $msgType ?> pixel"><?= htmlspecialchars($msg, ENT_QUOTES, 'UTF-8') ?></div>
  <?php endif; ?>

  <div class="adm-panel">
    <div class="adm-panel-header">
      <span class="pixel"><?= $editItem ? '✎ РЕДАКТИРОВАТЬ НОВОСТЬ' : '＋ ДОБАВИТЬ НОВОСТЬ' ?></span>
      <?php if ($editItem): ?>
      <a href="news.php" class="adm-link pixel">СБРОСИТЬ</a>
      <?php endif; ?>
    </div>

    <div style="padding:20px 24px;">
      <form method="POST" enctype="multipart/form-data">
        <input type="hidden" name="action" value="save"/>
        <input type="hidden" name="existing_id" value="<?= htmlspecialchars($editItem['id'] ?? '', ENT_QUOTES, 'UTF-8') ?>"/>

        <div class="adm-form-grid">
          <div class="adm-field">
            <label class="adm-label pixel">// СЛУЖЕБНЫЙ SLUG</label>
            <div class="adm-input-wrap">
              <input class="adm-input" type="text" name="slug" maxlength="40" placeholder="news-update" value="<?= htmlspecialchars($editItem['id'] ?? '', ENT_QUOTES, 'UTF-8') ?>"/>
            </div>
          </div>

          <div class="adm-field">
            <label class="adm-label pixel">// ЗАГОЛОВОК</label>
            <div class="adm-input-wrap">
              <input class="adm-input" type="text" name="title" maxlength="120" required value="<?= htmlspecialchars($editItem['title'] ?? '', ENT_QUOTES, 'UTF-8') ?>"/>
            </div>
          </div>

          <div class="adm-field" style="grid-column:1/-1">
            <label class="adm-label pixel">// ОПИСАНИЕ</label>
            <textarea class="adm-textarea" name="description" maxlength="600" required><?= htmlspecialchars($editItem['description'] ?? '', ENT_QUOTES, 'UTF-8') ?></textarea>
          </div>

          <div class="adm-field">
            <label class="adm-label pixel">// КАРТИНКА</label>
            <div class="adm-input-wrap">
              <input class="adm-input" type="file" name="image" accept=".png,.jpg,.jpeg,.webp,.gif"/>
            </div>
            <div class="adm-note pixel">Если файл не загружать при редактировании, останется текущая картинка.</div>
          </div>

          <div class="adm-field">
            <label class="adm-label pixel">// РАСПОЛОЖЕНИЕ КАРТИНКИ</label>
            <div class="adm-news-layout">
              <label class="adm-radio pixel">
                <input type="radio" name="layout" value="left" <?= (($editItem['layout'] ?? 'left') !== 'right') ? 'checked' : '' ?>/>
                СЛЕВА
              </label>
              <label class="adm-radio pixel">
                <input type="radio" name="layout" value="right" <?= (($editItem['layout'] ?? '') === 'right') ? 'checked' : '' ?>/>
                СПРАВА
              </label>
            </div>
          </div>
        </div>

        <button type="submit" class="adm-btn-primary pixel">[ СОХРАНИТЬ НОВОСТЬ ]</button>
      </form>
    </div>

    <?php if ($editItem && !empty($editItem['image'])): ?>
    <div class="adm-preview-card">
      <img src="../<?= htmlspecialchars($editItem['image'], ENT_QUOTES, 'UTF-8') ?>" alt="" class="adm-preview-media"/>
      <div class="adm-preview-meta">
        <div class="pixel"><?= htmlspecialchars($editItem['title'], ENT_QUOTES, 'UTF-8') ?></div>
        <div class="adm-note pixel">Текущее расположение картинки: <?= ($editItem['layout'] ?? 'left') === 'right' ? 'справа' : 'слева' ?></div>
      </div>
    </div>
    <?php endif; ?>
  </div>

  <div class="adm-panel" style="margin-top:20px">
    <div class="adm-panel-header">
      <span class="pixel">📰 АКТИВНЫЕ НОВОСТИ (<?= count($news) ?>/3)</span>
    </div>
    <table class="adm-table adm-table-full">
      <thead>
        <tr><th>#</th><th>КАРТИНКА</th><th>ЗАГОЛОВОК</th><th>СТОРОНА</th><th>ОБНОВЛЕНО</th><th>ДЕЙСТВИЯ</th></tr>
      </thead>
      <tbody>
        <?php foreach ($news as $index => $item): ?>
        <tr>
          <td class="pixel dim"><?= $index + 1 ?></td>
          <td>
            <?php if (!empty($item['image'])): ?>
            <img src="../<?= htmlspecialchars($item['image'], ENT_QUOTES, 'UTF-8') ?>" alt="" class="adm-user-avatar" style="width:72px;height:48px;border-radius:0;image-rendering:pixelated"/>
            <?php endif; ?>
          </td>
          <td class="pixel"><?= htmlspecialchars($item['title'] ?? '', ENT_QUOTES, 'UTF-8') ?></td>
          <td class="pixel dim"><?= (($item['layout'] ?? 'left') === 'right') ? 'СПРАВА' : 'СЛЕВА' ?></td>
          <td class="pixel dim"><?= htmlspecialchars(substr((string)($item['updated_at'] ?? ''), 0, 16), ENT_QUOTES, 'UTF-8') ?></td>
          <td class="adm-actions">
            <form method="POST" style="display:inline">
              <input type="hidden" name="action" value="move"/>
              <input type="hidden" name="direction" value="up"/>
              <input type="hidden" name="news_id" value="<?= htmlspecialchars((string)$item['id'], ENT_QUOTES, 'UTF-8') ?>"/>
              <button type="submit" class="adm-btn-sm adm-btn-warn pixel" <?= $index === 0 ? 'disabled' : '' ?> title="Поднять выше">↑</button>
            </form>
            <form method="POST" style="display:inline">
              <input type="hidden" name="action" value="move"/>
              <input type="hidden" name="direction" value="down"/>
              <input type="hidden" name="news_id" value="<?= htmlspecialchars((string)$item['id'], ENT_QUOTES, 'UTF-8') ?>"/>
              <button type="submit" class="adm-btn-sm adm-btn-warn pixel" <?= $index === count($news) - 1 ? 'disabled' : '' ?> title="Опустить ниже">↓</button>
            </form>
            <a href="news.php?edit=<?= urlencode((string)$item['id']) ?>" class="adm-btn pixel">РЕД.</a>
            <form method="POST" style="display:inline" onsubmit="return confirm('Удалить новость «<?= htmlspecialchars((string)($item['title'] ?? ''), ENT_QUOTES, 'UTF-8') ?>»?')">
              <input type="hidden" name="action" value="delete"/>
              <input type="hidden" name="news_id" value="<?= htmlspecialchars((string)$item['id'], ENT_QUOTES, 'UTF-8') ?>"/>
              <button type="submit" class="adm-btn-sm adm-btn-danger pixel">🗑</button>
            </form>
          </td>
        </tr>
        <?php endforeach; ?>
        <?php if (empty($news)): ?>
        <tr><td colspan="6" class="pixel dim" style="text-align:center">Новостей пока нет</td></tr>
        <?php endif; ?>
      </tbody>
    </table>
  </div>
</div>
</body>
</html>
