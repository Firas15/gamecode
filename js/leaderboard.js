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

        return data;
    } catch {
        return null;
    }
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

    const rows = data.rows.map(r => `
        <div class="lb-row ${r.rank <= 3 ? 'lb-top' : ''}">
            <span class="lb-rank">${r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : '#' + r.rank}</span>
            <span class="lb-avatar"><img src="${LB_ROOT}img/avatars/${r.avatar_emoji || 'avatar1'}.png" alt="аватар" class="avatar-img avatar-img--sm"/></span>
            <span class="lb-nick">${escHtml(r.nickname)}</span>
            <span class="lb-score">${r.score.toLocaleString('ru-RU')}</span>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="lb-title">// ТОП ИГРОКОВ</div>
        <div class="lb-list">${rows}</div>
    `;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
