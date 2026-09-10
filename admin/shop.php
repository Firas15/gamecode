<?php
/**
 * ============================================================
 *  АДМИНКА: МАГАЗИН
 *
 *  Каталог лежит в таблице shop_items (миграция 003). Пока её
 *  нет, страница честно говорит об этом и ничего не делает:
 *  сам магазин в это время работает на списке из кода.
 *
 *  Что можно: добавлять аватары с загрузкой PNG и титулы с
 *  текстом, править названия и цены, менять порядок, снимать
 *  с продажи и возвращать обратно, удалять некупленное.
 *
 *  Чего нельзя намеренно:
 *    — делать платным то, что сейчас бесплатно (вещь исчезла бы
 *      у всех, кто её не покупал, а покупок и нет);
 *    — удалять купленное (человек заплатил);
 *    — трогать «пустые» варианты и аватар по умолчанию.
 * ============================================================
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/csrf.php';
require_once dirname(__DIR__) . '/includes/shop.php';
requireAdmin();

if (!defined('AVATAR_UPLOAD_DIR')) define('AVATAR_UPLOAD_DIR', dirname(__DIR__) . '/img/avatars');

/** Максимум для загружаемой картинки. */
const SHOP_PNG_MAX_BYTES = 2 * 1024 * 1024;
const SHOP_PNG_MIN_SIDE  = 32;
const SHOP_PNG_MAX_SIDE  = 1024;

/**
 * Имя файла и идентификатор товара делаем из названия: латиница,
 * цифры и дефис. Кириллицу транслитерируем — иначе после
 * urlencode получались бы нечитаемые «%D0%B0%D0%B2» в пути к
 * картинке.
 */
function shop_slug(string $text, int $maxLength = 24): string {
    $map = [
        'а'=>'a','б'=>'b','в'=>'v','г'=>'g','д'=>'d','е'=>'e','ё'=>'e','ж'=>'zh',
        'з'=>'z','и'=>'i','й'=>'y','к'=>'k','л'=>'l','м'=>'m','н'=>'n','о'=>'o',
        'п'=>'p','р'=>'r','с'=>'s','т'=>'t','у'=>'u','ф'=>'f','х'=>'h','ц'=>'c',
        'ч'=>'ch','ш'=>'sh','щ'=>'sch','ъ'=>'','ы'=>'y','ь'=>'','э'=>'e',
        'ю'=>'yu','я'=>'ya',
    ];
    $text = mb_strtolower(trim($text), 'UTF-8');
    $text = strtr($text, $map);
    $text = preg_replace('/[^a-z0-9]+/u', '-', $text) ?? '';
    $text = trim($text, '-');
    if ($text === '') $text = 'item';
    return substr($text, 0, $maxLength);
}

/** Свободный идентификатор: к базовому добавляем -2, -3 и так далее. */
function shop_unique_id(string $base): string {
    $base = substr($base, 0, 36);
    if (!gc_shop_item($base)) return $base;
    for ($n = 2; $n < 100; $n++) {
        $candidate = $base . '-' . $n;
        if (!gc_shop_item($candidate)) return $candidate;
    }
    return $base . '-' . bin2hex(random_bytes(2));
}

/** Свободное имя файла в img/avatars (без расширения). */
function shop_unique_avatar_file(string $base): string {
    $base = substr($base, 0, 36);
    if (!is_file(AVATAR_UPLOAD_DIR . '/' . $base . '.png')) return $base;
    for ($n = 2; $n < 100; $n++) {
        $candidate = $base . '-' . $n;
        if (!is_file(AVATAR_UPLOAD_DIR . '/' . $candidate . '.png')) return $candidate;
    }
    return $base . '-' . bin2hex(random_bytes(2));
}

/**
 * Проверка и сохранение загруженного PNG.
 *
 * Проверяем в три независимых слоя, потому что каждый по
 * отдельности обманывается:
 *   1. заявленный браузером тип не значит ничего;
 *   2. finfo смотрит на содержимое, но его можно подсунуть
 *      в начало файла, где дальше идёт что угодно;
 *   3. getimagesize разбирает заголовок картинки и заодно даёт
 *      размеры — по ним же требуем квадрат.
 * Плюс явная сверка первых восьми байт с сигнатурой PNG.
 *
 * Файл кладём с расширением .png под сгенерированным именем:
 * имя из браузера в путь не попадает вообще.
 *
 * @return array [имяФайлаБезРасширения, текстОшибки]
 */
function shop_store_png(array $file, string $baseName): array {
    $error = $file['error'] ?? UPLOAD_ERR_NO_FILE;

    if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
        return ['', 'Файл слишком большой для загрузки'];
    }
    if ($error !== UPLOAD_ERR_OK) {
        return ['', 'Не удалось загрузить файл (код ' . (int)$error . ')'];
    }

    $tmpName = (string)($file['tmp_name'] ?? '');
    if ($tmpName === '' || !is_uploaded_file($tmpName)) {
        return ['', 'Файл не получен'];
    }

    $size = (int)($file['size'] ?? 0);
    if ($size <= 0)                     return ['', 'Файл пустой'];
    if ($size > SHOP_PNG_MAX_BYTES)     return ['', 'PNG должен быть не больше 2 МБ (сейчас ' . round($size / 1024) . ' КБ)'];

    $handle = @fopen($tmpName, 'rb');
    $signature = $handle ? fread($handle, 8) : '';
    if ($handle) fclose($handle);
    if ($signature !== "\x89PNG\r\n\x1a\n") {
        return ['', 'Это не PNG. Нужен именно PNG — JPG и GIF не подойдут'];
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = $finfo ? finfo_file($finfo, $tmpName) : '';
    if ($finfo) finfo_close($finfo);
    if ($mime !== 'image/png') {
        return ['', 'Содержимое файла не похоже на PNG'];
    }

    $info = @getimagesize($tmpName);
    if (!is_array($info) || ($info[2] ?? 0) !== IMAGETYPE_PNG) {
        return ['', 'Картинку не удалось прочитать'];
    }

    $width  = (int)$info[0];
    $height = (int)$info[1];
    if ($width !== $height) {
        return ['', "Картинка должна быть квадратной, а она {$width}×{$height}. Обрежьте до квадрата и загрузите снова"];
    }
    if ($width < SHOP_PNG_MIN_SIDE || $width > SHOP_PNG_MAX_SIDE) {
        return ['', 'Сторона картинки должна быть от ' . SHOP_PNG_MIN_SIDE . ' до ' . SHOP_PNG_MAX_SIDE . ' пикселей, а она ' . $width];
    }

    if (!is_dir(AVATAR_UPLOAD_DIR) && !@mkdir(AVATAR_UPLOAD_DIR, 0755, true)) {
        return ['', 'Нет папки img/avatars и её не удалось создать'];
    }

    $fileName = shop_unique_avatar_file($baseName);
    $target = AVATAR_UPLOAD_DIR . '/' . $fileName . '.png';

    if (!move_uploaded_file($tmpName, $target)) {
        return ['', 'Не удалось сохранить файл на диск'];
    }
    @chmod($target, 0644);

    return [$fileName, ''];
}

/** Удаляем только то, что залито через админку, — свои картинки из репозитория не трогаем. */
function shop_remove_uploaded_png(string $fileName): void {
    if ($fileName === '' || strpos($fileName, 'custom-') !== 0) return;
    if (!preg_match('/^[a-z0-9-]+$/', $fileName)) return;

    $path = AVATAR_UPLOAD_DIR . '/' . $fileName . '.png';
    if (is_file($path)) @unlink($path);
}


/* ── ОБРАБОТКА ФОРМ ───────────────────────────────────────── */

$msg = '';
$msgType = 'success';
$tableReady = gc_shop_items_table_ready();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    admin_csrf_check();

    $action = (string)($_POST['action'] ?? '');
    $itemId = trim((string)($_POST['item_id'] ?? ''));

    if (!$tableReady) {
        $msg = 'Каталог ещё не в базе — прогоните db/migrations/003-shop-items.sql';
        $msgType = 'error';

    } elseif ($action === 'create') {
        $kind  = (string)($_POST['kind'] ?? '');
        $name  = trim((string)($_POST['name'] ?? ''));
        $price = (int)($_POST['price'] ?? 0);

        if (!in_array($kind, ['avatar', 'title'], true)) {
            $msg = 'Добавлять можно только аватары и титулы';
            $msgType = 'error';
        } elseif ($name === '') {
            $msg = 'Укажите название товара';
            $msgType = 'error';
        } else {
            $slug = shop_slug($name);
            $payload = '';
            $uploadError = '';

            if ($kind === 'avatar') {
                [$payload, $uploadError] = shop_store_png($_FILES['png'] ?? [], 'custom-' . $slug);
            } else {
                $payload = mb_strtoupper(trim((string)($_POST['text'] ?? '')), 'UTF-8');
                if ($payload === '') $uploadError = 'Укажите текст титула — он и будет виден под ником';
            }

            if ($uploadError !== '') {
                $msg = $uploadError;
                $msgType = 'error';
            } else {
                $newId = shop_unique_id($kind === 'avatar' ? $payload : 'title_' . $slug);

                // Новый товар встаёт в конец своего раздела.
                $existing = gc_shop_by_kind($kind);
                $lastOrder = 0;
                foreach ($existing as $row) {
                    $lastOrder = max($lastOrder, (int)($row['sort_order'] ?? 0));
                }

                $res = gc_shop_admin_save([
                    'id'         => $newId,
                    'kind'       => $kind,
                    'name'       => $name,
                    'price'      => $price,
                    'payload'    => $payload,
                    'sort_order' => $lastOrder + 10,
                    'is_free'    => $price === 0,
                    'hidden'     => false,
                ], true);

                if (!empty($res['ok'])) {
                    writeLog('Магазин: добавлен товар', $name . ' (' . $newId . ')');
                    $msg = 'Товар «' . $name . '» добавлен';
                } else {
                    if ($kind === 'avatar') shop_remove_uploaded_png($payload);
                    $msg = (string)($res['error'] ?? 'Не удалось добавить товар');
                    $msgType = 'error';
                }
            }
        }

    } elseif ($action === 'save') {
        $item = gc_shop_item($itemId);
        if (!$item) {
            $msg = 'Товар не найден';
            $msgType = 'error';
        } else {
            $kind = (string)$item['kind'];
            $payloadKey = GC_SHOP_PAYLOAD_KEY[$kind] ?? 'payload';
            $payload = (string)($item[$payloadKey] ?? '');
            $uploadError = '';

            // Титулу можно переписать текст, аватару — заменить картинку.
            // Класс рамки и папку скина из админки не правим: они завязаны
            // на CSS и на файлы игры, опечатка тут ломает вид молча.
            if ($kind === 'title') {
                $payload = mb_strtoupper(trim((string)($_POST['text'] ?? '')), 'UTF-8');
            }

            $replaced = '';
            if ($kind === 'avatar' && !empty($_FILES['png']['name'])) {
                [$newFile, $uploadError] = shop_store_png($_FILES['png'], 'custom-' . shop_slug((string)($_POST['name'] ?? $item['name'])));
                if ($uploadError === '') {
                    $replaced = $payload;
                    $payload = $newFile;
                }
            }

            if ($uploadError !== '') {
                $msg = $uploadError;
                $msgType = 'error';
            } else {
                $res = gc_shop_admin_save([
                    'id'         => $itemId,
                    'kind'       => $kind,
                    'name'       => trim((string)($_POST['name'] ?? $item['name'])),
                    'price'      => (int)($_POST['price'] ?? $item['price']),
                    'payload'    => $payload,
                    'sort_order' => (int)($item['sort_order'] ?? 0),
                    'is_free'    => !empty($item['free']),
                    'hidden'     => !empty($item['hidden']),
                ], false);

                if (!empty($res['ok'])) {
                    // Старая картинка нужна была только этому товару:
                    // аватар игрока хранится именем файла, а оно
                    // обновится вместе с каталогом.
                    if ($replaced !== '' && $replaced !== $payload) {
                        gamecode_pg_exec(
                            'UPDATE users SET avatar_emoji = $2 WHERE avatar_emoji = $1',
                            [$replaced, $payload]
                        );
                        shop_remove_uploaded_png($replaced);
                    }
                    writeLog('Магазин: изменён товар', $itemId);
                    $msg = 'Сохранено';
                } else {
                    if ($replaced !== '') shop_remove_uploaded_png($payload);
                    $msg = (string)($res['error'] ?? 'Не удалось сохранить');
                    $msgType = 'error';
                }
            }
        }

    } elseif ($action === 'toggle') {
        $hide = ($_POST['hide'] ?? '') === '1';
        $res = gc_shop_admin_set_hidden($itemId, $hide);
        if (!empty($res['ok'])) {
            writeLog($hide ? 'Магазин: товар снят с продажи' : 'Магазин: товар вернулся в продажу', $itemId);
            $msg = $hide ? 'Товар снят с продажи' : 'Товар снова в продаже';
        } else {
            $msg = (string)($res['error'] ?? 'Не удалось изменить статус');
            $msgType = 'error';
        }

    } elseif ($action === 'move') {
        $direction = ($_POST['direction'] ?? '') === 'up' ? 'up' : 'down';
        $res = gc_shop_admin_move($itemId, $direction);
        if (empty($res['ok'])) {
            $msg = (string)($res['error'] ?? 'Не удалось изменить порядок');
            $msgType = 'error';
        }

    } elseif ($action === 'delete') {
        $item = gc_shop_item($itemId);
        $res = gc_shop_admin_delete($itemId);
        if (!empty($res['ok'])) {
            if ($item && ($item['kind'] ?? '') === 'avatar') {
                shop_remove_uploaded_png((string)($item['file'] ?? ''));
            }
            writeLog('Магазин: удалён товар', $itemId);
            $msg = 'Товар удалён';
        } else {
            $msg = (string)($res['error'] ?? 'Не удалось удалить');
            $msgType = 'error';
        }
    }

    // Каталог кэшируется на время запроса, а мы его только что
    // изменили: перезагружаем страницу, чтобы список пришёл свежим.
    if ($msgType === 'success') {
        $_SESSION['gc_shop_msg'] = $msg;
        header('Location: shop.php');
        exit;
    }
}

if (!empty($_SESSION['gc_shop_msg'])) {
    $msg = (string)$_SESSION['gc_shop_msg'];
    $msgType = 'success';
    unset($_SESSION['gc_shop_msg']);
}

$sections = [
    'avatar' => ['title' => 'АВАТАРЫ',          'hint' => 'Картинка профиля. Добавляются загрузкой квадратного PNG.'],
    'title'  => ['title' => 'ТИТУЛЫ',           'hint' => 'Подпись под ником в профиле и таблице лидеров.'],
    'frame'  => ['title' => 'РАМКИ',            'hint' => 'Рамка вокруг аватара. Рисуется стилями, новые заводятся в css/shop.css — здесь можно менять название, цену и порядок.'],
    'skin'   => ['title' => 'СКИНЫ CODEQUEST',  'hint' => 'Персонаж в игре. Спрайты лежат в файлах игры — здесь можно менять название, цену и порядок.'],
];

$purchases = gc_shop_purchase_counts();
$coinIcon = '../img/pixel_coin.png';
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Магазин — Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('admin.css', 'admin/admin.css'), ENT_QUOTES, 'UTF-8') ?>"/>
  <!-- Стили рамок берём те же, что на сайте: превью в админке
       должно выглядеть ровно так, как увидит игрок. -->
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('../css/shop.css', 'css/shop.css'), ENT_QUOTES, 'UTF-8') ?>"/>
</head>
<body>
<?php include __DIR__ . '/sidebar.php'; ?>
<div class="adm-main">
  <div class="adm-topbar">
    <h1 class="adm-page-title pixel">// МАГАЗИН</h1>
    <a href="logout.php" class="adm-btn-danger pixel">[ ВЫЙТИ ]</a>
  </div>

  <?php if (!$tableReady): ?>
    <div class="adm-alert adm-alert-error pixel">
      Каталог ещё не в базе. Прогоните db/migrations/003-shop-items.sql — до этого магазин работает на списке из кода, а эта страница ничего не сохранит.
    </div>
  <?php endif; ?>

  <div class="adm-hint pixel">
    Бесплатное остаётся бесплатным: цену на него поставить нельзя, иначе вещь пропадёт у всех, кто её не покупал. Купленный товар не удаляется — его можно только снять с продажи, и у владельцев он продолжит работать.
  </div>

  <?php if ($msg): ?>
  <div class="adm-alert adm-alert-<?= $msgType === 'error' ? 'error' : 'success' ?> pixel"><?= htmlspecialchars($msg, ENT_QUOTES, 'UTF-8') ?></div>
  <?php endif; ?>

  <!-- ДОБАВЛЕНИЕ -->
  <div class="adm-two-col">
    <div class="adm-panel">
      <div class="adm-panel-header"><span class="pixel">＋ НОВЫЙ АВАТАР</span></div>
      <div style="padding:20px 24px;">
        <form method="POST" enctype="multipart/form-data">
          <?= admin_csrf_field() ?>
          <input type="hidden" name="action" value="create"/>
          <input type="hidden" name="kind" value="avatar"/>

          <div class="adm-field">
            <label class="adm-label pixel">// НАЗВАНИЕ</label>
            <div class="adm-input-wrap">
              <span class="adm-ico">🏷</span>
              <input class="adm-input" type="text" name="name" maxlength="80" required placeholder="Например: Неоновый кот"/>
            </div>
          </div>

          <div class="adm-field">
            <label class="adm-label pixel">// ЦЕНА В ПИКСЕЛЬ КОИНАХ</label>
            <div class="adm-input-wrap">
              <span class="adm-ico"><img class="adm-coin" src="<?= $coinIcon ?>" alt=""/></span>
              <input class="adm-input" type="number" name="price" min="0" max="100000" value="100"/>
            </div>
          </div>

          <div class="adm-field">
            <label class="adm-label pixel">// КАРТИНКА PNG</label>
            <div class="adm-input-wrap">
              <span class="adm-ico">🖼</span>
              <input class="adm-input" type="file" name="png" accept="image/png" required/>
            </div>
            <div class="adm-file-note pixel">Квадратный PNG, сторона от 32 до 1024 пикселей, до 2 МБ. Для пиксель-арта лучше всего 128×128 или 256×256 — картинка везде показывается без сглаживания.</div>
          </div>

          <button type="submit" class="adm-btn-primary pixel" <?= $tableReady ? '' : 'disabled' ?>>[ ДОБАВИТЬ ]</button>
        </form>
      </div>
    </div>

    <div class="adm-panel">
      <div class="adm-panel-header"><span class="pixel">＋ НОВЫЙ ТИТУЛ</span></div>
      <div style="padding:20px 24px;">
        <form method="POST">
          <?= admin_csrf_field() ?>
          <input type="hidden" name="action" value="create"/>
          <input type="hidden" name="kind" value="title"/>

          <div class="adm-field">
            <label class="adm-label pixel">// НАЗВАНИЕ В МАГАЗИНЕ</label>
            <div class="adm-input-wrap">
              <span class="adm-ico">🏷</span>
              <input class="adm-input" type="text" name="name" maxlength="80" required placeholder="Например: Ветеран"/>
            </div>
          </div>

          <div class="adm-field">
            <label class="adm-label pixel">// ТЕКСТ ПОД НИКОМ</label>
            <div class="adm-input-wrap">
              <span class="adm-ico">✦</span>
              <input class="adm-input" type="text" name="text" maxlength="40" required placeholder="ВЕТЕРАН"/>
            </div>
            <div class="adm-file-note pixel">Пишется заглавными автоматически. Короткий текст читается лучше: в таблице лидеров места мало.</div>
          </div>

          <div class="adm-field">
            <label class="adm-label pixel">// ЦЕНА В ПИКСЕЛЬ КОИНАХ</label>
            <div class="adm-input-wrap">
              <span class="adm-ico"><img class="adm-coin" src="<?= $coinIcon ?>" alt=""/></span>
              <input class="adm-input" type="number" name="price" min="0" max="100000" value="100"/>
            </div>
          </div>

          <button type="submit" class="adm-btn-primary pixel" <?= $tableReady ? '' : 'disabled' ?>>[ ДОБАВИТЬ ]</button>
        </form>
      </div>
    </div>
  </div>

  <!-- РАЗДЕЛЫ -->
  <?php foreach ($sections as $kind => $section):
      $items = gc_shop_by_kind($kind);
      $sample = 'avatar1';
      foreach (gc_shop_by_kind('avatar') as $a) { $sample = (string)$a['file']; break; }
  ?>
  <div class="adm-panel">
    <div class="adm-panel-header">
      <span class="pixel"><?= $section['title'] ?></span>
      <span class="adm-link pixel"><?= count($items) ?> шт.</span>
    </div>
    <div class="adm-hint pixel" style="margin:0;border-top:none;"><?= htmlspecialchars($section['hint'], ENT_QUOTES, 'UTF-8') ?></div>

    <table class="adm-table adm-table-full">
      <thead>
        <tr>
          <th class="pixel">ВИД</th>
          <!-- Название, текст титула и цена правятся одной формой,
               поэтому и заголовок у них общий на две колонки. -->
          <th class="pixel" colspan="2">НАЗВАНИЕ И ЦЕНА</th>
          <th class="pixel">КУПЛЕН</th>
          <th class="pixel">СТАТУС</th>
          <th class="pixel">ДЕЙСТВИЯ</th>
        </tr>
      </thead>
      <tbody>
      <?php foreach ($items as $index => $item):
          $id        = (string)$item['id'];
          $isFree    = gc_shop_is_free($item);
          $isHidden  = !empty($item['hidden']);
          $protected = gc_shop_is_protected($id);
          $bought    = (int)($purchases[$id] ?? 0);
          $canEditText = $kind === 'title' && !$protected;
      ?>
        <tr class="<?= $isHidden ? 'row-hidden' : '' ?>">
          <td>
            <div class="adm-shop-preview">
              <?php if ($kind === 'avatar'): ?>
                <img src="../img/avatars/<?= htmlspecialchars((string)$item['file'], ENT_QUOTES, 'UTF-8') ?>.png"
                     alt="" onerror="this.classList.add('is-missing')"/>
              <?php elseif ($kind === 'frame'): ?>
                <span class="gc-frame <?= htmlspecialchars((string)($item['css'] ?? ''), ENT_QUOTES, 'UTF-8') ?>">
                  <img src="../img/avatars/<?= htmlspecialchars($sample, ENT_QUOTES, 'UTF-8') ?>.png" alt="" style="width:34px;height:34px"/>
                </span>
              <?php elseif ($kind === 'title'): ?>
                <?php if ((string)($item['text'] ?? '') === ''): ?>
                  <span class="adm-shop-empty pixel">— пусто —</span>
                <?php else: ?>
                  <span class="gc-title-tag gc-title-tag--sm"><?= htmlspecialchars((string)$item['text'], ENT_QUOTES, 'UTF-8') ?></span>
                <?php endif; ?>
              <?php else: ?>
                <?php $dir = (string)($item['dir'] ?? ''); ?>
                <img src="../games/pixelgame/assets/player/<?= $dir !== '' ? htmlspecialchars($dir, ENT_QUOTES, 'UTF-8') . '/' : '' ?>preview.png"
                     alt="" onerror="this.classList.add('is-missing')"/>
              <?php endif; ?>
            </div>
          </td>

          <!-- Название, цена и текст титула правятся одной формой на строку -->
          <td colspan="2">
            <form method="POST" enctype="multipart/form-data" class="adm-shop-row-form">
              <?= admin_csrf_field() ?>
              <input type="hidden" name="action" value="save"/>
              <input type="hidden" name="item_id" value="<?= htmlspecialchars($id, ENT_QUOTES, 'UTF-8') ?>"/>

              <input class="adm-inline-input" type="text" name="name" maxlength="80"
                     value="<?= htmlspecialchars((string)$item['name'], ENT_QUOTES, 'UTF-8') ?>"/>

              <?php if ($canEditText): ?>
              <input class="adm-inline-input adm-inline-input--text" type="text" name="text" maxlength="40"
                     value="<?= htmlspecialchars((string)($item['text'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
                     title="Текст под ником"/>
              <?php endif; ?>

              <span class="adm-inline-price">
                <img class="adm-coin" src="<?= $coinIcon ?>" alt=""/>
                <input class="adm-inline-input adm-inline-input--num" type="number" name="price" min="0" max="100000"
                       value="<?= (int)$item['price'] ?>" <?= $isFree ? 'disabled title="Бесплатное остаётся бесплатным"' : '' ?>/>
              </span>

              <?php if ($kind === 'avatar' && !$protected): ?>
              <label class="adm-inline-file pixel" title="Заменить картинку">
                🖼<input type="file" name="png" accept="image/png"/>
              </label>
              <?php endif; ?>

              <button type="submit" class="adm-btn-sm adm-btn-save" title="Сохранить название и цену">💾</button>
            </form>
          </td>

          <td class="pixel"><?= $bought > 0 ? $bought : '—' ?></td>

          <td>
            <?php if ($isFree): ?>
              <span class="adm-badge active pixel">БЕСПЛАТНО</span>
            <?php elseif ($isHidden): ?>
              <span class="adm-badge wip pixel">СНЯТ</span>
            <?php else: ?>
              <span class="adm-badge active pixel">В ПРОДАЖЕ</span>
            <?php endif; ?>
          </td>

          <td>
            <div class="adm-actions">
              <form method="POST" style="display:inline">
                <?= admin_csrf_field() ?>
                <input type="hidden" name="action" value="move"/>
                <input type="hidden" name="direction" value="up"/>
                <input type="hidden" name="item_id" value="<?= htmlspecialchars($id, ENT_QUOTES, 'UTF-8') ?>"/>
                <button type="submit" class="adm-btn-sm" <?= $index === 0 ? 'disabled' : '' ?> title="Поднять выше">↑</button>
              </form>

              <form method="POST" style="display:inline">
                <?= admin_csrf_field() ?>
                <input type="hidden" name="action" value="move"/>
                <input type="hidden" name="direction" value="down"/>
                <input type="hidden" name="item_id" value="<?= htmlspecialchars($id, ENT_QUOTES, 'UTF-8') ?>"/>
                <button type="submit" class="adm-btn-sm" <?= $index === count($items) - 1 ? 'disabled' : '' ?> title="Опустить ниже">↓</button>
              </form>

              <form method="POST" style="display:inline">
                <?= admin_csrf_field() ?>
                <input type="hidden" name="action" value="toggle"/>
                <input type="hidden" name="hide" value="<?= $isHidden ? '0' : '1' ?>"/>
                <input type="hidden" name="item_id" value="<?= htmlspecialchars($id, ENT_QUOTES, 'UTF-8') ?>"/>
                <button type="submit" class="adm-btn-sm adm-btn-warn pixel" <?= $protected ? 'disabled' : '' ?>
                        title="<?= $isHidden ? 'Вернуть в продажу' : 'Снять с продажи' ?>"><?= $isHidden ? '👁' : '🚫' ?></button>
              </form>

              <form method="POST" style="display:inline"
                    onsubmit="return confirm('Удалить товар «<?= htmlspecialchars((string)$item['name'], ENT_QUOTES, 'UTF-8') ?>»?')">
                <?= admin_csrf_field() ?>
                <input type="hidden" name="action" value="delete"/>
                <input type="hidden" name="item_id" value="<?= htmlspecialchars($id, ENT_QUOTES, 'UTF-8') ?>"/>
                <button type="submit" class="adm-btn-sm adm-btn-danger pixel"
                        <?= ($protected || $bought > 0) ? 'disabled title="Купленное и служебное не удаляется — снимите с продажи"' : 'title="Удалить"' ?>>🗑</button>
              </form>
            </div>
          </td>
        </tr>
      <?php endforeach; ?>
      <?php if (empty($items)): ?>
        <tr><td colspan="6" class="pixel" style="text-align:center;padding:24px;opacity:.6">Пусто</td></tr>
      <?php endif; ?>
      </tbody>
    </table>
  </div>
  <?php endforeach; ?>

</div>
</body>
</html>
