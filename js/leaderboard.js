/**
 * GAME CODE — Leaderboard Utilities
 * Подключается в каждой игре. Предоставляет:
 *   submitScore(gameId, payload)   — отправить результат на сервер (очки считает сервер)
 *   renderLeaderboard(el, gameId, limit) — отрисовать виджет топа в меню
 */

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
        // тихо игнорируем
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
        return data;
    } catch {
        return null;
    }
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
