// Определяем корень сайта относительно текущего файла (игры лежат в games/xxx/)
const LB_ROOT = '../../';

/**
 * Пингует сервер при старте игры — увеличивает счётчик games_played.
 * Вызывать в начале каждого startLevel / btn-play.
 * @param {string} gameId  — 'sorter' | 'network' | 'millionaire'
 */
async function pingGame(gameId) {
    try {
        const res = await fetch(LB_ROOT + 'api/ping-game.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game_id: gameId }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data || data.ok !== true || !data.run_id || !data.run_token) return;
        sessionStorage.setItem(`gc_run_${gameId}`, JSON.stringify({
            run_id: data.run_id,
            run_token: data.run_token,
            started_at: data.started_at,
        }));
    } catch {
    }
}

/**
 * Отправляет очки на сервер.
 * Тихо игнорирует ошибки — игровой процесс не прерывается.
 * @param {string} gameId  — 'sorter' | 'network' | 'millionaire'
 * @param {object} payload — данные результата (очки считает сервер)
 * @returns {Promise<{saved: boolean, is_record: boolean}|null>}
 */
async function submitScore(gameId, payload) {
    try {
        const runRaw = sessionStorage.getItem(`gc_run_${gameId}`);
        const run = runRaw ? JSON.parse(runRaw) : null;
        if (!run || !run.run_id || !run.run_token) return null;

        const res = await fetch(LB_ROOT + 'api/score.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                game_id: gameId,
                run_id: run.run_id,
                run_token: run.run_token,
                payload: payload || {},
            }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || data.ok !== true) return null;
        // одноразовый run — очищаем
        sessionStorage.removeItem(`gc_run_${gameId}`);

        // Гость: сервер отложил результат до регистрации. Показываем окно
        // с задержкой, чтобы человек успел увидеть свой экран с очками.
        // При нуле очков не показываем — предлагать сохранить 0 незачем.
        if (data.pending === true && Number(data.score) > 0) {
            setTimeout(() => showGuestSavePrompt(Number(data.score)), 1400);
        }

        // Заработок за партию. Число приходит с сервера — он его и начислил.
        if (Number(data.coins_earned) > 0) {
            setTimeout(() => showCoinReward(Number(data.coins_earned), Number(data.coins)), 700);
        }

        return data;
    } catch {
        return null;
    }
}

/* ============================================================
   ПЛАШКА «+N ПИКСЕЛЬ КОИНОВ» В КОНЦЕ ПАРТИИ

   Тоже общая для всех четырёх игр: экраны результатов у них
   разные, а плашка одна — рисуется поверх, поэтому ни один
   game.js и ни одну вёрстку трогать не пришлось.

   Стили инжектим из JS: страницы игр не подключают ни shop.css,
   ни auth.css, и рассчитывать там на классы сайта нельзя.
   ============================================================ */

const GC_COIN_TOAST_ID = 'gcCoinReward';

function gcInjectCoinStyles() {
    if (document.getElementById('gcCoinRewardStyles')) return;
    const css = document.createElement('style');
    css.id = 'gcCoinRewardStyles';
    css.textContent = `
    #${GC_COIN_TOAST_ID}{
        position:fixed;left:50%;top:26px;transform:translate(-50%,-16px);
        z-index:10000;display:flex;align-items:center;gap:12px;
        padding:14px 20px;
        background:#0d1626;border:2px solid #f5d800;
        box-shadow:0 0 26px rgba(245,216,0,.28);
        font-family:'Press Start 2P',monospace;
        opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;
    }
    #${GC_COIN_TOAST_ID}.gc-on{opacity:1;transform:translate(-50%,0)}
    #${GC_COIN_TOAST_ID} .gc-cr-img{width:34px;height:34px;display:block;flex-shrink:0}
    #${GC_COIN_TOAST_ID} .gc-cr-plus{font-size:20px;color:#f5d800;line-height:1}
    #${GC_COIN_TOAST_ID} .gc-cr-txt{font-size:8px;line-height:2;color:#8aa2c0;letter-spacing:1px}
    #${GC_COIN_TOAST_ID} .gc-cr-total{color:#f5d800}
    @media (max-width:480px){
        #${GC_COIN_TOAST_ID}{padding:11px 14px;gap:9px;max-width:92vw}
        #${GC_COIN_TOAST_ID} .gc-cr-img{width:26px;height:26px}
        #${GC_COIN_TOAST_ID} .gc-cr-plus{font-size:16px}
        #${GC_COIN_TOAST_ID} .gc-cr-txt{font-size:7px}
    }
    @media (prefers-reduced-motion:reduce){
        #${GC_COIN_TOAST_ID}{transition:none}
    }`;
    document.head.appendChild(css);
}

/**
 * @param {number} earned — начислено за эту партию
 * @param {number} total  — баланс после начисления (может прийти пустым)
 */
function showCoinReward(earned, total) {
    gcInjectCoinStyles();

    document.getElementById(GC_COIN_TOAST_ID)?.remove();

    const box = document.createElement('div');
    box.id = GC_COIN_TOAST_ID;
    box.innerHTML =
        `<img class="gc-cr-img" src="${LB_ROOT}img/pixel_coin.png" alt=""/>` +
        `<span class="gc-cr-plus">+${earned}</span>` +
        `<span class="gc-cr-txt">ПИКСЕЛЬ КОИНОВ` +
        (Number.isFinite(total) && total > 0
            ? `<br>всего: <span class="gc-cr-total">${total}</span></span>`
            : `</span>`);
    document.body.appendChild(box);

    requestAnimationFrame(() => box.classList.add('gc-on'));
    setTimeout(() => {
        box.classList.remove('gc-on');
        setTimeout(() => box.remove(), 400);
    }, 4000);
}

/* ============================================================
   ОКНО «СОХРАНИ РЕЗУЛЬТАТ» ДЛЯ ГОСТЯ

   Живёт здесь, а не в коде игр: leaderboard.js подключён во всех
   четырёх играх, поэтому окно работает везде и на всех уровнях
   без единой правки в их game.js.

   Очки сюда приходят с сервера — он их посчитал и проверил.
   Браузер только показывает число и никак на сохраняемое значение
   не влияет.
   ============================================================ */

const GC_GUEST_MODAL_ID = 'gcGuestSaveModal';

function gcInjectGuestModalStyles() {
    if (document.getElementById('gcGuestSaveStyles')) return;
    const css = document.createElement('style');
    css.id = 'gcGuestSaveStyles';
    css.textContent = `
    .gc-guest-overlay{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;
        justify-content:center;padding:20px;background:rgba(0,0,0,.85);backdrop-filter:blur(6px);
        opacity:0;transition:opacity .25s}
    .gc-guest-overlay.is-open{opacity:1}
    .gc-guest-box{position:relative;width:100%;max-width:440px;background:#0d1626;
        border:1px solid #2a5fbf;padding:28px 24px;text-align:center;
        transform:translateY(12px);transition:transform .25s}
    .gc-guest-overlay.is-open .gc-guest-box{transform:none}
    .gc-guest-box::before{content:'';position:absolute;top:0;left:0;width:100%;height:3px;
        background:linear-gradient(90deg,#f5d800,#00e5ff)}
    .gc-guest-title{font-family:'Press Start 2P',monospace;font-size:13px;letter-spacing:2px;
        color:#fff;line-height:1.7;margin-bottom:18px}
    .gc-guest-score{font-family:'Press Start 2P',monospace;font-size:30px;color:#f5d800;
        text-shadow:0 0 18px rgba(245,216,0,.45);margin-bottom:6px}
    .gc-guest-score-label{font-family:'Press Start 2P',monospace;font-size:8px;
        letter-spacing:2px;color:#5a7a9a;margin-bottom:22px}
    /* Пиксельный шрифт широкий и без строчных пропорций — кегль мельче,
       межстрочный интервал больше, иначе текст не читается. */
    .gc-guest-text{font-family:'Press Start 2P',monospace;font-size:10px;line-height:2;
        color:#c8d8f0;margin-bottom:14px}
    .gc-guest-warn{font-family:'Press Start 2P',monospace;font-size:9px;line-height:2;
        color:#ff4d6d;margin-bottom:24px}
    .gc-guest-actions{display:flex;flex-direction:column;gap:10px}
    .gc-guest-btn{font-family:'Press Start 2P',monospace;font-size:10px;letter-spacing:1px;
        padding:14px 12px;min-height:44px;cursor:pointer;transition:all .2s;
        border:1px solid #2a5fbf;background:transparent;color:#c8d8f0}
    .gc-guest-btn:hover{border-color:#00e5ff;color:#00e5ff}
    .gc-guest-btn--main{background:rgba(57,255,20,.1);border-color:#39ff14;color:#39ff14}
    .gc-guest-btn--main:hover{background:rgba(57,255,20,.2);border-color:#39ff14;color:#39ff14}
    .gc-guest-btn--ghost{border-color:transparent;color:#5a7a9a;font-size:9px}
    .gc-guest-btn--ghost:hover{color:#c8d8f0;border-color:transparent}
    @media (max-width:480px){
        .gc-guest-box{padding:22px 16px}
        .gc-guest-title{font-size:10px}
        .gc-guest-score{font-size:24px}
        .gc-guest-score-label{font-size:7px}
        .gc-guest-text{font-size:9px;line-height:1.9}
        .gc-guest-warn{font-size:8px;line-height:1.9}
        .gc-guest-btn{font-size:8px}
    }`;
    document.head.appendChild(css);
}

function gcCloseGuestModal() {
    const el = document.getElementById(GC_GUEST_MODAL_ID);
    if (!el) return;
    el.classList.remove('is-open');
    setTimeout(() => el.remove(), 250);
}

/**
 * Показывает гостю предложение сохранить результат.
 * @param {number} score — очки, посчитанные сервером
 */
function showGuestSavePrompt(score) {
    if (document.getElementById(GC_GUEST_MODAL_ID)) return;
    gcInjectGuestModalStyles();

    const overlay = document.createElement('div');
    overlay.id = GC_GUEST_MODAL_ID;
    overlay.className = 'gc-guest-overlay';
    overlay.innerHTML = `
      <div class="gc-guest-box" role="dialog" aria-modal="true" aria-labelledby="gcGuestTitle">
        <div class="gc-guest-title" id="gcGuestTitle">[ РЕЗУЛЬТАТ НЕ СОХРАНЁН ]</div>
        <div class="gc-guest-score">${Number(score).toLocaleString('ru-RU')}</div>
        <div class="gc-guest-score-label">очков за эту игру</div>
        <div class="gc-guest-text">Заведи аккаунт — очки запишутся на него, и ты попадёшь в таблицу лидеров.</div>
        <div class="gc-guest-warn">Откажешься — очки пропадут.</div>
        <div class="gc-guest-actions">
          <button type="button" class="gc-guest-btn gc-guest-btn--main" id="gcGuestRegister">[ ЗАРЕГИСТРИРОВАТЬСЯ ]</button>
          <button type="button" class="gc-guest-btn" id="gcGuestLogin">[ У МЕНЯ УЖЕ ЕСТЬ АККАУНТ ]</button>
          <button type="button" class="gc-guest-btn gc-guest-btn--ghost" id="gcGuestLater">не сейчас</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));

    overlay.querySelector('#gcGuestRegister').addEventListener('click', () => {
        window.location.href = LB_ROOT + 'pages/register.php';
    });
    overlay.querySelector('#gcGuestLogin').addEventListener('click', () => {
        window.location.href = LB_ROOT + 'pages/login.php';
    });
    overlay.querySelector('#gcGuestLater').addEventListener('click', gcCloseGuestModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) gcCloseGuestModal(); });
    document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { gcCloseGuestModal(); document.removeEventListener('keydown', esc); }
    });
}

/**
 * Загружает и отрисовывает виджет таблицы лидеров в указанный DOM-элемент.
 * @param {HTMLElement} container
 * @param {string} gameId  — 'sorter' | 'network' | 'millionaire'
 * @param {number} limit   — количество строк (по умолчанию 5)
 */
async function renderLeaderboard(container, gameId, limit = 5) {
    container.innerHTML = '<div class="lb-loading">загрузка...</div>';

    let data;
    try {
        const res = await fetch(`${LB_ROOT}api/leaderboard.php?game=${gameId}&limit=${limit}`, {
            credentials: 'same-origin',
            cache: 'no-store',
        });
        data = await res.json();
    } catch {
        container.innerHTML = '<div class="lb-error">нет соединения с сервером</div>';
        return;
    }

    if (!data.ok || !data.rows.length) {
        container.innerHTML = '<div class="lb-empty">// ещё никто не играл — будь первым!</div>';
        return;
    }

    // Рамка и титул приходят из магазина. Класс рамки сервер отдаёт
    // из своего каталога, но в разметку он всё равно идёт через
    // белый список: строка из ответа не должна становиться атрибутом
    // как есть, даже если ответ свой.
    const FRAME_CLASSES = [
        'gc-frame--cyan', 'gc-frame--green', 'gc-frame--pink', 'gc-frame--gold',
        'gc-frame--dashed', 'gc-frame--glitch', 'gc-frame--rgb',
    ];
    const frameClass = css => (FRAME_CLASSES.includes(css) ? css : '');

    const rows = data.rows.map(r => {
        const fc = frameClass(r.frame_css || '');
        const avatar = `<img src="${LB_ROOT}img/avatars/${escHtml(r.avatar_emoji || 'avatar1')}.png" alt="аватар" class="avatar-img avatar-img--sm"/>`;
        // Свой класс, а не gc-title-tag из shop.css: страницы игр его
        // не подключают, поэтому титул в виджете выходил голым текстом
        // и слипался с ником. lb-title живёт в leaderboard.css, который
        // подключён во всех четырёх играх.
        const title = r.title_text
            ? `<span class="lb-title">${escHtml(r.title_text)}</span>`
            : '';
        // Ник и аватар ведут в профиль игрока. id приходит из API;
        // если по какой-то причине его нет — оставляем просто текст,
        // чтобы не получить ссылку в никуда.
        const pid = Number(r.id) || 0;
        const openTag = pid ? `<a class="lb-profile-link" href="${LB_ROOT}pages/profile.php?id=${pid}" title="Профиль игрока">` : '';
        const closeTag = pid ? '</a>' : '';

        return `
        <div class="lb-row ${r.rank <= 3 ? 'lb-top' : ''}">
            <span class="lb-rank">${r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : '#' + r.rank}</span>
            <span class="lb-avatar">${openTag}${fc ? `<span class="gc-frame ${fc}">${avatar}</span>` : avatar}${closeTag}</span>
            <span class="lb-nick"><span class="lb-nick-name">${openTag}${escHtml(r.nickname)}${closeTag}</span>${title}</span>
            <span class="lb-score">${r.score.toLocaleString('ru-RU')}</span>
        </div>`;
    }).join('');

    gcInjectProfileLinkStyles();
    container.innerHTML = `
        <div class="lb-title">// ТОП ИГРОКОВ</div>
        <div class="lb-list">${rows}</div>
    `;
}

/** Подчёркивание при наведении — иначе неочевидно, что ник кликается. */
function gcInjectProfileLinkStyles() {
    if (document.getElementById('gcProfileLinkStyles')) return;
    const css = document.createElement('style');
    css.id = 'gcProfileLinkStyles';
    css.textContent = `
    .lb-profile-link{color:inherit;text-decoration:none;cursor:pointer}
    .lb-profile-link:hover{color:#00e5ff;text-decoration:underline}`;
    document.head.appendChild(css);
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
