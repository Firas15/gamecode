/*
   КТО ХОЧЕТ СТАТЬ ПРОГРАММИСТОМ — game.js
   

   СТРУКТУРА:
   1.  ЗВУКИ          — Web Audio API
   2.  ЗВЁЗДНЫЙ ФОН   — canvas анимация
   3.  ТАБЛИЦА ПРИЗОВ — 15 ступеней, 3 гарантии
   4.  СОСТОЯНИЕ      — объект state
   5.  ЗАГРУЗКА ВОПРОСОВ — fetch questions.json
   6.  ЭКРАНЫ         — showScreen()
   7.  МЕНЮ           — buildMenu()
   8.  ЛЕСТНИЦА ПРИЗОВ — buildLadder()
   9.  ЗАГРУЗКА ВОПРОСА — loadQuestion()
  10.  ПОДСКАЗКИ      — immunity, 5050, audience, swap
  11.  ОБРАБОТКА ОТВЕТА — handleAnswer()
  12.  ПОЯСНЕНИЕ      — showExplanation()
  13.  СЛЕДУЮЩИЙ ВОПРОС — nextQuestion()
  14.  КОНЕЦ ИГРЫ     — endGame()
  15.  КНОПКИ И КЛАВИШИ
  16.  ЗАПУСК         — init()
 */


/* 
   1. ЗВУКИ
 */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function beep(freq, dur, shape = 'square', vol = 0.15) {
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = shape;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.start();
  osc.stop(audioCtx.currentTime + dur);
}

function soundClick()   { beep(440, 0.05, 'square', 0.08); }
function soundSelect()  { beep(660, 0.06); setTimeout(() => beep(880, 0.08), 80); }
function soundThink()   {
  // Нарастающая драматическая нота при выборе ответа
  [330, 392, 494].forEach((n,i) => setTimeout(() => beep(n, 0.06, 'sine', 0.1), i * 120));
}
function soundCorrect() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((n,i) => setTimeout(() => beep(n, 0.1), i * 80));
}
function soundWrong() {
  beep(220, 0.1, 'sawtooth');
  setTimeout(() => beep(150, 0.2, 'sawtooth'), 110);
}
function soundSafe()    {
  [784, 880, 1047, 1175].forEach((n,i) => setTimeout(() => beep(n, 0.12, 'sine', 0.12), i * 100));
}
function soundFinal()   {
  const melody = [523,659,784,1047,784,659,523,659,784,1047];
  melody.forEach((n,i) => setTimeout(() => beep(n, 0.1, 'sine', 0.12), i * 120));
}
function soundHint()    { beep(880, 0.05, 'sine', 0.12); setTimeout(() => beep(1100, 0.08, 'sine', 0.1), 60); }
function soundLose()    {
  [300,250,200,150].forEach((n,i) => setTimeout(() => beep(n, 0.15, 'sawtooth', 0.18), i * 120));
}


/* 
   2. ЗВЁЗДНЫЙ ФОН
 */
(function initStars() {
  const canvas = document.getElementById('stars-canvas');
  const ctx    = canvas.getContext('2d');
  let stars    = [];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = Array.from({ length: 100 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.3,
      a: Math.random(),
      s: Math.random() * 0.007 + 0.003,
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(st => {
      st.a += st.s;
      if (st.a > 1 || st.a < 0) st.s *= -1;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,216,240,${st.a * 0.45})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize', resize);
  resize();
  draw();
})();


const AudienceSystem = { setCorrect: () => {}, setWrong: () => {} };




/* 
   3. ТАБЛИЦА ПРИЗОВ
 */
const QUESTION_TIME_SEC = 60;
let questionTimerInterval = null;
let pendingAnswerIdx      = null;

const PRIZES = [
  { q: 1,  prize: '1',    safe: false },
  { q: 2,  prize: '2',    safe: false },
  { q: 3,  prize: '3',    safe: false },
  { q: 4,  prize: '5',    safe: false },
  { q: 5,  prize: '10',   safe: true  },  // первая гарантия
  { q: 6,  prize: '20',   safe: false },
  { q: 7,  prize: '40',   safe: false },
  { q: 8,  prize: '80',   safe: false },
  { q: 9,  prize: '160',  safe: false },
  { q: 10, prize: '320',  safe: true  },  // вторая гарантия
  { q: 11, prize: '400',  safe: false },
  { q: 12, prize: '500',  safe: false },
  { q: 13, prize: '650',  safe: false },
  { q: 14, prize: '800',  safe: false },
  { q: 15, prize: '1000', safe: true  },
];


/* 
   4. СОСТОЯНИЕ ИГРЫ
 */
const state = {
  allQuestions:     [],   
  questions:        [],   
  currentIdx:       0,    
  correctCount:     0,
  wrongCount:       0,
  selectedAnswer:   null, 
  safeAmount:       '0',  
  busy:             false,
  startedAtMs:      0,

  hints: {
    immunity: false, 
    immunity_active: false, 
    fiveOfifty: false,
    audience:  false,
    swap:      false,
  },

  timeLeft:     60,
  timerPaused:  false,

  
  shuffledAnswers: [],
  shuffledCorrect: 0,
};


/* 
   5. ЗАГРУЗКА ВОПРОСОВ
   
 */
const QUESTIONS_DATA = [
  {
    "id": 1,
    "difficulty": "easy",
    "lang": "python",
    "question": "Что выведет print(type(42))?",
    "answers": ["<class 'int'>", "<class 'str'>", "<class 'float'>", "<class 'number'>"],
    "correct": 0,
    "explanation": "42 — целое число, type() возвращает <class 'int'>"
  },
  {
    "id": 2,
    "difficulty": "easy",
    "lang": "python",
    "question": "Какой оператор используется для возведения в степень в Python?",
    "answers": ["^", "**", "^^", "pow"],
    "correct": 1,
    "explanation": "В Python ** — оператор возведения в степень. Например 2**8 = 256. Символ ^ — это побитовое XOR."
  },
  {
    "id": 3,
    "difficulty": "easy",
    "lang": "cpp",
    "question": "Что такое #include в C++?",
    "answers": ["Объявление переменной", "Директива препроцессора для подключения файлов", "Однострочный комментарий", "Оператор вывода в консоль"],
    "correct": 1,
    "explanation": "#include — директива препроцессора. Она вставляет содержимое указанного файла в код до компиляции."
  },
  {
    "id": 4,
    "difficulty": "easy",
    "lang": "python",
    "question": "Какая функция возвращает длину списка в Python?",
    "answers": ["size()", "count()", "len()", "length()"],
    "correct": 2,
    "explanation": "len() — встроенная функция Python. Работает со строками, списками, кортежами, словарями и любыми итерируемыми объектами."
  },
  {
    "id": 5,
    "difficulty": "easy",
    "lang": "cpp",
    "question": "Как объявить целочисленную переменную x = 10 в C++?",
    "answers": ["variable x = 10;", "int x = 10;", "x := 10;", "declare x = 10;"],
    "correct": 1,
    "explanation": "В C++ тип переменной указывается перед именем: int x = 10; Тип int — 32-битное целое число."
  },
  {
    "id": 6,
    "difficulty": "easy",
    "lang": "python",
    "question": "Как создать пустой список в Python?",
    "answers": ["list{}", "[]", "{}", "()"],
    "correct": 1,
    "explanation": "[] — литерал пустого списка. {} создаёт пустой словарь, () — пустой кортеж."
  },
  {
    "id": 7,
    "difficulty": "easy",
    "lang": "python",
    "question": "Какое ключевое слово используется для объявления функции в Python?",
    "answers": ["function", "func", "def", "fn"],
    "correct": 2,
    "explanation": "def (от define) — ключевое слово Python для объявления функции. Пример: def my_func():"
  },
  {
    "id": 8,
    "difficulty": "easy",
    "lang": "cpp",
    "question": "Каким символом заканчивается каждый оператор в C++?",
    "answers": [":", ".", ";", ","],
    "correct": 2,
    "explanation": "Каждый оператор в C++ заканчивается точкой с запятой ;. Это обязательное требование синтаксиса языка."
  },
  {
    "id": 9,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что выведет этот код?\n\nx = [1, 2, 3]\nprint(x[-1])",
    "answers": ["1", "3", "-1", "Ошибка IndexError"],
    "correct": 1,
    "explanation": "Отрицательные индексы в Python считают с конца. x[-1] — последний элемент, то есть 3."
  },
  {
    "id": 10,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что означает const перед переменной в C++?",
    "answers": ["Переменная доступна из любого места программы", "Значение переменной нельзя изменить после инициализации", "Переменная хранится только в стеке", "Переменная является статической"],
    "correct": 1,
    "explanation": "const гарантирует неизменяемость значения после инициализации. Попытка изменить — ошибка компиляции."
  },
  {
    "id": 11,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что делает метод .strip() в Python?",
    "answers": ["Разбивает строку на список слов", "Переводит строку в верхний регистр", "Удаляет пробелы по краям строки", "Заменяет подстроку в строке"],
    "correct": 2,
    "explanation": ".strip() удаляет пробельные символы с начала и конца строки. '  hello  '.strip() вернёт 'hello'."
  },
  {
    "id": 12,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что такое указатель (pointer) в C++?",
    "answers": ["Ссылка на функцию внутри класса", "Переменная, хранящая адрес другой переменной в памяти", "Специальный числовой тип данных", "Псевдоним (alias) для другой переменной"],
    "correct": 1,
    "explanation": "Указатель хранит адрес памяти другой переменной. int* p = &x; — p хранит адрес x, *p — доступ к значению."
  },
  {
    "id": 13,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что выведет этот код?\n\nd = {'a': 1, 'b': 2}\nprint(d.get('c', 99))",
    "answers": ["None", "Ошибка KeyError", "99", "0"],
    "correct": 2,
    "explanation": ".get(key, default) возвращает default если ключ отсутствует. Ключа 'c' нет — вернёт 99."
  },
  {
    "id": 14,
    "difficulty": "medium",
    "lang": "python",
    "question": "Какой результат вернёт выражение: bool(0)?",
    "answers": ["1", "True", "False", "Ошибка TypeError"],
    "correct": 2,
    "explanation": "В Python 0 — «ложное» (falsy) значение. bool(0) → False. bool(любое ненулевое число) → True."
  },
  {
    "id": 15,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что делает оператор -> в C++?",
    "answers": ["Оператор сравнения (больше)", "Обращение к члену структуры через указатель", "Оператор возврата из функции", "Создание нового объекта"],
    "correct": 1,
    "explanation": "ptr->field — это сокращение для (*ptr).field. Разыменовывает указатель и обращается к полю объекта."
  },
  {
    "id": 16,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что выведет: print(2 ** 3 ** 2)?",
    "answers": ["64", "512", "729", "Ошибка"],
    "correct": 1,
    "explanation": "Оператор ** правоассоциативен. 2**3**2 = 2**(3**2) = 2**9 = 512, а не (2**3)**2 = 64."
  },
  {
    "id": 17,
    "difficulty": "hard",
    "lang": "python",
    "question": "Что выведет этот код?\n\ndef f(x=[]):\n    x.append(1)\n    return x\n\nprint(f())\nprint(f())",
    "answers": ["[1] и [1]", "[1] и [1, 1]", "[] и [1]", "Ошибка при втором вызове"],
    "correct": 1,
    "explanation": "Изменяемый дефолтный аргумент создаётся ОДИН РАЗ при определении функции. Список накапливает значения между вызовами — классический подводный камень Python!"
  },
  {
    "id": 18,
    "difficulty": "hard",
    "lang": "cpp",
    "question": "Что такое vtable в C++?",
    "answers": ["Таблица глобальных переменных программы", "Таблица виртуальных функций для реализации полиморфизма", "Внутренняя структура данных вектора std::vector", "Кэш инстанцированных шаблонов (templates)"],
    "correct": 1,
    "explanation": "vtable — скрытый массив указателей на виртуальные функции. Каждый объект хранит vptr → vtable, что позволяет вызывать правильный метод в runtime."
  },
  {
    "id": 19,
    "difficulty": "hard",
    "lang": "python",
    "question": "Что вернёт выражение?\n\nlist(map(lambda x: x**2, filter(lambda x: x%2==0, range(10))))",
    "answers": ["[0, 4, 16, 36, 64]", "[1, 4, 9, 16, 25]", "[0, 2, 4, 6, 8]", "[4, 16, 36, 64, 100]"],
    "correct": 0,
    "explanation": "filter выбирает чётные из range(10): [0,2,4,6,8]. map возводит каждое в квадрат: [0,4,16,36,64]."
  },
  {
    "id": 20,
    "difficulty": "hard",
    "lang": "cpp",
    "question": "Что делает std::move() в C++11?",
    "answers": ["Физически перемещает объект в новый адрес памяти", "Копирует объект с оптимизацией RVO", "Преобразует lvalue в rvalue, позволяя передать владение ресурсом без копирования", "Удаляет объект из памяти немедленно"],
    "correct": 2,
    "explanation": "std::move() — это cast в rvalue-ссылку. Позволяет move-конструктору «угнать» внутренние ресурсы (буфер, файловый дескриптор) без дорогостоящего копирования."
  },
  {
    "id": 21,
    "difficulty": "hard",
    "lang": "python",
    "question": "Что такое GIL (Global Interpreter Lock) в Python?",
    "answers": ["Механизм сборки мусора, блокирующий память", "Мьютекс CPython — только один поток выполняет байткод одновременно", "Глобальная таблица импортированных модулей", "Ограничение на размер стека вызовов"],
    "correct": 1,
    "explanation": "GIL — мьютекс в CPython. Из-за него потоки не параллельны на уровне CPU. Обходится через multiprocessing или asyncio."
  },
  {
    "id": 22,
    "difficulty": "hard",
    "lang": "python",
    "question": "Что выведет этот код?\n\nclass A:\n    x = 0\na, b = A(), A()\na.x = 5\nprint(A.x, a.x, b.x)",
    "answers": ["5 5 5", "0 5 0", "5 5 0", "0 5 5"],
    "correct": 1,
    "explanation": "a.x = 5 создаёт атрибут ЭКЗЕМПЛЯРА, не меняя атрибут КЛАССА. A.x остаётся 0, b.x берёт из класса — тоже 0, а a.x = 5."
  },
  {
    "id": 23,
    "difficulty": "hard",
    "lang": "cpp",
    "question": "Чем отличается new от malloc() в C++?",
    "answers": ["new быстрее, malloc выделяет больше памяти", "new вызывает конструктор и бросает исключение; malloc только выделяет память и возвращает nullptr", "malloc работает с классами, new — только с примитивами", "Они идентичны, new — это синтаксический сахар над malloc"],
    "correct": 1,
    "explanation": "new: выделяет память + вызывает конструктор + бросает std::bad_alloc при ошибке. malloc: только сырая память, возвращает nullptr при ошибке, конструктор не вызывает."
  },
  {
    "id": 24,
    "difficulty": "hard",
    "lang": "python",
    "question": "Что такое декоратор в Python?",
    "answers": ["Комментарий к функции для документации", "Функция, принимающая функцию и возвращающая новую функцию с расширенным поведением", "Синтаксис для создания анонимных лямбда-функций", "Специальный метод класса, начинающийся с __"],
    "correct": 1,
    "explanation": "@decorator — синтаксический сахар для f = decorator(f). Декоратор оборачивает функцию, добавляя поведение до/после без изменения исходного кода."
  },
  {
    "id": 25,
    "difficulty": "easy",
    "lang": "cpp",
    "question": "Как объявить массив из 5 целых чисел в C++?",
    "answers": ["int arr[5];", "array arr(5);", "int arr;", "arr<int>[5];"],
    "correct": 0,
    "explanation": "В C++ массив фиксированной длины объявляется как тип_данных имя[размер]; например: int arr[5];"
  },
  {
    "id": 26,
    "difficulty": "easy",
    "lang": "python",
    "question": "Что выведет этот код?\n\nprint('Hello' + 'World')",
    "answers": ["Hello World", "HelloWorld", "Hello+World", "Ошибка"],
    "correct": 1,
    "explanation": "Оператор + для строк в Python выполняет конкатенацию без пробела. Результат: 'HelloWorld'."
  },
  {
    "id": 27,
    "difficulty": "easy",
    "lang": "cpp",
    "question": "Какой оператор используется для побитового И в C++?",
    "answers": ["&", "|", "^", "&&"],
    "correct": 0,
    "explanation": "Символ & в C++ — побитовое И. Символ && — логическое И."
  },
  {
    "id": 28,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что делает метод .append() в Python для списка?",
    "answers": ["Добавляет элемент в конец списка", "Удаляет элемент из списка", "Возвращает новый список с элементами", "Сортирует список"],
    "correct": 0,
    "explanation": ".append(value) добавляет value в конец списка, изменяя исходный список."
  },
  {
    "id": 29,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что делает оператор sizeof в C++?",
    "answers": ["Возвращает количество элементов в массиве", "Возвращает размер типа данных или объекта в байтах", "Создаёт объект указанного размера", "Возвращает количество переменных в программе"],
    "correct": 1,
    "explanation": "sizeof(type) возвращает размер типа или объекта в байтах. Например sizeof(int) обычно 4."
  },
  {
    "id": 30,
    "difficulty": "medium",
    "lang": "python",
    "question": "Какой результат вернёт выражение: 'abc'.upper()?",
    "answers": ["'abc'", "'ABC'", "'Abc'", "Ошибка"],
    "correct": 1,
    "explanation": ".upper() возвращает копию строки в верхнем регистре. 'abc'.upper() → 'ABC'."
  },
  {
    "id": 31,
    "difficulty": "hard",
    "lang": "cpp",
    "question": "Что делает ключевое слово virtual перед функцией в C++?",
    "answers": ["Функция становится приватной", "Функция может быть переопределена в наследниках и вызвана динамически", "Функция не может быть вызвана вне класса", "Функция компилируется только один раз"],
    "correct": 1,
    "explanation": "virtual позволяет использовать динамический полиморфизм: вызов метода через указатель или ссылку на базовый класс вызывает версию из производного класса."
  },
  {
    "id": 32,
    "difficulty": "hard",
    "lang": "python",
    "question": "Что делает выражение [x**2 for x in range(5) if x%2==0]?",
    "answers": ["Создаёт список квадратов всех чисел от 0 до 4", "Создаёт список квадратов только чётных чисел от 0 до 4", "Создаёт генератор чисел от 0 до 4", "Ошибка синтаксиса"],
    "correct": 1,
    "explanation": "List comprehension с условием if x%2==0 создаёт список квадратов чётных чисел: [0, 4, 16]."
  },
  {
    "id": 33,
    "difficulty": "hard",
    "lang": "cpp",
    "question": "Что делает ключевое слово constexpr в C++11?",
    "answers": ["Объявляет константу времени компиляции", "Создаёт динамическую переменную", "Инициализирует указатель на функцию", "Запрещает использование переменной вне функции"],
    "correct": 0,
    "explanation": "constexpr гарантирует, что выражение вычисляется на этапе компиляции, позволяя создавать константы, массивы фиксированной длины и оптимизировать код."
  },
  {
    "id": 34,
    "difficulty": "easy",
    "lang": "python",
    "question": "Как создать кортеж с элементами 1, 2 и 3 в Python?",
    "answers": ["[1, 2, 3]", "(1, 2, 3)", "{1, 2, 3}", "tuple[1, 2, 3]"],
    "correct": 1,
    "explanation": "Кортеж создаётся с помощью круглых скобок: (1, 2, 3). [] — список, {} — множество."
  },
  {
    "id": 35,
    "difficulty": "easy",
    "lang": "cpp",
    "question": "Что выведет следующий код?\n\nstd::cout << 10 / 3 << std::endl;",
    "answers": ["3", "3.3333", "3.0", "Ошибка компиляции"],
    "correct": 0,
    "explanation": "Оба числа int, поэтому выполняется целочисленное деление. 10/3 → 3."
  },
  {
    "id": 36,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что делает функция zip([1,2], ['a','b'])?",
    "answers": ["Создаёт словарь {1:'a', 2:'b'}", "Создаёт список кортежей [(1,'a'), (2,'b')]", "Возвращает [1,'a',2,'b']", "Ошибка"],
    "correct": 1,
    "explanation": "zip создаёт итератор кортежей по элементам переданных итерируемых объектов: [(1,'a'), (2,'b')] при приведении к списку."
  },
  {
    "id": 37,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что делает ключевое слово static для переменной внутри функции?",
    "answers": ["Переменная доступна только внутри функции и сохраняет своё значение между вызовами", "Создаёт глобальную переменную", "Переменная хранится только в стеке", "Переменная инициализируется каждый раз заново"],
    "correct": 0,
    "explanation": "static внутри функции сохраняет значение переменной между вызовами. В отличие от обычной локальной, она не теряет своё состояние."
  },
  {
    "id": 38,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что выведет следующий код?\n\nx = [1,2,3]\ny = x\nx.append(4)\nprint(y)",
    "answers": ["[1, 2, 3]", "[1, 2, 3, 4]", "Ошибка", "[]"],
    "correct": 1,
    "explanation": "y — это ссылка на тот же список, что x. Изменения x видны и в y."
  },
  {
    "id": 39,
    "difficulty": "hard",
    "lang": "cpp",
    "question": "Что делает ключевое слово explicit перед конструктором?",
    "answers": ["Запрещает неявные преобразования типов при вызове конструктора", "Делает конструктор приватным", "Позволяет конструктору быть виртуальным", "Вызывает конструктор автоматически"],
    "correct": 0,
    "explanation": "explicit предотвращает неявное преобразование типов. Без него компилятор может выполнить преобразование при присваивании или вызове функции."
  },
  {
    "id": 40,
    "difficulty": "hard",
    "lang": "python",
    "question": "Что выведет этот код?\n\nx = [1,2,3]\nprint(x * 2)",
    "answers": ["[1,2,3,1,2,3]", "[2,4,6]", "[1,2,3]", "Ошибка"],
    "correct": 0,
    "explanation": "Оператор * повторяет список. x*2 → [1,2,3,1,2,3]."
  },
  {
    "id": 41,
    "difficulty": "hard",
    "lang": "cpp",
    "question": "Чем отличается std::vector от обычного массива в C++?",
    "answers": ["vector имеет динамический размер и методы управления элементами, массив — фиксированный размер", "vector быстрее, чем массив", "vector может хранить только объекты класса, массив — примитивы", "vector не требует #include"],
    "correct": 0,
    "explanation": "std::vector — контейнер STL с динамическим размером, методами push_back, size и т.д. Обычный массив фиксирован по размеру."
  },
  {
    "id": 42,
    "difficulty": "hard",
    "lang": "python",
    "question": "Что делает следующий код?\n\nprint([i for i in range(5) if i%2])",
    "answers": ["[0, 2, 4]", "[1, 3]", "[1, 3, 5]", "[0, 1, 2, 3, 4]"],
    "correct": 1,
    "explanation": "i%2 возвращает True для нечётных чисел. Генератор формирует список нечётных элементов: [1,3]."
  },
  {
    "id": 43,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что делает оператор ?: в C++?",
    "answers": ["Логическое И", "Тернарный оператор (условие ? значение1 : значение2)", "Сравнение с плавающей точкой", "Деление по модулю"],
    "correct": 1,
    "explanation": "Оператор ?: — тернарный оператор. Пример: int a = (x>0) ? 1 : -1;"
  },
  {
    "id": 44,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что делает метод .pop() для списка в Python?",
    "answers": ["Удаляет последний элемент и возвращает его", "Удаляет все элементы", "Возвращает новый список без последнего элемента", "Удаляет элемент по значению"],
    "correct": 0,
    "explanation": ".pop() удаляет и возвращает последний элемент списка по умолчанию, или по указанному индексу."
  },
  {
    "id": 45,
    "difficulty": "easy",
    "lang": "python",
    "question": "Что делает функция type('Hello') в Python?",
    "answers": ["Возвращает строку 'Hello'", "Возвращает тип объекта <class 'str'>", "Ошибка", "Возвращает объект класса str"],
    "correct": 1,
    "explanation": "type(obj) возвращает тип объекта. type('Hello') → <class 'str'>."
  },
  {
    "id": 46,
    "difficulty": "easy",
    "lang": "cpp",
    "question": "Что делает оператор ++ в C++?",
    "answers": ["Умножает значение на 2", "Увеличивает значение на 1", "Возводит значение в квадрат", "Обнуляет значение"],
    "correct": 1,
    "explanation": "Оператор ++ увеличивает целочисленное или перечисляемое значение на 1."
  },
  {
    "id": 47,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что делает itertools.product([1,2], ['a','b'])?",
    "answers": ["Перемешивает элементы списков", "Создаёт все возможные пары (декартово произведение)", "Создаёт генератор случайных чисел", "Ошибка"],
    "correct": 1,
    "explanation": "itertools.product генерирует декартово произведение входных итерируемых объектов: (1,'a'), (1,'b'), (2,'a'), (2,'b')."
  },
  {
    "id": 48,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что делает оператор & перед переменной в C++?",
    "answers": ["Разыменовывает указатель", "Возвращает адрес переменной", "Создаёт ссылку на функцию", "Создаёт битовую маску"],
    "correct": 1,
    "explanation": "&x возвращает адрес переменной x в памяти."
  },
  {
    "id": 49,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что выведет следующий код?\n\nx = [1,2,3]\ny = x.copy()\nx.append(4)\nprint(y)",
    "answers": ["[1,2,3]", "[1,2,3,4]", "Ошибка", "[]"],
    "correct": 0,
    "explanation": "copy() создаёт новый независимый список. Изменение x не влияет на y."
  },
  {
    "id": 50,
    "difficulty": "hard",
    "lang": "cpp",
    "question": "Что делает оператор & в объявлении функции: void f(int &x)?",
    "answers": ["Создаёт указатель на x", "Создаёт ссылку на x, позволяя изменять его значение", "Возвращает адрес функции", "Сравнивает x с другим значением"],
    "correct": 1,
    "explanation": "int &x — это ссылка на переменную, передаваемую в функцию. Изменения x отражаются вне функции."
  },
  {
    "id": 51,
    "difficulty": "hard",
    "lang": "python",
    "question": "Что делает следующий код?\n\n@staticmethod\nclass MyClass:\n    pass",
    "answers": ["Создаёт статический метод класса", "Создаёт класс, который нельзя наследовать", "Ошибка синтаксиса", "Создаёт обычный метод класса"],
    "correct": 2,
    "explanation": "Неправильный синтаксис: @staticmethod применяется к функции, а не к классу. Такой код вызовет SyntaxError."
  },
  {
    "id": 52,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что такое шаблон функции (function template) в C++?",
    "answers": ["Функция, принимающая переменное количество аргументов", "Обобщённая функция, работающая с разными типами данных", "Функция с внутренним массивом", "Функция, создающая указатели"],
    "correct": 1,
    "explanation": "Шаблон функции позволяет писать универсальные функции для разных типов: template<typename T> T add(T a,T b){return a+b;}"
  },
  {
    "id": 53,
    "difficulty": "hard",
    "lang": "python",
    "question": "Что выведет следующий код?\n\ndef f():\n    x = 10\n    def g():\n        nonlocal x\n        x += 5\n    g()\n    return x\nprint(f())",
    "answers": ["10", "15", "Ошибка", "5"],
    "correct": 1,
    "explanation": "nonlocal позволяет внутренней функции изменять переменные внешней функции. x=10 → x+=5 → 15."
  },
  {
    "id": 54,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что делает ключевое слово override в C++11?",
    "answers": ["Объявляет новую функцию", "Гарантирует, что метод переопределяет виртуальный метод базового класса", "Указывает на статическую функцию", "Вызывает родительский конструктор"],
    "correct": 1,
    "explanation": "override проверяет на этапе компиляции, что метод действительно переопределяет виртуальную функцию базового класса."
  },
  {
    "id": 55,
    "difficulty": "hard",
    "lang": "cpp",
    "question": "Что делает оператор :: в C++?",
    "answers": ["Доступ к глобальной переменной", "Оператор разрешения области видимости", "Создание нового объекта", "Объявление массива"],
    "correct": 1,
    "explanation": "Оператор :: используется для доступа к членам класса или пространства имён: std::cout, MyClass::method()."
  },
  {
    "id": 56,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что делает генераторное выражение (x*x for x in range(5))?",
    "answers": ["Создаёт список квадратов чисел", "Создаёт генератор, который вычисляет элементы по мере итерации", "Создаёт массив NumPy", "Ошибка синтаксиса"],
    "correct": 1,
    "explanation": "Генераторное выражение возвращает итератор, который вычисляет элементы по требованию, экономя память."
  },
  {
    "id": 57,
    "difficulty": "easy",
    "lang": "cpp",
    "question": "Какой заголовочный файл нужен для использования std::vector?",
    "answers": ["<array>", "<vector>", "<list>", "<map>"],
    "correct": 1,
    "explanation": "std::vector содержится в заголовочном файле <vector>."
  },
  {
    "id": 58,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что делает метод dict.keys()?",
    "answers": ["Возвращает список всех значений словаря", "Возвращает итератор по ключам словаря", "Удаляет ключи из словаря", "Сортирует словарь по ключам"],
    "correct": 1,
    "explanation": "dict.keys() возвращает view объектов словаря, которые можно использовать для итерации по ключам."
  },
  {
    "id": 59,
    "difficulty": "hard",
    "lang": "cpp",
    "question": "Что такое RAII в C++?",
    "answers": ["Алгоритм сортировки", "Идиома, где ресурс управляется временем жизни объекта", "Функция стандартной библиотеки", "Шаблон класса для вектора"],
    "correct": 1,
    "explanation": "RAII (Resource Acquisition Is Initialization) — идиома, где объект владеет ресурсом и освобождает его при разрушении."
  },
  {
    "id": 60,
    "difficulty": "hard",
    "lang": "python",
    "question": "Что делает functools.lru_cache()?",
    "answers": ["Кеширует результаты функции для ускорения повторных вызовов", "Создаёт многопоточный вызов функции", "Запускает функцию асинхронно", "Удаляет старые переменные"],
    "correct": 0,
    "explanation": "lru_cache() сохраняет результаты вызовов функции с определёнными аргументами, чтобы повторные вызовы возвращали результат мгновенно."
  },
  {
    "id": 61,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что делает оператор ->* в C++?",
    "answers": ["Указатель на объект", "Вызов указателя на член класса через указатель на объект", "Создание указателя на функцию", "Разыменование указателя на массив"],
    "correct": 1,
    "explanation": "ptr->*pmf вызывает метод члена класса через указатель на функцию-член (pointer to member function)."
  },
  {
    "id": 62,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что делает метод itertools.chain(a,b)?",
    "answers": ["Объединяет два итератора в один последовательный", "Создаёт список пар элементов", "Возвращает пересечение элементов", "Создаёт генератор случайных чисел"],
    "correct": 0,
    "explanation": "itertools.chain объединяет несколько итерируемых объектов в единый итератор."
  },
  {
    "id": 63,
    "difficulty": "easy",
    "lang": "python",
    "question": "Что выведет выражение: 3 * 'ab'?",
    "answers": ["'ababab'", "'abc'", "'ab3'", "Ошибка"],
    "correct": 0,
    "explanation": "Оператор * для строк повторяет строку указанное количество раз: 'ab'*3 → 'ababab'."
  },
  {
    "id": 64,
    "difficulty": "easy",
    "lang": "cpp",
    "question": "Что выведет std::cout << (5 > 3) << std::endl;?",
    "answers": ["1", "0", "true", "false"],
    "correct": 0,
    "explanation": "Операторы сравнения возвращают bool. В std::cout bool выводится как 1 (true) или 0 (false) по умолчанию."
  },
  {
    "id": 65,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что делает функция enumerate(['a','b','c'])?",
    "answers": ["Возвращает словарь", "Возвращает пары (индекс, элемент)", "Создаёт список", "Ошибка"],
    "correct": 1,
    "explanation": "enumerate() создаёт итератор кортежей: (0,'a'), (1,'b'), (2,'c')."
  },
  {
    "id": 66,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что делает ключевое слово typename в шаблонах C++?",
    "answers": ["Объявляет тип для шаблона", "Создаёт указатель на тип", "Определяет размер типа", "Создаёт константу"],
    "correct": 0,
    "explanation": "template<typename T> используется для объявления параметра типа в шаблоне функции или класса."
  },
  {
    "id": 67,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что делает метод .items() для словаря?",
    "answers": ["Возвращает список ключей", "Возвращает пары (ключ, значение)", "Удаляет все элементы", "Возвращает список значений"],
    "correct": 1,
    "explanation": "dict.items() возвращает view-объект кортежей (ключ, значение), удобный для итерации."
  },
  {
    "id": 68,
    "difficulty": "hard",
    "lang": "cpp",
    "question": "Что делает std::unique_ptr в C++?",
    "answers": ["Сохраняет указатель, которым может владеть несколько объектов", "Владеет объектом и автоматически освобождает память при разрушении", "Создаёт обычный указатель", "Копирует объект в стек"],
    "correct": 1,
    "explanation": "unique_ptr — умный указатель, владеющий ресурсом и автоматически его освобождающий при выходе из области видимости."
  },
  {
    "id": 69,
    "difficulty": "hard",
    "lang": "python",
    "question": "Что делает следующий код?\n\nwith open('file.txt') as f:\n    data = f.read()",
    "answers": ["Читает содержимое файла и автоматически закрывает его после блока", "Открывает файл и оставляет его открытым", "Создаёт файл file.txt, если его нет", "Ошибка"],
    "correct": 0,
    "explanation": "Контекстный менеджер with открывает файл, выполняет блок кода и автоматически закрывает файл."
  },
  {
    "id": 70,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что делает ключевое слово friend в C++?",
    "answers": ["Позволяет функции или классу получать доступ к приватным членам другого класса", "Создаёт дружественный указатель", "Определяет наследника класса", "Создаёт глобальную переменную"],
    "correct": 0,
    "explanation": "friend позволяет внешней функции или классу иметь доступ к приватным или защищённым членам класса."
  },
  {
    "id": 71,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что делает функция reversed([1,2,3])?",
    "answers": ["Возвращает список [3,2,1]", "Возвращает итератор, перебирающий элементы в обратном порядке", "Удаляет элементы из списка", "Ошибка"],
    "correct": 1,
    "explanation": "reversed() возвращает итератор, элементы которого обходятся в обратном порядке. Для списка можно вызвать list(reversed(...))."
  },
  {
    "id": 72,
    "difficulty": "hard",
    "lang": "cpp",
    "question": "Что делает std::forward<T>(x) в C++11?",
    "answers": ["Копирует объект x", "Позволяет передать lvalue как lvalue, а rvalue как rvalue (perfect forwarding)", "Перемещает объект в heap", "Удаляет объект"],
    "correct": 1,
    "explanation": "std::forward используется для идеальной передачи аргументов в шаблонных функциях, сохраняя категорию значения."
  },
  {
    "id": 73,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что делает метод set.add(value)?",
    "answers": ["Добавляет элемент в множество", "Удаляет элемент", "Создаёт копию множества", "Ошибка"],
    "correct": 0,
    "explanation": "set.add(value) добавляет value во множество, если его там нет."
  },
  {
    "id": 74,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что делает оператор :: в C++?",
    "answers": ["Доступ к члену класса или пространства имён", "Создаёт указатель", "Разыменовывает указатель", "Создаёт массив"],
    "correct": 0,
    "explanation": "Оператор разрешения области видимости :: используется для доступа к членам класса или пространства имён, например std::cout."
  },
  {
    "id": 75,
    "difficulty": "easy",
    "lang": "python",
    "question": "Что делает функция len('Python')?",
    "answers": ["Возвращает 5", "Возвращает 6", "Возвращает строку 'Python'", "Ошибка"],
    "correct": 1,
    "explanation": "len() возвращает количество элементов: len('Python') → 6."
  },
  {
    "id": 76,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что делает ключевое слово delete для указателя?",
    "answers": ["Удаляет сам указатель", "Освобождает память, на которую он указывает", "Обнуляет значение указателя", "Создаёт новый объект в heap"],
    "correct": 1,
    "explanation": "delete ptr освобождает память, выделенную оператором new, на которую указывает ptr."
  },
  {
    "id": 77,
    "difficulty": "hard",
    "lang": "python",
    "question": "Что делает functools.partial(func, a=1)?",
    "answers": ["Создаёт функцию с фиксированным аргументом a=1", "Выполняет функцию func сразу", "Удаляет аргументы функции", "Создаёт асинхронный вызов"],
    "correct": 0,
    "explanation": "partial создаёт новую функцию с предварительно заданными аргументами, чтобы её потом можно было вызвать с меньшим количеством параметров."
  },
  {
    "id": 78,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что делает std::map в C++?",
    "answers": ["Контейнер с уникальными ключами и значениями, отсортированными по ключу", "Массив указателей", "Список кортежей", "Генератор случайных чисел"],
    "correct": 0,
    "explanation": "std::map — ассоциативный контейнер, хранящий пары ключ-значение с уникальными ключами в отсортированном порядке."
  },
  {
    "id": 79,
    "difficulty": "hard",
    "lang": "python",
    "question": "Что делает asyncio.run(coro())?",
    "answers": ["Запускает корутину в отдельном потоке", "Создаёт новый цикл событий, выполняет корутину и закрывает цикл", "Создаёт генератор", "Ошибка"],
    "correct": 1,
    "explanation": "asyncio.run() создаёт новый event loop, запускает корутину и корректно закрывает loop после завершения."
  },
  {
    "id": 80,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что делает noexcept в C++11?",
    "answers": ["Гарантирует, что функция не выбросит исключений", "Создаёт исключение", "Определяет новый тип данных", "Отключает компиляцию функции"],
    "correct": 0,
    "explanation": "noexcept сообщает компилятору, что функция не будет выбрасывать исключения, что может улучшить оптимизацию."
  },
  {
    "id": 81,
    "difficulty": "easy",
    "lang": "python",
    "question": "Как проверить, является ли объект строкой?",
    "answers": ["isinstance(obj, str)", "type(obj) == string", "obj.isstr()", "isstring(obj)"],
    "correct": 0,
    "explanation": "isinstance(obj, str) корректно проверяет принадлежность объекта к типу str."
  },
  {
    "id": 82,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что делает std::pair<int,int> p(1,2)?",
    "answers": ["Создаёт массив из 2 элементов", "Создаёт пару значений типа int", "Создаёт структуру с именами a и b", "Ошибка"],
    "correct": 1,
    "explanation": "std::pair хранит два значения, доступ к которым осуществляется через p.first и p.second."
  },
  {
    "id": 83,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что делает метод set.remove(x)?",
    "answers": ["Удаляет элемент x из множества, вызывает KeyError если нет", "Удаляет элемент x без ошибок", "Создаёт копию множества без x", "Добавляет элемент x"],
    "correct": 0,
    "explanation": "remove() удаляет элемент и вызывает KeyError, если его нет."
  },
  {
    "id": 84,
    "difficulty": "hard",
    "lang": "cpp",
    "question": "Что делает rvalue-ссылка && в C++11?",
    "answers": ["Создаёт обычный указатель", "Позволяет реализовать move-семантику для оптимизации ресурсов", "Создаёт константу", "Удаляет объект"],
    "correct": 1,
    "explanation": "Rvalue-ссылки позволяют перемещать ресурсы вместо копирования, оптимизируя работу с временными объектами."
  },
  {
    "id": 85,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что делает функция zip(*iterables)?",
    "answers": ["Объединяет несколько списков в один", "Разворачивает последовательности по индексам (unzip)", "Создаёт словарь", "Ошибка"],
    "correct": 1,
    "explanation": "Синтаксис * применяет распаковку аргументов, effectively выполняя unzip: zip(*zip(...)) возвращает исходные последовательности."
  },
  {
    "id": 86,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что делает std::tie(a,b) = some_pair;",
    "answers": ["Создаёт новую пару", "Распаковывает значения пары в переменные a и b", "Создаёт tuple из a и b", "Ошибка"],
    "correct": 1,
    "explanation": "std::tie позволяет распаковать std::pair или tuple в существующие переменные."
  },
  {
    "id": 87,
    "difficulty": "hard",
    "lang": "python",
    "question": "Что делает @property перед методом класса?",
    "answers": ["Превращает метод в геттер свойства, доступного как атрибут", "Создаёт декоратор класса", "Создаёт статический метод", "Удаляет метод"],
    "correct": 0,
    "explanation": "@property позволяет получить метод как атрибут: obj.method → вызов метода без скобок."
  },
  {
    "id": 88,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что делает std::array<int,5> arr;",
    "answers": ["Создаёт динамический массив", "Создаёт статический массив фиксированного размера 5", "Создаёт вектор", "Ошибка"],
    "correct": 1,
    "explanation": "std::array — контейнер фиксированного размера, который хранит элементы в стеке и поддерживает методы STL."
  },
  {
    "id": 89,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что делает itertools.permutations([1,2,3], 2)?",
    "answers": ["Создаёт все пары с повторением", "Создаёт все возможные перестановки длины 2", "Возвращает список элементов", "Ошибка"],
    "correct": 1,
    "explanation": "itertools.permutations генерирует все возможные перестановки указанной длины без повторений."
  },
  {
    "id": 90,
    "difficulty": "hard",
    "lang": "cpp",
    "question": "Что делает ключевое слово virtual при наследовании множественном?",
    "answers": ["Создаёт обычное наследование", "Предотвращает проблему ромбовидного наследования (виртуальное наследование)", "Делает методы приватными", "Создаёт указатель на базовый класс"],
    "correct": 1,
    "explanation": "virtual inheritance используется для решения diamond problem при множественном наследовании."
  },
  {
    "id": 91,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что делает itertools.groupby(iterable, key)?",
    "answers": ["Группирует последовательность по ключу", "Создаёт словарь", "Возвращает уникальные элементы", "Сортирует элементы"],
    "correct": 0,
    "explanation": "groupby возвращает итератор, который группирует элементы по ключу, смежные одинаковые элементы объединяются."
  },
  {
    "id": 92,
    "difficulty": "hard",
    "lang": "cpp",
    "question": "Что делает ключевое слово mutable для члена структуры/класса?",
    "answers": ["Позволяет изменять член даже в const объекте", "Создаёт временную переменную", "Сделает член приватным", "Создаёт ссылку на объект"],
    "correct": 0,
    "explanation": "mutable позволяет изменять член класса даже если объект объявлен как const."
  },
  {
    "id": 93,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что делает метод dict.setdefault(key, default)?",
    "answers": ["Возвращает значение ключа, создаёт его с default если нет", "Всегда создаёт ключ с default", "Удаляет ключ из словаря", "Ошибка"],
    "correct": 0,
    "explanation": "setdefault возвращает значение ключа, если его нет — создаёт с default."
  },
  {
    "id": 94,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что делает std::move(x)?",
    "answers": ["Копирует x", "Преобразует x в rvalue для перемещения ресурсов", "Удаляет x", "Создаёт новый объект"],
    "correct": 1,
    "explanation": "std::move() делает из lvalue rvalue-ссылку, позволяя использовать move-конструкторы и экономить ресурсы."
  },
  {
    "id": 95,
    "difficulty": "hard",
    "lang": "python",
    "question": "Что делает декоратор @classmethod?",
    "answers": ["Метод получает класс как первый аргумент вместо объекта", "Создаёт статический метод", "Удаляет метод", "Создаёт приватный метод"],
    "correct": 0,
    "explanation": "classmethod получает сам класс как первый аргумент (обычно cls) и может менять атрибуты класса."
  },
  {
    "id": 96,
    "difficulty": "medium",
    "lang": "cpp",
    "question": "Что делает ключевое слово explicit перед конструктором?",
    "answers": ["Предотвращает неявные преобразования типов", "Создаёт статический метод", "Объявляет виртуальную функцию", "Ошибка"],
    "correct": 0,
    "explanation": "explicit запрещает компилятору выполнять неявные преобразования типов через конструктор."
  },
  {
    "id": 97,
    "difficulty": "medium",
    "lang": "python",
    "question": "Что делает itertools.cycle([1,2,3])?",
    "answers": ["Создаёт бесконечный цикл 1,2,3,1,2,3,...", "Создаёт список [1,2,3]", "Возвращает уникальные элементы", "Ошибка"],
    "correct": 0,
    "explanation": "cycle() создаёт итератор, который бесконечно повторяет входные элементы."
  },
  {
    "id": 98,
    "difficulty": "hard",
    "lang": "cpp",
    "question": "Что делает ключевое слово explicit при операторе преобразования?",
    "answers": ["Запрещает неявные преобразования типов", "Создаёт конструктор по умолчанию", "Объявляет виртуальную функцию", "Удаляет объект"],
    "correct": 0,
    "explanation": "explicit запрещает автоматические преобразования типов через конструктор или оператор преобразования."
  },
  {
    "id": 99,
    "difficulty": "hard",
    "lang": "python",
    "question": "Что делает дескриптор __get__ в Python?",
    "answers": ["Определяет, как атрибут класса возвращается при доступе", "Удаляет атрибут", "Создаёт асинхронную функцию", "Создаёт статический метод"],
    "correct": 0,
    "explanation": "Дескриптор __get__ управляет доступом к атрибуту: obj.attr вызывает attr.__get__(obj, type(obj))."
  },
  {
    "id": 100,
    "difficulty": "hard",
    "lang": "cpp",
    "question": "Что делает виртуальный деструктор в C++?",
    "answers": ["Позволяет правильно уничтожать объекты через указатель на базовый класс", "Создаёт статический объект", "Удаляет объект немедленно", "Создаёт временный объект"],
    "correct": 0,
    "explanation": "Виртуальный деструктор обеспечивает корректный вызов деструкторов производных классов при удалении объекта через указатель на базовый класс."
  }
];

async function loadQuestions() {
  // Вопросы встроены — fetch не нужен, работает везде (в т.ч. через file://)
  state.allQuestions = QUESTIONS_DATA;
}

// Собрать набор из 15 уникальных вопросов: 5 лёгких, 5 средних, 5 тяжёлых
// Вопросы никогда не повторяются в одной игре (shuffle без возврата)
function buildQuestionSet() {
  const pick = (difficulty, count) => {
    const pool = state.allQuestions.filter(q => q.difficulty === difficulty);
    // Fisher-Yates shuffle — гарантирует случайный порядок без повторений
    const arr = [...pool];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    // Если вопросов меньше нужного — берём все доступные (не повторяем)
    return arr.slice(0, Math.min(count, arr.length));
  };

  const easy   = pick('easy',   5);
  const medium = pick('medium', 5);
  const hard   = pick('hard',   5);

  // Порядок: easy → medium → hard (как в оригинальной игре)
  state.questions = [...easy, ...medium, ...hard];
}


/* 
   6. ЭКРАНЫ
 */
const screens = {
  menu:   document.getElementById('s-menu'),
  game:   document.getElementById('s-game'),
  result: document.getElementById('s-result'),
};

function clearQuestionTimer() {
  if (questionTimerInterval) {
    clearInterval(questionTimerInterval);
    questionTimerInterval = null;
  }
}

function closeAnswerConfirm() {
  const overlay = document.getElementById('answer-confirm');
  if (overlay) overlay.classList.remove('visible');
  state.timerPaused = false;
  pendingAnswerIdx = null;
}

function startQuestionTimer() {
  clearQuestionTimer();
  const el = document.getElementById('question-timer');
  state.timeLeft = QUESTION_TIME_SEC;
  state.timerPaused = false;
  if (el) el.textContent = String(state.timeLeft);

  questionTimerInterval = setInterval(() => {
    if (!screens.game.classList.contains('active')) {
      clearQuestionTimer();
      return;
    }
    if (state.timerPaused) return;
    state.timeLeft--;
    if (el) el.textContent = String(Math.max(0, state.timeLeft));
    if (state.timeLeft <= 0) {
      clearQuestionTimer();
      handleTimeUp();
    }
  }, 1000);
}

/** Время вышло — засчитывается как ошибка (иммунитет не спасает). */
function handleTimeUp() {
  if (!screens.game.classList.contains('active')) return;
  if (state.busy || state.selectedAnswer !== null) return;
  if (state.timerPaused) return;

  state.busy = true;
  const q = state.questions[state.currentIdx];
  const correct = state.shuffledCorrect;
  let wrongIdx = 0;
  if (wrongIdx === correct) wrongIdx = 1;

  state.selectedAnswer = wrongIdx;
  [0, 1, 2, 3].forEach(i => {
    const b = document.getElementById(`ans-${i}`);
    if (b) b.disabled = true;
  });

  const wBtn = document.getElementById(`ans-${wrongIdx}`);
  const cBtn = document.getElementById(`ans-${correct}`);
  if (wBtn) wBtn.classList.add('wrong');
  if (cBtn) cBtn.classList.add('correct');
  state.wrongCount++;
  soundWrong();
  if (AudienceSystem && AudienceSystem.setWrong) AudienceSystem.setWrong();
  showExplanation(false, q);
}

function openAnswerConfirm(idx) {
  if (state.busy || state.selectedAnswer !== null) return;
  const overlay = document.getElementById('answer-confirm');
  if (!overlay) {
    soundSelect();
    handleAnswer(idx);
    return;
  }
  pendingAnswerIdx = idx;
  state.timerPaused = true;
  const letters = ['A', 'B', 'C', 'D'];
  const letterEl = document.getElementById('ac-letter');
  const textEl = document.getElementById('ac-text');
  if (letterEl) letterEl.textContent = letters[idx];
  if (textEl) textEl.textContent = state.shuffledAnswers[idx];
  overlay.classList.add('visible');
  soundClick();
}

function forfeitOnHiddenTab() {
  if (!document.hidden) return;
  if (!screens.game.classList.contains('active')) return;
  clearQuestionTimer();
  closeAnswerConfirm();
  showToast('Смена вкладки — игра остановлена', 'yellow', 2800);
  endGame(false);
}

function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => {
    el.classList.toggle('active', k === name);
  });
  if (name !== 'game') {
    clearQuestionTimer();
    closeAnswerConfirm();
    state.timerPaused = false;
  }
}


/* 
   7. МЕНЮ — мини-лестница
 */
function buildMenu() {
  const container = document.getElementById('ladder-mini');
  container.innerHTML = '';

  PRIZES.forEach(p => {
    const item = document.createElement('div');
    const cls  = p.safe ? 'safe'
               : p.q >= 11 ? 'hard'
               : p.q >= 6  ? 'medium'
               : 'easy';
    item.className = `ladder-mini-item ${cls}`;
    item.innerHTML = `
      <span>${p.q < 10 ? '0' + p.q : p.q}</span>
      <span>${p.prize} pts${p.safe ? ' 🔒' : ''}</span>
    `;
    container.appendChild(item);
  });
}


/* 
   8. ЛЕСТНИЦА ПРИЗОВ (правая колонка в игре)
 */
function buildLadder() {
  const container = document.getElementById('ladder-list');
  container.innerHTML = '';

  PRIZES.forEach(p => {
    const item = document.createElement('div');
    item.className = 'ladder-item' + (p.safe ? ' safe-level' : '');
    item.id = `ladder-${p.q}`;
    item.innerHTML = `
      <span class="l-num">${p.q < 10 ? '0' + p.q : p.q}</span>
      <span class="l-prize">${p.prize}</span>
      ${p.safe ? '<span class="l-safe">🔒</span>' : ''}
    `;
    container.appendChild(item);
  });

  updateLadder();
}

function updateLadder() {
  const current = state.currentIdx + 1;
  PRIZES.forEach(p => {
    const el = document.getElementById(`ladder-${p.q}`);
    if (!el) return;
    el.classList.remove('current', 'passed');
    if (p.q === current) el.classList.add('current');
    if (p.q < current)  el.classList.add('passed');
  });

  // Найти текущий гарантированный приз (последний safe-level до текущего)
  let safe = '0';
  for (let i = current - 2; i >= 0; i--) {
    if (PRIZES[i] && PRIZES[i].safe) { safe = PRIZES[i].prize; break; }
  }
  state.safeAmount = safe;
  document.getElementById('safe-prize').textContent = safe + ' pts';
}


/* 
   9. ЗАГРУЗКА ВОПРОСА
 */

function shuffleAnswerOrder(originalCorrectIdx) {
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const q = state.questions[state.currentIdx];
  state.shuffledAnswers = order.map(i => q.answers[i]);
  state.shuffledCorrect = order.indexOf(originalCorrectIdx);
}

function loadQuestion() {
  state.busy           = false;
  state.selectedAnswer = null;

  const q   = state.questions[state.currentIdx];
  shuffleAnswerOrder(q.correct);
  const num = state.currentIdx + 1;
  const p   = PRIZES[state.currentIdx];

  // Хедер
  document.getElementById('q-num').textContent = `ВОПРОС ${num}`;

  const diffEl = document.getElementById('q-diff');
  diffEl.textContent  = q.difficulty === 'easy' ? 'ЛЁГКИЙ'
                      : q.difficulty === 'medium' ? 'СРЕДНИЙ'
                      : 'СЛОЖНЫЙ';
  diffEl.className    = `difficulty-badge pixel-text diff-${q.difficulty}`;

  const langEl = document.getElementById('q-lang');
  langEl.textContent  = q.lang.toUpperCase();

  document.getElementById('current-prize').textContent = p.prize + ' pts';
  updateLadder();

  // Вопрос
  document.getElementById('q-number-badge').textContent = (num < 10 ? '0' + num : num) + ' / 15';
  document.getElementById('question-text').textContent  = q.question;

  // Ответы (порядок случайный при каждом показе вопроса)
  const letters = ['A', 'B', 'C', 'D'];
  state.shuffledAnswers.forEach((ans, i) => {
    const btn    = document.getElementById(`ans-${i}`);
    const textEl = document.getElementById(`ans-text-${i}`);
    btn.className = 'answer-btn';
    btn.disabled  = false;
    btn.style.opacity = '1';
    btn.style.pointerEvents = '';
    btn.querySelector('.ans-letter').textContent = letters[i];
    textEl.textContent = ans;
  });

  // Сбросить состояние подсказки immunity (не убираем саму кнопку — она могла уже использоваться)
  state.hints.immunity_active = false;
  // Сбросить любые скрытые тексты от 50:50
  [0,1,2,3].forEach(i => {
    const textEl = document.getElementById(`ans-text-${i}`);
    if (textEl) { textEl.style.opacity = ''; textEl.style.transition = ''; }
    const btn = document.getElementById(`ans-${i}`);
    if (btn) {
      const letter = btn.querySelector('.ans-letter');
      if (letter) { letter.style.opacity = ''; letter.style.transition = ''; }
    }
  });

  startQuestionTimer();
}


/* 
   10. ПОДСКАЗКИ
 */

// ── 🛡 ПРАВО НА ОШИБКУ ──
function useImmunity() {
  if (state.hints.immunity || state.busy || state.selectedAnswer !== null) return;
  soundHint();
  state.hints.immunity        = true;
  state.hints.immunity_active = true;
  document.getElementById('hint-immunity').classList.add('used');
  showToast('🛡 ПРАВО НА ОШИБКУ АКТИВНО — следующая ошибка не засчитается!', 'cyan');
}

// ── ⚡ 50:50 ──
function useFiftyFifty() {
  if (state.hints.fiveOfifty || state.busy || state.selectedAnswer !== null) return;
  soundHint();
  state.hints.fiveOfifty = true;
  document.getElementById('hint-5050').classList.add('used');

  const correct = state.shuffledCorrect;

  // Выбираем 2 неверных для удаления
  const wrongs   = [0,1,2,3].filter(i => i !== correct);
  const toRemove = [...wrongs].sort(() => Math.random() - 0.5).slice(0, 2);

  toRemove.forEach(i => {
    const btn    = document.getElementById(`ans-${i}`);
    const textEl = document.getElementById(`ans-text-${i}`);
    // Скрываем текст и букву полностью — кнопка визуально "пустеет"
    btn.classList.add('eliminated');
    btn.disabled = true;
    btn.style.pointerEvents = 'none';
    textEl.style.opacity = '0';
    textEl.style.transition = 'opacity 0.4s ease';
    btn.querySelector('.ans-letter').style.opacity = '0';
    btn.querySelector('.ans-letter').style.transition = 'opacity 0.4s ease';
  });
  showToast('⚡ 50:50 — два неверных ответа убраны!', 'cyan');
}

// ── 👥 ПОМОЩЬ ЗАЛА ──
function useAudience() {
  if (state.hints.audience || state.busy || state.selectedAnswer !== null) return;
  soundHint();
  state.hints.audience = true;
  document.getElementById('hint-audience').classList.add('used');

  const q       = state.questions[state.currentIdx];
  const correct = state.shuffledCorrect;

  // Генерируем реалистичное распределение голосов
  // Правильный ответ получает большинство, но не всегда
  const correctPct = q.difficulty === 'easy'   ? 60 + Math.floor(Math.random() * 30)
                   : q.difficulty === 'medium' ? 45 + Math.floor(Math.random() * 25)
                   : 30 + Math.floor(Math.random() * 30);

  const remaining = 100 - correctPct;
  const others    = [0,1,2,3].filter(i => i !== correct);

  // Распределяем оставшиеся % между остальными
  let left = remaining;
  const pcts = [0,0,0,0];
  pcts[correct] = correctPct;
  others.forEach((idx, i) => {
    if (i === others.length - 1) {
      pcts[idx] = left;
    } else {
      const share = Math.floor(Math.random() * left * 0.6);
      pcts[idx] = share;
      left -= share;
    }
  });

  // Показываем попап
  const popup     = document.getElementById('audience-popup');
  const barsEl    = document.getElementById('audience-bars');
  const letters   = ['A','B','C','D'];
  barsEl.innerHTML = '';

  popup.classList.add('visible');

  // Сначала 0%, потом анимируем
  pcts.forEach((pct, i) => {
    const row = document.createElement('div');
    row.className = 'audience-row';
    row.innerHTML = `
      <span class="audience-letter">${letters[i]}</span>
      <div class="audience-bar-wrap">
        <div class="audience-bar-fill" id="abar-${i}" style="width:0%"></div>
      </div>
      <span class="audience-pct">${pct}%</span>
    `;
    barsEl.appendChild(row);
  });

  // Анимируем заполнение
  setTimeout(() => {
    pcts.forEach((pct, i) => {
      document.getElementById(`abar-${i}`).style.width = pct + '%';
    });
  }, 100);
}

// ── 🔄 ЗАМЕНИТЬ ВОПРОС ──
function useSwap() {
  if (state.hints.swap || state.busy || state.selectedAnswer !== null) return;

  const q    = state.questions[state.currentIdx];
  const diff = q.difficulty;

  // Ищем вопрос того же уровня, отличный от текущего
  const pool = state.allQuestions.filter(x => x.difficulty === diff && x.id !== q.id);

  if (pool.length === 0) {
    showToast('🔄 Нет доступных вопросов для замены!', 'yellow');
    return;
  }

  soundHint();
  state.hints.swap = true;
  document.getElementById('hint-swap').classList.add('used');

  const replacement = pool[Math.floor(Math.random() * pool.length)];
  state.questions[state.currentIdx] = replacement;

  // Сбрасываем 50:50 визуально если было применено (новый вопрос — новые ответы)
  [0,1,2,3].forEach(i => {
    const btn = document.getElementById(`ans-${i}`);
    const textEl = document.getElementById(`ans-text-${i}`);
    if (textEl) { textEl.style.opacity = ''; textEl.style.transition = ''; }
    const letter = btn ? btn.querySelector('.ans-letter') : null;
    if (letter) { letter.style.opacity = ''; letter.style.transition = ''; }
  });

  loadQuestion();
  showToast('🔄 Вопрос заменён!', 'cyan');
}


/* 
   11. ОБРАБОТКА ОТВЕТА
 */
function handleAnswer(chosenIdx) {
  if (state.busy || state.selectedAnswer !== null) return;
  clearQuestionTimer();
  state.selectedAnswer = chosenIdx;
  state.busy = true;

  const q       = state.questions[state.currentIdx];
  const correct = state.shuffledCorrect;
  const btn     = document.getElementById(`ans-${chosenIdx}`);

  // Подсветить выбранный ответ
  btn.classList.add('selected');
  soundThink();

  // Драматическая пауза перед раскрытием
  setTimeout(() => {
    // Заблокировать все кнопки
    [0,1,2,3].forEach(i => {
      document.getElementById(`ans-${i}`).disabled = true;
    });

    if (chosenIdx === correct) {
      // ✅ ПРАВИЛЬНО
      btn.classList.remove('selected');
      btn.classList.add('correct');
      state.correctCount++;

      const isLast = state.currentIdx === 14;
      if (isLast) {
        soundFinal();
      } else if (PRIZES[state.currentIdx].safe) {
        soundSafe();
      } else {
        soundCorrect();
      }

      // Зал реагирует на правильный ответ — тёплый золотой свет
      if (AudienceSystem && AudienceSystem.setCorrect) AudienceSystem.setCorrect();

      showExplanation(true, q);

    } else {
      // ❌ НЕВЕРНО

      // Проверяем: активна ли защита?
      if (state.hints.immunity_active) {
        // Иммунитет спасает!
        soundHint();
        state.hints.immunity_active = false;
        btn.classList.remove('selected');
        btn.classList.add('wrong');
        // При праве на ошибку НЕ показываем правильный ответ.
        // Просто убираем неверный вариант и даем выбрать снова.
        setTimeout(() => {
          const wrongBtn = document.getElementById(`ans-${chosenIdx}`);
          const wrongText = document.getElementById(`ans-text-${chosenIdx}`);
          const wrongLetter = wrongBtn ? wrongBtn.querySelector('.ans-letter') : null;

          if (wrongBtn) {
            wrongBtn.classList.remove('wrong');
            wrongBtn.classList.add('eliminated');
            wrongBtn.disabled = true;
            wrongBtn.style.pointerEvents = 'none';
          }
          if (wrongText) {
            wrongText.style.opacity = '0';
            wrongText.style.transition = 'opacity 0.35s ease';
          }
          if (wrongLetter) {
            wrongLetter.style.opacity = '0';
            wrongLetter.style.transition = 'opacity 0.35s ease';
          }

          showToast('🛡 Неверный вариант убран. Выбери ответ снова!', 'cyan', 2200);

          // Разблокируем только оставшиеся варианты
          [0,1,2,3].forEach(i => {
            const b = document.getElementById(`ans-${i}`);
            if (!b || i === chosenIdx) return;
            b.classList.remove('selected', 'wrong', 'correct');
            if (!b.classList.contains('eliminated')) {
              b.disabled = false;
              b.style.pointerEvents = '';
            }
          });

          state.selectedAnswer = null;
          state.busy = false;
        }, 650);

      } else {
        // Нет иммунитета — конец
        btn.classList.remove('selected');
        btn.classList.add('wrong');
        document.getElementById(`ans-${correct}`).classList.add('correct');
        state.wrongCount++;
        soundWrong();
        // Зал реагирует на неправильный ответ — холодный тёмный свет с флicker
        if (AudienceSystem && AudienceSystem.setWrong) AudienceSystem.setWrong();
        showExplanation(false, q);
      }
    }
  }, 1200);
}


/* 
   12. ПОЯСНЕНИЕ
 */
function showExplanation(isCorrect, q) {
  const popup  = document.getElementById('explanation-popup');
  const inner  = popup.querySelector('.explanation-inner');
  const icon   = document.getElementById('exp-icon');
  const title  = document.getElementById('exp-title');
  const text   = document.getElementById('exp-text');
  const btnNext = document.getElementById('btn-next');

  inner.className = 'explanation-inner ' + (isCorrect ? 'correct-exp' : 'wrong-exp');

  if (isCorrect) {
    const isLast = state.currentIdx === 14;
    icon.textContent  = isLast ? '🏆' : '✅';
    title.textContent = isLast ? '[ ПОБЕДА! 1000 ОЧКОВ! ]' : '[ ВЕРНО! ]';
    title.style.color = 'var(--green)';
  } else {
    icon.textContent  = '❌';
    title.textContent = '[ НЕВЕРНО ]';
    title.style.color = 'var(--pink)';
  }

  text.textContent = q.explanation;

  const isLast = state.currentIdx === 14;
  btnNext.textContent = isLast || !isCorrect
    ? '[ ПОСМОТРЕТЬ ИТОГ ]'
    : '[ СЛЕДУЮЩИЙ ВОПРОС ]';

  popup.classList.add('visible');
}


/* 
   13. СЛЕДУЮЩИЙ ВОПРОС / ИТОГ
 */
function proceedAfterExplanation() {
  const popup   = document.getElementById('explanation-popup');
  popup.classList.remove('visible');

  const isCorrect = state.selectedAnswer === state.shuffledCorrect;
  const isLast    = state.currentIdx === 14;

  if (!isCorrect) {
    // Проигрыш
    endGame(false);
    return;
  }

  if (isLast) {
    // Победа — последний вопрос
    endGame(true);
    return;
  }

  // Переходим к следующему
  state.currentIdx++;
  loadQuestion();
}


/* 
   14. КОНЕЦ ИГРЫ
 */
function endGame(won) {
  showScreen('result');

  const reached   = state.currentIdx + 1;
  const prizeData = PRIZES[state.currentIdx];

  let finalPrize;
  if (won) {
    finalPrize = PRIZES[14].prize;
  } else {
    finalPrize = state.safeAmount || '0';
  }

  const elapsedMs = Math.max(0, Date.now() - (state.startedAtMs || Date.now()));
  submitScore('millionaire', {
    reached: reached,
    won: !!won,
    elapsed_ms: elapsedMs,
  }).then(res => {
    if (!res) return;
    if (typeof res.total_game_score === 'number') {
      showToast(`🏆 Очки добавлены! Всего в игре: ${res.total_game_score}`, 'yellow', 3000);
    } else if (res.is_record) {
      showToast('🏆 Новый рекорд!', 'yellow', 3000);
    }
  });
  const lbEl = document.getElementById('lb-millionaire');
  if (lbEl) renderLeaderboard(lbEl, 'millionaire', 5);

  const emoji   = won           ? '🏆'
                : reached <= 5  ? '😢'
                : reached <= 10 ? '😤'
                : '😎';

  document.getElementById('r-emoji').textContent   = emoji;
  document.getElementById('r-title').textContent   = won ? '[ ПОБЕДИТЕЛЬ! ]' : '[ ИГРА ОКОНЧЕНА ]';
  document.getElementById('r-title').style.color   = won ? 'var(--yellow)' : 'var(--pink)';
  document.getElementById('r-prize').textContent   = finalPrize + ' pts';
  document.getElementById('r-correct').textContent = state.correctCount;
  document.getElementById('r-wrong').textContent   = state.wrongCount;
  document.getElementById('r-reached').textContent = reached;

  if (won) soundFinal(); else soundLose();
}


/* 
   ТОСТ
 */
function showToast(msg, type = 'info', duration = 2500) {
  // Используем простой div поверх всего
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    font-family:'Press Start 2P',monospace; font-size:9px;
    padding:12px 24px; border:1px solid; background:rgba(8,12,20,0.97);
    z-index:999; letter-spacing:1px; text-align:center;
    animation: none; white-space:nowrap;
    ${type === 'cyan'   ? 'color:var(--cyan);  border-color:var(--cyan);  box-shadow:0 0 20px rgba(0,229,255,0.3);'   : ''}
    ${type === 'yellow' ? 'color:var(--yellow);border-color:var(--yellow);box-shadow:0 0 20px rgba(245,216,0,0.3);' : ''}
    ${type === 'green'  ? 'color:var(--green); border-color:var(--green); box-shadow:0 0 20px rgba(57,255,20,0.3);'  : ''}
    ${type === 'pink'   ? 'color:var(--pink);  border-color:var(--pink);  box-shadow:0 0 20px rgba(255,77,109,0.3);' : ''}
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.4s';
    setTimeout(() => el.remove(), 400);
  }, duration);
}


/* 
   15. КНОПКИ И КЛАВИШИ
 */

// Старт игры
document.getElementById('btn-play').addEventListener('click', async () => {
  soundClick();
  pingGame('millionaire');
  buildQuestionSet();

  // Сбросить состояние
  state.currentIdx     = 0;
  state.correctCount   = 0;
  state.wrongCount     = 0;
  state.selectedAnswer = null;
  state.busy           = false;
  state.safeAmount     = '0';
  state.hints.immunity        = false;
  state.hints.immunity_active = false;
  state.hints.fiveOfifty      = false;
  state.hints.audience        = false;
  state.hints.swap            = false;
  state.startedAtMs           = Date.now();

  // Сбросить кнопки подсказок
  ['hint-immunity','hint-5050','hint-audience','hint-swap'].forEach(id => {
    document.getElementById(id).classList.remove('used');
    document.getElementById(id).disabled = false;
  });

  buildLadder();
  loadQuestion();
  showScreen('game');
});

// Ответы — сначала подтверждение, затем проверка
[0,1,2,3].forEach(i => {
  document.getElementById(`ans-${i}`).addEventListener('click', () => openAnswerConfirm(i));
});

const acYes = document.getElementById('ac-yes');
const acNo = document.getElementById('ac-no');
if (acYes) {
  acYes.addEventListener('click', () => {
    if (pendingAnswerIdx === null) return;
    const idx = pendingAnswerIdx;
    closeAnswerConfirm();
    soundSelect();
    handleAnswer(idx);
  });
}
if (acNo) {
  acNo.addEventListener('click', () => {
    soundClick();
    closeAnswerConfirm();
  });
}

// Подсказки
document.getElementById('hint-immunity').addEventListener('click', () => useImmunity());
document.getElementById('hint-5050').addEventListener('click',    () => useFiftyFifty());
document.getElementById('hint-audience').addEventListener('click', () => useAudience());
document.getElementById('hint-swap').addEventListener('click',     () => useSwap());

// Закрыть попап зала
document.getElementById('audience-close').addEventListener('click', () => {
  soundClick();
  document.getElementById('audience-popup').classList.remove('visible');
});

// Кнопка «Следующий вопрос» в пояснении
document.getElementById('btn-next').addEventListener('click', () => {
  soundClick();
  proceedAfterExplanation();
});

// ESC
document.getElementById('btn-esc').addEventListener('click', () => {
  soundClick();
  showScreen('menu');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const ac = document.getElementById('answer-confirm');
    if (ac && ac.classList.contains('visible')) {
      soundClick();
      closeAnswerConfirm();
      return;
    }
    soundClick();
    if (screens.menu.classList.contains('active')) {
      window.location.href = '../../index.html';
    } else {
      showScreen('menu');
    }
  }
  if (e.key === 'Enter' || e.key === ' ') {
    const popup = document.getElementById('explanation-popup');
    if (popup.classList.contains('visible')) { soundClick(); proceedAfterExplanation(); }
  }
});

// Результат
document.getElementById('btn-retry').addEventListener('click', async () => {
  soundClick();
  // Перезапуск — как btn-play
  document.getElementById('btn-play').click();
});
document.getElementById('btn-menu-res').addEventListener('click', () => {
  soundClick();
  showScreen('menu');
});


/* 
   16. ЗАПУСК
 */
async function init() {
  await loadQuestions();
  buildMenu();
  showScreen('menu');

  const lbEl = document.getElementById('lb-millionaire');
  if (lbEl) renderLeaderboard(lbEl, 'millionaire', 5);
}

document.addEventListener('visibilitychange', forfeitOnHiddenTab);

init();
