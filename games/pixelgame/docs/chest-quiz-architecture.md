# Chest Quiz Architecture

## Level file structure

Each level is stored in a separate JSON file:

- `data/levels/level1.json`
- `data/levels/level2.json`
- `data/levels/level3.json`
- `data/levels/level4.json`

Base format:

```json
{
  "level": 1,
  "title": "Level 1",
  "chests": [
    {
      "id": 1,
      "question": "Question text",
      "options": ["A", "B", "C", "D"],
      "correct": 0
    }
  ]
}
```

This structure is enough for the current requirement. If needed later, each chest can be extended with optional fields such as `hint`, `reward`, `difficulty`, `topic`.

## Recommended runtime model

```js
const gameState = {
  currentLevel: 1,
  hp: 5,
  maxHp: 5,
  levelData: null,
  chestStates: new Map(),
  activeChestId: null
};
```

Recommended per-chest state:

```js
{
  opened: false,
  attempts: 0
}
```

Important rule: chest question data must remain immutable after loading. Wrong answers must not reorder options and must not remove the question.

## Loading logic

```js
async function loadLevel(levelNumber) {
  const response = await fetch(`data/levels/level${levelNumber}.json`);
  if (!response.ok) {
    throw new Error(`Level ${levelNumber} failed to load`);
  }

  const levelData = await response.json();
  validateLevelData(levelData);

  gameState.currentLevel = levelNumber;
  gameState.levelData = levelData;
  gameState.chestStates = new Map();

  for (const chest of levelData.chests) {
    gameState.chestStates.set(chest.id, {
      opened: false,
      attempts: 0
    });
  }

  return levelData;
}
```

## Chest interaction rules

Required behavior:

- HUD with HP stays visible all the time.
- Chest question is shown in a modal or inline overlay below the HUD.
- On wrong answer:
  - decrease HP by 1
  - do not highlight the correct option
  - show message: `Неверно! Правильный ответ: [text]`
  - after closing the message, show the same chest question again
- On correct answer:
  - do not decrease HP
  - show message: `Верно!`
  - mark chest as opened
  - never show this chest again

## Pseudocode

```js
function onChestTouched(chestId) {
  const chestState = gameState.chestStates.get(chestId);
  if (!chestState || chestState.opened) {
    return;
  }

  gameState.activeChestId = chestId;
  renderChestQuestion(chestId);
}

function renderChestQuestion(chestId) {
  const chest = gameState.levelData.chests.find(item => item.id === chestId);
  if (!chest) {
    return;
  }

  showQuestionOverlay({
    question: chest.question,
    options: chest.options
  });
}

function onChestAnswer(chestId, selectedIndex) {
  const chest = gameState.levelData.chests.find(item => item.id === chestId);
  const chestState = gameState.chestStates.get(chestId);
  if (!chest || !chestState) {
    return;
  }

  if (selectedIndex === chest.correct) {
    chestState.opened = true;
    showInfoModal("Верно!", () => {
      closeQuestionOverlay();
      gameState.activeChestId = null;
      checkLevelComplete();
    });
    return;
  }

  chestState.attempts += 1;
  gameState.hp = Math.max(0, gameState.hp - 1);
  updateHudHp(gameState.hp);

  if (gameState.hp === 0) {
    showGameOver();
    return;
  }

  const correctText = chest.options[chest.correct];
  showInfoModal(`Неверно! Правильный ответ: ${correctText}`, () => {
    renderChestQuestion(chestId);
  });
}
```

## UI requirement for visible HP

Current project already has a separate HUD block in `index.html`, but the chest dialog should not fully cover it.

Recommended UI approaches:

1. Keep `#hud` above the modal with a higher `z-index`.
2. Render the question overlay starting below the HUD area.
3. Do not hide or remove the HUD while a chest is open.

Example CSS direction:

```css
#hud {
  z-index: 500;
}

.dialog {
  top: 56px;
  height: calc(100vh - 56px);
  z-index: 400;
}
```

## Mapping to current codebase

Current project stores chest questions directly in `script.js` inside `CHEST_DATA`. To move to level JSON files cleanly:

1. Replace `CHEST_DATA` with `state.levelData.chests`.
2. Replace `TOTAL_CHESTS` with `state.levelData.chests.length`.
3. Call `await loadLevel(1)` before `startGame()`.
4. Refactor `openChest()` so a wrong answer:
   - calls `loseHP(1)`
   - shows only the wrong-answer message
   - re-renders the same question after message close
   - does not reveal the correct button visually
5. Keep battle questions separate if chest and combat mechanics should evolve independently.
