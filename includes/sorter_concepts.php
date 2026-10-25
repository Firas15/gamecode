<?php
/**
 * Понятия «Сортировщика»: текст на блоке, правильная корзина, подсказка,
 * сложность. Раньше лежали в games/sorter/js/game.js вместе с ответами,
 * теперь их читает только сервер (includes/sorter.php).
 */
return array (
  0 => 
  array (
    'text' => 'print()',
    'cat' => 'functions',
    'hint' => 'print() — выводит данные на экран',
    'level' => 1,
  ),
  1 => 
  array (
    'text' => 'len()',
    'cat' => 'functions',
    'hint' => 'len() — возвращает длину объекта',
    'level' => 1,
  ),
  2 => 
  array (
    'text' => 'input()',
    'cat' => 'functions',
    'hint' => 'input() — получает ввод от пользователя',
    'level' => 1,
  ),
  3 => 
  array (
    'text' => 'range()',
    'cat' => 'functions',
    'hint' => 'range() — генерирует последовательность чисел',
    'level' => 1,
  ),
  4 => 
  array (
    'text' => 'int()',
    'cat' => 'functions',
    'hint' => 'int() — преобразует значение в целое число',
    'level' => 1,
  ),
  5 => 
  array (
    'text' => 'str()',
    'cat' => 'functions',
    'hint' => 'str() — преобразует значение в строку',
    'level' => 1,
  ),
  6 => 
  array (
    'text' => 'type()',
    'cat' => 'functions',
    'hint' => 'type() — возвращает тип объекта',
    'level' => 2,
  ),
  7 => 
  array (
    'text' => 'list()',
    'cat' => 'functions',
    'hint' => 'list() — создаёт список',
    'level' => 2,
  ),
  8 => 
  array (
    'text' => 'sum()',
    'cat' => 'functions',
    'hint' => 'sum() — сумма всех элементов',
    'level' => 2,
  ),
  9 => 
  array (
    'text' => 'max()',
    'cat' => 'functions',
    'hint' => 'max() — наибольшее значение',
    'level' => 2,
  ),
  10 => 
  array (
    'text' => 'min()',
    'cat' => 'functions',
    'hint' => 'min() — наименьшее значение',
    'level' => 2,
  ),
  11 => 
  array (
    'text' => 'sorted()',
    'cat' => 'functions',
    'hint' => 'sorted() — возвращает отсортированный список',
    'level' => 3,
  ),
  12 => 
  array (
    'text' => 'enumerate()',
    'cat' => 'functions',
    'hint' => 'enumerate() — добавляет счётчик к итерируемому',
    'level' => 3,
  ),
  13 => 
  array (
    'text' => 'zip()',
    'cat' => 'functions',
    'hint' => 'zip() — объединяет несколько итерируемых',
    'level' => 3,
  ),
  14 => 
  array (
    'text' => 'map()',
    'cat' => 'functions',
    'hint' => 'map() — применяет функцию к каждому элементу',
    'level' => 3,
  ),
  15 => 
  array (
    'text' => 'filter()',
    'cat' => 'functions',
    'hint' => 'filter() — отбирает элементы по условию',
    'level' => 3,
  ),
  16 => 
  array (
    'text' => 'round()',
    'cat' => 'functions',
    'hint' => 'round() — округляет число до нужной точности',
    'level' => 2,
  ),
  17 => 
  array (
    'text' => 'abs()',
    'cat' => 'functions',
    'hint' => 'abs() — возвращает модуль числа',
    'level' => 2,
  ),
  18 => 
  array (
    'text' => 'any()',
    'cat' => 'functions',
    'hint' => 'any() — True, если хотя бы один элемент истинен',
    'level' => 3,
  ),
  19 => 
  array (
    'text' => 'all()',
    'cat' => 'functions',
    'hint' => 'all() — True, если все элементы истинны',
    'level' => 3,
  ),
  20 => 
  array (
    'text' => '+',
    'cat' => 'operators',
    'hint' => '+ — сложение или конкатенация строк',
    'level' => 1,
  ),
  21 => 
  array (
    'text' => '-',
    'cat' => 'operators',
    'hint' => '- — вычитание',
    'level' => 1,
  ),
  22 => 
  array (
    'text' => '*',
    'cat' => 'operators',
    'hint' => '* — умножение',
    'level' => 1,
  ),
  23 => 
  array (
    'text' => '/',
    'cat' => 'operators',
    'hint' => '/ — деление (результат всегда float)',
    'level' => 1,
  ),
  24 => 
  array (
    'text' => '==',
    'cat' => 'operators',
    'hint' => '== — проверка на равенство',
    'level' => 1,
  ),
  25 => 
  array (
    'text' => '=',
    'cat' => 'operators',
    'hint' => '= — присваивание значения переменной',
    'level' => 1,
  ),
  26 => 
  array (
    'text' => '//',
    'cat' => 'operators',
    'hint' => '// — целочисленное деление (без остатка)',
    'level' => 2,
  ),
  27 => 
  array (
    'text' => '%',
    'cat' => 'operators',
    'hint' => '% — остаток от деления',
    'level' => 2,
  ),
  28 => 
  array (
    'text' => '**',
    'cat' => 'operators',
    'hint' => '** — возведение в степень',
    'level' => 2,
  ),
  29 => 
  array (
    'text' => '!=',
    'cat' => 'operators',
    'hint' => '!= — не равно',
    'level' => 2,
  ),
  30 => 
  array (
    'text' => '+=',
    'cat' => 'operators',
    'hint' => '+= — сложение с присваиванием (x += 1)',
    'level' => 2,
  ),
  31 => 
  array (
    'text' => 'in',
    'cat' => 'operators',
    'hint' => 'in — проверяет вхождение в коллекцию',
    'level' => 3,
  ),
  32 => 
  array (
    'text' => 'not in',
    'cat' => 'operators',
    'hint' => 'not in — проверяет отсутствие в коллекции',
    'level' => 3,
  ),
  33 => 
  array (
    'text' => 'is',
    'cat' => 'operators',
    'hint' => 'is — проверяет идентичность объектов',
    'level' => 3,
  ),
  34 => 
  array (
    'text' => 'is not',
    'cat' => 'operators',
    'hint' => 'is not — проверяет, что объекты не идентичны',
    'level' => 3,
  ),
  35 => 
  array (
    'text' => '<=',
    'cat' => 'operators',
    'hint' => '<= — меньше или равно',
    'level' => 1,
  ),
  36 => 
  array (
    'text' => '>=',
    'cat' => 'operators',
    'hint' => '>= — больше или равно',
    'level' => 1,
  ),
  37 => 
  array (
    'text' => '*=',
    'cat' => 'operators',
    'hint' => '*= — умножение с присваиванием (x *= 2)',
    'level' => 2,
  ),
  38 => 
  array (
    'text' => '/=',
    'cat' => 'operators',
    'hint' => '/= — деление с присваиванием (x /= 2)',
    'level' => 2,
  ),
  39 => 
  array (
    'text' => 'int',
    'cat' => 'data_types',
    'hint' => 'int — целое число, например: 42',
    'level' => 1,
  ),
  40 => 
  array (
    'text' => 'float',
    'cat' => 'data_types',
    'hint' => 'float — число с точкой, например: 3.14',
    'level' => 1,
  ),
  41 => 
  array (
    'text' => 'str',
    'cat' => 'data_types',
    'hint' => 'str — строка, например: "Hello"',
    'level' => 1,
  ),
  42 => 
  array (
    'text' => 'bool',
    'cat' => 'data_types',
    'hint' => 'bool — логический тип: True или False',
    'level' => 1,
  ),
  43 => 
  array (
    'text' => 'list',
    'cat' => 'data_types',
    'hint' => 'list — изменяемый список: [1, 2, 3]',
    'level' => 1,
  ),
  44 => 
  array (
    'text' => 'True',
    'cat' => 'data_types',
    'hint' => 'True — булево значение «истина»',
    'level' => 1,
  ),
  45 => 
  array (
    'text' => 'False',
    'cat' => 'data_types',
    'hint' => 'False — булево значение «ложь»',
    'level' => 1,
  ),
  46 => 
  array (
    'text' => 'tuple',
    'cat' => 'data_types',
    'hint' => 'tuple — неизменяемый кортеж: (1, 2, 3)',
    'level' => 2,
  ),
  47 => 
  array (
    'text' => 'dict',
    'cat' => 'data_types',
    'hint' => 'dict — словарь пар ключ–значение: {"a": 1}',
    'level' => 2,
  ),
  48 => 
  array (
    'text' => 'set',
    'cat' => 'data_types',
    'hint' => 'set — множество уникальных элементов',
    'level' => 2,
  ),
  49 => 
  array (
    'text' => 'None',
    'cat' => 'data_types',
    'hint' => 'None — отсутствие значения',
    'level' => 2,
  ),
  50 => 
  array (
    'text' => 'complex',
    'cat' => 'data_types',
    'hint' => 'complex — комплексное число: 3+4j',
    'level' => 3,
  ),
  51 => 
  array (
    'text' => 'frozenset',
    'cat' => 'data_types',
    'hint' => 'frozenset — неизменяемое множество',
    'level' => 3,
  ),
  52 => 
  array (
    'text' => 'bytes',
    'cat' => 'data_types',
    'hint' => 'bytes — последовательность байтов',
    'level' => 3,
  ),
  53 => 
  array (
    'text' => 'bytearray',
    'cat' => 'data_types',
    'hint' => 'bytearray — изменяемая последовательность байтов',
    'level' => 3,
  ),
  54 => 
  array (
    'text' => 'memoryview',
    'cat' => 'data_types',
    'hint' => 'memoryview — доступ к буферу без копирования',
    'level' => 3,
  ),
  55 => 
  array (
    'text' => 'for',
    'cat' => 'loops',
    'hint' => 'for — цикл перебора элементов',
    'level' => 1,
  ),
  56 => 
  array (
    'text' => 'while',
    'cat' => 'loops',
    'hint' => 'while — цикл, пока условие истинно',
    'level' => 1,
  ),
  57 => 
  array (
    'text' => 'for i in range():',
    'cat' => 'loops',
    'hint' => 'for i in range() — цикл со счётчиком',
    'level' => 1,
  ),
  58 => 
  array (
    'text' => 'for x in list:',
    'cat' => 'loops',
    'hint' => 'for x in list: — перебор элементов списка',
    'level' => 1,
  ),
  59 => 
  array (
    'text' => 'break',
    'cat' => 'loops',
    'hint' => 'break — выход из цикла',
    'level' => 2,
  ),
  60 => 
  array (
    'text' => 'continue',
    'cat' => 'loops',
    'hint' => 'continue — пропуск текущей итерации',
    'level' => 2,
  ),
  61 => 
  array (
    'text' => 'pass',
    'cat' => 'loops',
    'hint' => 'pass — заглушка, ничего не делает',
    'level' => 2,
  ),
  62 => 
  array (
    'text' => 'else in loop',
    'cat' => 'loops',
    'hint' => 'else в цикле — выполняется, если цикл не прерван break',
    'level' => 3,
  ),
  63 => 
  array (
    'text' => 'while True:',
    'cat' => 'loops',
    'hint' => 'while True: — бесконечный цикл, прервать break',
    'level' => 3,
  ),
  64 => 
  array (
    'text' => 'for k,v in d.items():',
    'cat' => 'loops',
    'hint' => 'перебор пар ключ–значение словаря',
    'level' => 3,
  ),
  65 => 
  array (
    'text' => 'for i, x in enumerate(list):',
    'cat' => 'loops',
    'hint' => 'перебор списка с индексом и значением',
    'level' => 2,
  ),
  66 => 
  array (
    'text' => 'if',
    'cat' => 'conditions',
    'hint' => 'if — условное выполнение блока',
    'level' => 1,
  ),
  67 => 
  array (
    'text' => 'else',
    'cat' => 'conditions',
    'hint' => 'else — блок при ложном условии',
    'level' => 1,
  ),
  68 => 
  array (
    'text' => 'elif',
    'cat' => 'conditions',
    'hint' => 'elif — дополнительное условие (else if)',
    'level' => 1,
  ),
  69 => 
  array (
    'text' => 'and',
    'cat' => 'conditions',
    'hint' => 'and — логическое «и»: оба условия должны быть истинны',
    'level' => 1,
  ),
  70 => 
  array (
    'text' => 'or',
    'cat' => 'conditions',
    'hint' => 'or — логическое «или»: хотя бы одно истинно',
    'level' => 1,
  ),
  71 => 
  array (
    'text' => 'not',
    'cat' => 'conditions',
    'hint' => 'not — инвертирует булево значение',
    'level' => 2,
  ),
  72 => 
  array (
    'text' => 'if x > 0:',
    'cat' => 'conditions',
    'hint' => 'пример условной конструкции',
    'level' => 2,
  ),
  73 => 
  array (
    'text' => 'if x in arr:',
    'cat' => 'conditions',
    'hint' => 'проверка, что элемент содержится в коллекции',
    'level' => 2,
  ),
  74 => 
  array (
    'text' => 'if x is None:',
    'cat' => 'conditions',
    'hint' => 'проверка, что переменная не содержит значение',
    'level' => 2,
  ),
  75 => 
  array (
    'text' => 'try/except',
    'cat' => 'conditions',
    'hint' => 'try/except — обработка исключений (ошибок)',
    'level' => 3,
  ),
  76 => 
  array (
    'text' => 'match/case',
    'cat' => 'conditions',
    'hint' => 'match/case — сопоставление с образцом (Python 3.10+)',
    'level' => 3,
  ),
  77 => 
  array (
    'text' => 'try/except/finally',
    'cat' => 'conditions',
    'hint' => 'finally — блок, который выполнится всегда',
    'level' => 3,
  ),
  78 => 
  array (
    'text' => 'if ... else ...',
    'cat' => 'conditions',
    'hint' => 'тернарный оператор: value_if_true if cond else value_if_false',
    'level' => 3,
  ),
);
