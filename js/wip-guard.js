(() => {
  function detectGameId() {
    const fromAttr = document.documentElement.getAttribute("data-game-id");
    if (fromAttr) return fromAttr;

    const m = window.location.pathname.match(/\/games\/([^/]+)\//i);
    return m ? m[1] : "";
  }

  async function guardGameAccess() {
    const gameId = detectGameId();
    if (!gameId) return;

    try {
      const response = await fetch("/api/games.php", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data || !Array.isArray(data.games)) return;

      const currentGame = data.games.find((g) => g.id === gameId);
      if (!currentGame || !currentGame.wip) return;

      const target = `/index.html?wip=${encodeURIComponent(gameId)}`;
      window.location.replace(target);
    } catch (_error) {
      // Не блокируем доступ при временной недоступности API.
    }
  }

  guardGameAccess();
})();
