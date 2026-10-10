-- Programme content for 2026/27 (October 2026), from the track calendars in Drive.
--
-- * Each track links to its "Материалы для участников" folder; each week to its own
--   "Неделя N" folder there (the reserve weeks to the track folder).
-- * Every week gets its assignment: the lesson, the practicum, the official course pages
--   (CS50 AI, USACO Guide, Full Stack Open) and what to hand in.
-- * The year starts on Monday 5 October 2026 and all 36 weeks are scheduled; the director moves
--   holidays and the end of the year with "shift schedule".
-- * The competitions of the track calendars become draft events in their weeks: staff set the
--   day, time and the person responsible, then confirm. Members see nothing until then.
-- * One pinned welcome post explains how the Hub works.
--
-- Nothing already filled in is overwritten: a link, assignment or schedule entered in the Hub
-- stays as it is.

update public.tracks t
set drive_url = coalesce(t.drive_url, c.url)
from (values
  ('ai', 'https://drive.google.com/drive/folders/1WTcRCoVkow5hM8nPpgcV1E4_99a9iA_N'),
  ('algo', 'https://drive.google.com/drive/folders/1qMmG7C8oqSBZAL1GFQtkgA5HTPNsdG3H'),
  ('startup', 'https://drive.google.com/drive/folders/1g47np_t2LgJCtR0WveCKik46Lva6Dik2')
) as c(track_id, url)
where t.id = c.track_id;

update public.program_weeks w
set materials_url = coalesce(w.materials_url, c.materials_url),
    assignment    = coalesce(w.assignment, c.assignment)
from (values
  ('ai', 1, 'https://drive.google.com/drive/folders/1P8je0I45pMR1tx0GFqn90VLxyHkxWbcl',
$c$Занятие: диагностика; Colab; типы; списки, словари, множества; загрузка и обработка данных.
Практикум: стартовый блокнот с данными.
Сдать: ссылку на свой блокнот в Colab с доступом «Все, у кого есть ссылка».$c$),
  ('ai', 2, 'https://drive.google.com/drive/folders/1NmpgPF7mLjDqpfI0-iSh-zDh_AKhq9UQ',
$c$Занятие: функции и рекурсия; чтение чужих классов; CSV; copy.deepcopy.
Практикум: переход в cs50.dev — файлы .py, терминал, аргументы командной строки, check50 на учебной задаче.
Среда: https://cs50.dev
Сдать: ссылку на репозиторий с учебной задачей, которая проходит check50.$c$),
  ('ai', 3, 'https://drive.google.com/drive/folders/1-kpHq8SwVkBI5VXwW0Lqv0j46lJ34Fjz',
$c$Занятие: состояние, действие, модель перехода; DFS и BFS; полнота и оптимальность.
Практикум: DFS и BFS на учебном графе.
Конспект лекции: https://cs50.harvard.edu/ai/notes/0/
Сдать: ссылку на свой код DFS и BFS.$c$),
  ('ai', 4, 'https://drive.google.com/drive/folders/1zJ_jJW6bgBNM98BzutKRppRDYG6ZG_GR',
$c$Занятие: поиск на реальных данных; восстановление пути.
Практикум: Degrees — загрузка данных, соседи вершины.
Конспект лекции: https://cs50.harvard.edu/ai/notes/0/
Проект CS50: https://cs50.harvard.edu/ai/projects/0/degrees/
Сдать: ссылку на репозиторий с текущей версией Degrees.$c$),
  ('ai', 5, 'https://drive.google.com/drive/folders/1hJlOzCo4UjM2bewyiLAePmLOaWt9wr0e',
$c$Занятие: размер пространства состояний; почему здесь BFS.
Практикум: Degrees — завершение и check50.
Проект CS50: https://cs50.harvard.edu/ai/projects/0/degrees/
Сдать: ссылку на репозиторий с готовым Degrees.
Засчитывается, если проходит check50, открыт руководителю, в конце указано, чем вы пользовались (документация, чужой код, ИИ), и вы можете объяснить свой код.$c$),
  ('ai', 6, 'https://drive.google.com/drive/folders/1YX79_OT-40xPDNB8fBLEkM859TcTAAwK',
$c$Занятие: информированный поиск, эвристика, A*; минимакс, альфа-бета.
Практикум: минимакс на небольшом дереве — вручную и в коде.
Конспект лекции: https://cs50.harvard.edu/ai/notes/0/
Сдать: ссылку на свой код минимакса.$c$),
  ('ai', 7, 'https://drive.google.com/drive/folders/1-1pH86ze30Qh0c6oOxS1wFri8El9-E0C',
$c$Занятие: игра как задача поиска: состояние, действия, результат.
Практикум: Tic-Tac-Toe — функции игры.
Проект CS50: https://cs50.harvard.edu/ai/projects/0/tictactoe/
Сдать: ссылку на репозиторий с текущей версией Tic-Tac-Toe.$c$),
  ('ai', 8, 'https://drive.google.com/drive/folders/1No4GgSab7ohb6L5joLL5LMyxti0MFgpA',
$c$Занятие: минимакс в проекте; проверка стратегии.
Практикум: Tic-Tac-Toe — минимакс и check50.
Проект CS50: https://cs50.harvard.edu/ai/projects/0/tictactoe/
Турнир недели: турнир ботов: игры.
Сдать: ссылку на репозиторий с готовым Tic-Tac-Toe.
Засчитывается, если проходит check50, открыт руководителю, в конце указано, чем вы пользовались (документация, чужой код, ИИ), и вы можете объяснить свой код.$c$),
  ('ai', 9, 'https://drive.google.com/drive/folders/1gCUF8R15uQzabMYo-OWv8vJCWyjd8KCC',
$c$Занятие: высказывания и связки; модель; следование; проверка моделей.
Практикум: запись утверждений на языке логики.
Конспект лекции: https://cs50.harvard.edu/ai/notes/1/
Сдать: ссылку на файл с утверждениями.$c$),
  ('ai', 10, 'https://drive.google.com/drive/folders/1-iPwyiYEiUnQ8oxxF0BANbOIMl11lH3L',
$c$Занятие: вывод через проверку моделей.
Практикум: Knights.
Конспект лекции: https://cs50.harvard.edu/ai/notes/1/
Проект CS50: https://cs50.harvard.edu/ai/projects/1/knights/
Сдать: ссылку на репозиторий с готовым Knights.
Засчитывается, если проходит check50, открыт руководителю, в конце указано, чем вы пользовались (документация, чужой код, ИИ), и вы можете объяснить свой код.$c$),
  ('ai', 11, 'https://drive.google.com/drive/folders/1sLg0MJWu96pi3nXOSEgaND8XdLjCcuOJ',
$c$Занятие: база знаний агента; правила вывода; резолюция.
Практикум: Minesweeper — класс Sentence.
Конспект лекции: https://cs50.harvard.edu/ai/notes/1/
Проект CS50: https://cs50.harvard.edu/ai/projects/1/minesweeper/
Сдать: ссылку на репозиторий с классом Sentence.$c$),
  ('ai', 12, 'https://drive.google.com/drive/folders/1vMzpO_idiylXYXKvhaBl7gHNy1VwphGL',
$c$Занятие: обновление знаний; выбор безопасного хода.
Практикум: Minesweeper — завершение и check50.
Проект CS50: https://cs50.harvard.edu/ai/projects/1/minesweeper/
Сдать: ссылку на репозиторий с готовым Minesweeper.
Засчитывается, если проходит check50, открыт руководителю, в конце указано, чем вы пользовались (документация, чужой код, ИИ), и вы можете объяснить свой код.$c$),
  ('ai', 13, 'https://drive.google.com/drive/folders/1a-B6Rowlg7sqwQ-Ir9vwNmipV4I1IuL6',
$c$Занятие: случайная величина; условная вероятность; правило Байеса; совместное распределение.
Практикум: задачи на вероятность в коде.
Конспект лекции: https://cs50.harvard.edu/ai/notes/2/
Сдать: ссылку на свои решения.$c$),
  ('ai', 14, 'https://drive.google.com/drive/folders/14E9tMPTSaRGq0NFprywvixdNDWhCw2AL',
$c$Занятие: байесовская сеть, вывод, выборка.
Практикум: Heredity — совместная вероятность.
Конспект лекции: https://cs50.harvard.edu/ai/notes/2/
Проект CS50: https://cs50.harvard.edu/ai/projects/2/heredity/
Сдать: ссылку на репозиторий с функцией совместной вероятности.$c$),
  ('ai', 15, 'https://drive.google.com/drive/folders/1itsLrs5mhfJv2WJDGFnJIpy_7ICSXaEM',
$c$Занятие: обновление и нормализация распределений.
Практикум: Heredity — завершение и check50.
Проект CS50: https://cs50.harvard.edu/ai/projects/2/heredity/
Сдать: ссылку на репозиторий с готовым Heredity.
Засчитывается, если проходит check50, открыт руководителю, в конце указано, чем вы пользовались (документация, чужой код, ИИ), и вы можете объяснить свой код.$c$),
  ('ai', 16, 'https://drive.google.com/drive/folders/1qcZ7kPNydXzBzf7O7ouxlHUuGKDjDq2q',
$c$Занятие: марковское свойство; матрица переходов; стационарное распределение; скрытые марковские модели.
Практикум: PageRank — модель перехода и выборка.
Конспект лекции: https://cs50.harvard.edu/ai/notes/2/
Проект CS50: https://cs50.harvard.edu/ai/projects/2/pagerank/
Сдать: ссылку на репозиторий с моделью перехода и выборкой.$c$),
  ('ai', 17, 'https://drive.google.com/drive/folders/18RBkwcUqz63h99PstoggbIkJRkFMP8SK',
$c$Занятие: итеративный метод; сравнение с выборкой.
Практикум: PageRank — итерация и check50.
Проект CS50: https://cs50.harvard.edu/ai/projects/2/pagerank/
Сдать: ссылку на репозиторий с готовым PageRank.
Засчитывается, если проходит check50, открыт руководителю, в конце указано, чем вы пользовались (документация, чужой код, ИИ), и вы можете объяснить свой код.$c$),
  ('ai', 18, 'https://drive.google.com/drive/folders/12Zf2zolip2FdupMxPDdeAVyewoYomCD6',
$c$Занятие: локальный поиск; восхождение к вершине; имитация отжига; линейное программирование.
Практикум: задачи на локальный поиск.
Конспект лекции: https://cs50.harvard.edu/ai/notes/3/
Сдать: ссылку на свои решения.$c$),
  ('ai', 19, 'https://drive.google.com/drive/folders/1sFxqTncBhIaLNI2-PHlFQkkOk_6wzyCu',
$c$Занятие: переменные и домены; согласованность дуг; поиск с возвратом.
Практикум: задача с ограничениями на учебном примере.
Конспект лекции: https://cs50.harvard.edu/ai/notes/3/
Сдать: ссылку на своё решение учебной задачи.$c$),
  ('ai', 20, 'https://drive.google.com/drive/folders/1KfXnat2GZNQuJYHFzOCw0D8yVGh-zOt1',
$c$Занятие: согласованность в проекте.
Практикум: Crossword — согласованность вершин и дуг.
Проект CS50: https://cs50.harvard.edu/ai/projects/3/crossword/
Сдать: ссылку на репозиторий с текущей версией Crossword.$c$),
  ('ai', 21, 'https://drive.google.com/drive/folders/1su7ccaAcienCUGsT0bkf7p4JT3Z4q5J2',
$c$Занятие: эвристики выбора переменной и значения.
Практикум: Crossword — поиск с возвратом и check50.
Проект CS50: https://cs50.harvard.edu/ai/projects/3/crossword/
Турнир недели: турнир на скорость: задачи с ограничениями.
Сдать: ссылку на репозиторий с готовым Crossword.
Засчитывается, если проходит check50, открыт руководителю, в конце указано, чем вы пользовались (документация, чужой код, ИИ), и вы можете объяснить свой код.$c$),
  ('ai', 22, 'https://drive.google.com/drive/folders/1uQjdXQUT3mvcfkTz0JD192bxdNy5og2_',
$c$Занятие: классификация; ближайшие соседи; регрессия; обучающая и тестовая выборки; метрики качества.
Практикум: Shopping — загрузка и подготовка данных.
Конспект лекции: https://cs50.harvard.edu/ai/notes/4/
Проект CS50: https://cs50.harvard.edu/ai/projects/4/shopping/
Сдать: ссылку на репозиторий с загрузкой и подготовкой данных.$c$),
  ('ai', 23, 'https://drive.google.com/drive/folders/1u97XWO0vNyE-Prrq1Du6WRNb97-aXOSd',
$c$Занятие: чувствительность и специфичность; сравнение с базовым решением.
Практикум: Shopping — обучение, оценка и check50.
Проект CS50: https://cs50.harvard.edu/ai/projects/4/shopping/
Сдать: ссылку на репозиторий с готовым Shopping.
Засчитывается, если проходит check50, открыт руководителю, в конце указано, чем вы пользовались (документация, чужой код, ИИ), и вы можете объяснить свой код.$c$),
  ('ai', 24, 'https://drive.google.com/drive/folders/1tqRHqHq4qYli_FYLqFu7bmYW2KTy3CUQ',
$c$Занятие: награды; Q-learning; исследование и использование; кластеризация.
Практикум: Q-learning на учебном примере.
Конспект лекции: https://cs50.harvard.edu/ai/notes/4/
Сдать: ссылку на свой код.$c$),
  ('ai', 25, 'https://drive.google.com/drive/folders/1B7IV7nHXujIZufzePJS2D-KXOjJf2XJ5',
$c$Занятие: Q-learning в проекте.
Практикум: Nim.
Проект CS50: https://cs50.harvard.edu/ai/projects/4/nim/
Турнир недели: турнир ботов: игры с обучением.
Сдать: ссылку на репозиторий с готовым Nim.
Засчитывается, если проходит check50, открыт руководителю, в конце указано, чем вы пользовались (документация, чужой код, ИИ), и вы можете объяснить свой код.$c$),
  ('ai', 26, 'https://drive.google.com/drive/folders/132E9JVPzJ3aGyqEhgMSCLpdwCnmK-Ec-',
$c$Занятие: нейрон и активация; градиентный спуск; многослойные сети; обратное распространение; переобучение.
Практикум: простая сеть в TensorFlow.
Конспект лекции: https://cs50.harvard.edu/ai/notes/5/
Сдать: ссылку на блокнот или код с сетью.$c$),
  ('ai', 27, 'https://drive.google.com/drive/folders/1SS7_uD1o5STB2fw5RaS5bQkPkIfY4Hnw',
$c$Занятие: изображение как данные; свёртка; пулинг; свёрточные сети.
Практикум: свёрточная сеть на учебном датасете.
Конспект лекции: https://cs50.harvard.edu/ai/notes/5/
Сдать: ссылку на блокнот или код со свёрточной сетью.$c$),
  ('ai', 28, 'https://drive.google.com/drive/folders/1p68uEhAQDe-P-pYx6wJQzvy14doF1AG8',
$c$Занятие: подготовка изображений; выбор архитектуры.
Практикум: Traffic — загрузка данных и первая модель.
Проект CS50: https://cs50.harvard.edu/ai/projects/5/traffic/
Сдать: ссылку на репозиторий с загрузкой данных и первой моделью.$c$),
  ('ai', 29, 'https://drive.google.com/drive/folders/1cuxL3jM93m-JdgVqzgwvoEn3u4KSxVgn',
$c$Занятие: эксперименты с архитектурой.
Практикум: Traffic — эксперименты, README и check50.
Проект CS50: https://cs50.harvard.edu/ai/projects/5/traffic/
Турнир недели: турнир переговоров.
Сдать: ссылку на репозиторий с готовым Traffic и README об экспериментах.
Засчитывается, если проходит check50, открыт руководителю, в конце указано, чем вы пользовались (документация, чужой код, ИИ), и вы можете объяснить свой код.$c$),
  ('ai', 30, 'https://drive.google.com/drive/folders/1WMRRg_yBcS5ipA7VzZaMpYZa4sjiUp4Y',
$c$Занятие: контекстно-свободные грамматики; синтаксический анализ; nltk.
Практикум: разбор предложений в nltk.
Конспект лекции: https://cs50.harvard.edu/ai/notes/6/
Сдать: ссылку на свой код.$c$),
  ('ai', 31, 'https://drive.google.com/drive/folders/1uDtzKZrZNx0Jd5lT1_6ndbUhGplmCfvn',
$c$Занятие: грамматика и именные группы.
Практикум: Parser.
Конспект лекции: https://cs50.harvard.edu/ai/notes/6/
Проект CS50: https://cs50.harvard.edu/ai/projects/6/parser/
Сдать: ссылку на репозиторий с готовым Parser.
Засчитывается, если проходит check50, открыт руководителю, в конце указано, чем вы пользовались (документация, чужой код, ИИ), и вы можете объяснить свой код.$c$),
  ('ai', 32, 'https://drive.google.com/drive/folders/1JFfP2RTKTtDspmkUBToOdSVztaBaPMbV',
$c$Занятие: мешок слов; наивный Байес; векторные представления слов.
Практикум: опыты с векторами слов.
Конспект лекции: https://cs50.harvard.edu/ai/notes/6/
Сдать: ссылку на блокнот или код.$c$),
  ('ai', 33, 'https://drive.google.com/drive/folders/1ZKzWF5C8LnlmywVEzpGBmANYclljmnaU',
$c$Занятие: механизм внимания; трансформер; маскированная языковая модель.
Практикум: Attention — предсказание пропущенного слова.
Конспект лекции: https://cs50.harvard.edu/ai/notes/6/
Проект CS50: https://cs50.harvard.edu/ai/projects/6/attention/
Сдать: ссылку на репозиторий с предсказанием пропущенного слова.$c$),
  ('ai', 34, 'https://drive.google.com/drive/folders/1uOSPQcgX86qGIjGGW1ouN0dYGRkDLQ63',
$c$Занятие: визуализация внимания; анализ голов.
Практикум: Attention — анализ и check50.
Проект CS50: https://cs50.harvard.edu/ai/projects/6/attention/
Сдать: ссылку на репозиторий с готовым Attention.
Засчитывается, если проходит check50, открыт руководителю, в конце указано, чем вы пользовались (документация, чужой код, ИИ), и вы можете объяснить свой код.$c$),
  ('ai', 35, 'https://drive.google.com/drive/folders/1WTcRCoVkow5hM8nPpgcV1E4_99a9iA_N',
$c$Резервная неделя: новой темы нет.
Доделайте и сдайте проекты CS50, которые ещё не засчитаны: для сертификата нужны все двенадцать.
Сдать: ссылку на репозиторий с проектом, который сдаёте на этой неделе.
Засчитывается, если проходит check50, открыт руководителю, в конце указано, чем вы пользовались (документация, чужой код, ИИ), и вы можете объяснить свой код.$c$),
  ('ai', 36, 'https://drive.google.com/drive/folders/1WTcRCoVkow5hM8nPpgcV1E4_99a9iA_N',
$c$Резервная неделя: новой темы нет.
Доделайте и сдайте проекты CS50, которые ещё не засчитаны: для сертификата нужны все двенадцать.
Сдать: ссылку на репозиторий с проектом, который сдаёте на этой неделе.
Засчитывается, если проходит check50, открыт руководителю, в конце указано, чем вы пользовались (документация, чужой код, ИИ), и вы можете объяснить свой код.$c$),
  ('algo', 1, 'https://drive.google.com/drive/folders/1R5JD2GG1C8Qr9tUWVSGGBIsQAhdLnhn_',
$c$Навык недели: выбрать тип по ограничениям, заметить переполнение.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/general/data-types
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 2, 'https://drive.google.com/drive/folders/12OiMS419kVsFtqBnmpb38FUu0-0FaVmP',
$c$Навык недели: по таблице ограничений оценить число операций до того, как писать код.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/bronze/time-comp
USACO Guide: https://usaco.guide/bronze/intro-complete
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 3, 'https://drive.google.com/drive/folders/1N_m_jKUfbLQzjCYHB5XtKq2nWsn8gbz9',
$c$Навык недели: разобрать задачу вслух перед группой.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/silver/prefix-sums
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 4, 'https://drive.google.com/drive/folders/1AMvy-xB6q-L-gVWrvTC5VZKTNnwTBzwK',
$c$Навык недели: проверить, что компаратор задаёт строгий порядок.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/bronze/intro-sorting
USACO Guide: https://usaco.guide/silver/sorting-custom
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 5, 'https://drive.google.com/drive/folders/1hpchVW7n8BnyjxQNDFB2DlmUoNQKfms7',
$c$Навык недели: найти монотонность, на которой держится поиск.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/silver/binary-search
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 6, 'https://drive.google.com/drive/folders/19JjmFQXDApPgXDAmhYSegBPglcCusDuQ',
$c$Навык недели: доказать, что указатель не нужно возвращать назад.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/silver/two-pointers
USACO Guide: https://usaco.guide/gold/sliding-window
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 7, 'https://drive.google.com/drive/folders/1DRoDQMGexUwFqeB9ePcdDcl7M64TJD7c',
$c$Навык недели: выбрать структуру по нужным операциям и их стоимости.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/bronze/intro-sets
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 8, 'https://drive.google.com/drive/folders/1ZPXBSpdYjYtzAfOqY9J8lpBd9FJzKYsT',
$c$Навык недели: доказать жадность или найти контрпример.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
Контест клуба: первый рейтинговый контест. Правила объявят заранее.
USACO Guide: https://usaco.guide/bronze/intro-greedy
USACO Guide: https://usaco.guide/silver/greedy-sorting
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 9, 'https://drive.google.com/drive/folders/1CAVYO88tpUqQm5k1iVwbgk373N9Gzez3',
$c$Навык недели: дорешивание и разбор своих ошибок.
Новой темы нет: дорешивание и разбор своих ошибок за блок.
Контест клуба: итоги блока.
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 10, 'https://drive.google.com/drive/folders/1f5_7VHBEwnpwjVTsSo-5pPsih48fkOrp',
$c$Навык недели: сформулировать инвариант структуры.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/gold/stacks
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 11, 'https://drive.google.com/drive/folders/1HmYzl3Gjxf3TKpdOeoCSRemFfDt2GPJd',
$c$Навык недели: оценить размер дерева перебора и найти отсечения.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/bronze/complete-rec
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 12, 'https://drive.google.com/drive/folders/1DdwmIQYJMw6YOIymAaNT4sFpg_KxOAVT',
$c$Навык недели: увидеть граф в задаче, где он не назван.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/bronze/intro-graphs
USACO Guide: https://usaco.guide/silver/dfs
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 13, 'https://drive.google.com/drive/folders/1TjfRMjDQy_hNDfOTwklkKEWzpm-0WKhn',
$c$Навык недели: построить граф состояний.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
Контест клуба: контест клуба.
USACO Guide: https://usaco.guide/gold/unweighted-shortest-paths
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 14, 'https://drive.google.com/drive/folders/1xSuXKe9OLcH_5lAa8hOGfHzvfdTuhXbP',
$c$Навык недели: проверить решение на крайних случаях.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/silver/dfs
USACO Guide: https://usaco.guide/gold/toposort
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 15, 'https://drive.google.com/drive/folders/18m6sSdIA-SlUZYGu4_BTVk4zm9aNQlKy',
$c$Навык недели: сформулировать состояние и переход.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/gold/intro-dp
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 16, 'https://drive.google.com/drive/folders/1POtU_9haYNNfbid0Sw0Y3xKtg4OnoZdP',
$c$Навык недели: восстановить ответ, а не только значение.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/gold/knapsack
USACO Guide: https://usaco.guide/gold/lis
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 17, 'https://drive.google.com/drive/folders/1XL5uHG0l7icHAh3OfZjQqDoipnzzrVkM',
$c$Навык недели: собрать генератор и наивное решение, найти ошибку сравнением.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/general/debugging-checklist
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 18, 'https://drive.google.com/drive/folders/1oq0nAOU8FKpipZm47wYYbRrl-OZrs0Bx',
$c$Навык недели: дорешивание и разбор своих ошибок.
Новой темы нет: дорешивание и разбор своих ошибок за блок.
Контест клуба: итоги блока.
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 19, 'https://drive.google.com/drive/folders/1O68z08yh05p_P50DYJLi17v_ac0ViGrk',
$c$Навык недели: оценить сложность с эвристиками.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/gold/dsu
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 20, 'https://drive.google.com/drive/folders/1Wq5vuRulTCk8JDaKERtev0QkJNcDGmvz',
$c$Навык недели: понять, почему алгоритм не работает с отрицательными весами.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/gold/shortest-paths
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 21, 'https://drive.google.com/drive/folders/1pdEQtP3QIjXehqM_p5qZJ8M23yq9lzZT',
$c$Навык недели: выбрать, что хранить в вершине.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/gold/PURS
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 22, 'https://drive.google.com/drive/folders/1YwRuhfUrEoCsYiEn3bDhjz-Q5m5xedQj',
$c$Навык недели: отладить отложенные операции стресс-тестом.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
Контест клуба: контест клуба.
USACO Guide: https://usaco.guide/plat/RURQ
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 23, 'https://drive.google.com/drive/folders/1MY6l7_dWc5gKZ_AJegauzH7KBfusUbE-',
$c$Навык недели: выбрать порядок вычисления состояний.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/gold/dp-ranges
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 24, 'https://drive.google.com/drive/folders/1SAfhuNCfqkZTuyhKFSLlnk6Rca9bXOj8',
$c$Навык недели: оценить 2ⁿ·n по ограничениям.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/gold/dp-bitmasks
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 25, 'https://drive.google.com/drive/folders/18xRMKGXkBHjkEJcibWqsyvw9z_GEloPP',
$c$Навык недели: проверить формулу на малых n перебором.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/gold/modular
USACO Guide: https://usaco.guide/gold/combo
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 26, 'https://drive.google.com/drive/folders/1hcO7IBzoKtdk3D547Yy-boWDE39-AeKn',
$c$Навык недели: оценить сложность разложения и решета.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/gold/divisibility
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 27, 'https://drive.google.com/drive/folders/1bSyeORKRfx2XwmuJEGNAMBmXkUHi1YfX',
$c$Навык недели: дорешивание и разбор своих ошибок.
Новой темы нет: дорешивание и разбор своих ошибок за блок.
Контест клуба: итоги блока.
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 28, 'https://drive.google.com/drive/folders/1zBR3nONkvkrgcnn_vQ_TtXrEnHQhl6cE',
$c$Навык недели: оценить вероятность коллизии.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/gold/hashing
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 29, 'https://drive.google.com/drive/folders/1h8q_cX05CGb9kCqlUjpTAiyCR5CQLYmF',
$c$Навык недели: доказать линейное время.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/adv/string-search
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 30, 'https://drive.google.com/drive/folders/1Ye6K6o6umVF6SVx_Xhx_GVd7HEKGRC5V',
$c$Навык недели: свести задачу на дереве к запросам.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/plat/binary-jump
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 31, 'https://drive.google.com/drive/folders/1gzOXfu7QjB1AT1aTGnh-SxFNOcb5n9iO',
$c$Навык недели: избежать ошибок точности: целые числа вместо дробных.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
Контест клуба: контест клуба.
USACO Guide: https://usaco.guide/plat/geo-pri
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 32, 'https://drive.google.com/drive/folders/10_IZ6Y441Et9tRnYrbOyREkOrDkB49oP',
$c$Навык недели: ускорить решение, которое проходит на грани.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/silver/intro-bitwise
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 33, 'https://drive.google.com/drive/folders/11A_PxHcZLUxoFmTB-63V97zijTgRF2A9',
$c$Навык недели: разобрать чужой протокол контеста по минутам.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
USACO Guide: https://usaco.guide/general/contest-strategy
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 34, 'https://drive.google.com/drive/folders/1RLWlXd-DrUXACZuHji6d5p-L49I959Lw',
$c$Навык недели: разобрать задачу вслух перед группой.
Практикум: контест-день по теме недели в группе клуба на Codeforces.
Обязательно: 5 задач по теме и дорешивание после контеста.
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 35, 'https://drive.google.com/drive/folders/1urPpPmfBj7ooAUMyemyXjYppIEiXYsXz',
$c$Итоговый контест года в группе клуба на Codeforces.
После контеста — разбор и дорешивание.
Сдать: ссылку на свой профиль CSES или Codeforces, где видны задачи недели.$c$),
  ('algo', 36, 'https://drive.google.com/drive/folders/1_sOoidY8ZVqxKEnEwqlLgfLEtEu4rcvf',
$c$Навык недели: составить свой план задач на лето.
Практикум: разбор итогового контеста.
Обязательно: дорешивание итогового контеста.
USACO Guide: https://usaco.guide/general/practicing
Сдать: ссылку на свой план задач на лето.$c$),
  ('startup', 1, 'https://drive.google.com/drive/folders/1D80WfVh6Me2srPWtYMdWWzmUL-WiZ8G0',
$c$Часть 1 — от проблемы до продукта с клиентами.
Занятие: диагностика; чем стартап отличается от обычного бизнеса; откуда берутся проблемы.
Практикум: список проблем из собственной жизни.
LaunchX: Foundation.
Сдать: ссылку на документ со списком проблем.$c$),
  ('startup', 2, 'https://drive.google.com/drive/folders/1JNCUkod5uvOxu9ByNhleSyJyKfdeDTzz',
$c$Занятие: изменения, неудобства, пробелы в рынке; приёмы генерации идей; канва стратегии.
Практикум: карта возможностей и идеи под них.
LaunchX: Opportunity Identification; Workshop Ideation; Blue Ocean.
Сдать: ссылку на карту возможностей с идеями.$c$),
  ('startup', 3, 'https://drive.google.com/drive/folders/1FeC4Hp5SLrEjSmjchkPzU1cqbEDE0SKy',
$c$Занятие: вопросы о прошлом поведении, а не о мнениях; как разбить проблему на части.
Практикум: сценарий интервью, репетиция в парах.
LaunchX: Customer Discovery; Needs Assessment; Think Like a Consultant; Problem Solving.
Сдать: ссылку на сценарий интервью.$c$),
  ('startup', 4, 'https://drive.google.com/drive/folders/1gMZc0yXyD-3IJLRmSSMi42kDqhS9dwKI',
$c$Занятие: закономерности и противоречия в ответах; когда проблему нужно менять.
Практикум: разбор интервью; команда решает, продолжать или менять проблему.
Событие недели: симуляция поиска клиентов.
LaunchX: Workshop Customer Discovery.
Сдать: ссылку на разбор интервью и решение команды.$c$),
  ('startup', 5, 'https://drive.google.com/drive/folders/1oMjKlwTZThphYV_iv6cJOl-P4j9A9iLu',
$c$Занятие: канва ценностного предложения; как страница доходит до браузера; первые компоненты React.
Практикум: лендинг с ценностным предложением.
LaunchX: Live review — Value Proposition; Business Model Ideation.
Full Stack Open, части 0, 1:
https://fullstackopen.com/en/part0/
https://fullstackopen.com/en/part1/
Сдать: ссылку на репозиторий лендинга.$c$),
  ('startup', 6, 'https://drive.google.com/drive/folders/18EGRTuxrG7s9ASJFyU121dv5-FowwGlS',
$c$Занятие: что считать подтверждением спроса; формы и состояние в React; публикация на Vercel.
Практикум: форма заявки, публикация, первые заявки.
Событие недели: кейс «Проверка гипотезы».
LaunchX: Proof of Concept; Testing Your Offering.
Full Stack Open, часть 1:
https://fullstackopen.com/en/part1/
Сдать: ссылку на опубликованный лендинг с формой; в комментарии — сколько пришло заявок.$c$),
  ('startup', 7, 'https://drive.google.com/drive/folders/1EiguGhsqwPe9sYLWjqzIEpqft8kgNzZx',
$c$Занятие: роли и договорённости; Git, ветки, pull request; доска задач.
Практикум: репозиторий и доска задач команды.
LaunchX: Communication; Project Management Tools.
Сдать: ссылки на репозиторий и доску задач команды.$c$),
  ('startup', 8, 'https://drive.google.com/drive/folders/1JJuDt25MZd6DztqdrCKOuu-iJoTm01yO',
$c$Занятие: шаги пользователя от входа до результата; экраны и навигация.
Практикум: экраны продукта по пути пользователя.
LaunchX: Prototyping; Rapid Prototyping; Workshop Prototyping.
Full Stack Open, части 1, 7:
https://fullstackopen.com/en/part1/
https://fullstackopen.com/en/part7/
Сдать: ссылку на экраны продукта — макет или код.$c$),
  ('startup', 9, 'https://drive.google.com/drive/folders/1NUobmktXS0MHtfERpwOvRmmnJzno3arJ',
$c$Занятие: что продукт должен знать о клиенте и зачем; Supabase: база данных и авторизация.
Практикум: регистрация и хранение данных.
Full Stack Open, часть 2:
https://fullstackopen.com/en/part2/
Сдать: ссылку на продукт с работающей регистрацией.$c$),
  ('startup', 10, 'https://drive.google.com/drive/folders/1t68rh4606PED-YaUidE0hHsfImqvDOHE',
$c$Занятие: чем именно продукт решает проблему; запросы к данным.
Практикум: главная функция работает.
Full Stack Open, часть 2:
https://fullstackopen.com/en/part2/
Сдать: ссылку на продукт, где работает главная функция.$c$),
  ('startup', 11, 'https://drive.google.com/drive/folders/1-joAv5TKqV14bkX4iVAs70Kiv4cDVlwo',
$c$Занятие: минимальный набор функций; что вырезать, чтобы успеть.
Практикум: сборка MVP.
LaunchX: MVP.
Сдать: ссылку на MVP.$c$),
  ('startup', 12, 'https://drive.google.com/drive/folders/14QuHHhjmM07abm57z4bpXqY7u8_b9x6O',
$c$Занятие: где взять первых десять пользователей; первое знакомство с продуктом.
Практикум: запуск, первые отзывы.
LaunchX: Defining Success.
Сдать: ссылку на документ с первыми отзывами пользователей.$c$),
  ('startup', 13, 'https://drive.google.com/drive/folders/1k2jgL_Ia7FLgr2IB8DRko8Ws75CaS6Gp',
$c$Занятие: какие цифры доказывают ценность; события и воронка в PostHog.
Практикум: события в своём продукте.
LaunchX: Defining Success.
Сдать: ссылку на воронку в PostHog или на документ с цифрами.$c$),
  ('startup', 14, 'https://drive.google.com/drive/folders/1bjTi2LJPC717a0vjxhosdUeE-9FlYCQt',
$c$Занятие: модели цены; разговор о покупке; приём оплаты в продукте.
Практикум: первая оплата.
LaunchX: Pricing; Intro to Sales.
Сдать: ссылку на документ: что купили, кто и за сколько.$c$),
  ('startup', 15, 'https://drive.google.com/drive/folders/1NdP6v8EVdnuCQKTqddbw-KhSCy2lMPhF',
$c$Занятие: решение по данным и отзывам, а не по мнению.
Практикум: изменения по отзывам и метрикам.
Сдать: ссылку на список изменений и данные, на которых они основаны.$c$),
  ('startup', 16, 'https://drive.google.com/drive/folders/1KSAFapmtYLc0QIRZ_zVI8TJO_T0qAZ82',
$c$Занятие: структура питча; как показывать работающий продукт.
Практикум: питч и демо команд.
Событие недели: питч-разбор 1.
LaunchX: Pitching Fundamentals; Pitch Feedback 1.
Сдать: ссылки на питч-дек и демо.$c$),
  ('startup', 17, 'https://drive.google.com/drive/folders/1lPcSDLkNJEbSGiq8svef24ytIbdJ4HVa',
$c$Часть 2 — рост.
Занятие: признаки того, что продукт нужен рынку; удержание по когортам.
Практикум: удержание своего продукта.
LaunchX: Product Market Fit.
Сдать: ссылку на расчёт удержания по когортам.$c$),
  ('startup', 18, 'https://drive.google.com/drive/folders/189GzCXlfo0uMEDPRD0nuLDKKCKjQeH4t',
$c$Занятие: гипотеза роста; A/B-тест; когда результату можно верить.
Практикум: A/B-тест в своём продукте.
Сдать: ссылку на описание A/B-теста и его результат.$c$),
  ('startup', 19, 'https://drive.google.com/drive/folders/1eR051T1E5uwNitUTiIMTYA7WGmvgKBZ2',
$c$Занятие: стоимость привлечения и доход с клиента на данных своего продукта.
Практикум: расчёт для своего продукта.
Событие недели: кейс «Юнит-экономика».
LaunchX: Financial Feasibility.
Сдать: ссылку на расчёт юнит-экономики.$c$),
  ('startup', 20, 'https://drive.google.com/drive/folders/1o-XwBAvcFEx5nFBRH1gAnEkBAC2c8NPh',
$c$Занятие: прогноз выручки и расходов на год; пересмотр цены.
Практикум: прогноз своей команды.
Событие недели: кейс «Ценообразование».
LaunchX: Pricing; Workshop Pricing; Financial Forecasts; Workshop Financial Forecasts.
Сдать: ссылку на финансовый прогноз на год.$c$),
  ('startup', 21, 'https://drive.google.com/drive/folders/14Qh5RtXQLIqh2YJphTMoA_OHDxqwLTa_',
$c$Занятие: воронка продаж; возражения; учёт заявок в продукте.
Практикум: разбор своих продаж.
Событие недели: симуляция продаж.
LaunchX: Intro to Sales; Closing the Sale.
Сдать: ссылку на разбор продаж: воронка, возражения, что меняете.$c$),
  ('startup', 22, 'https://drive.google.com/drive/folders/1uPUH_v5_y_eIQzMdjL_mlWFnVx5KAScO',
$c$Занятие: интересы сторон, уступки, альтернатива сделке.
Практикум: переговоры по карточкам ролей.
Событие недели: переговоры.
LaunchX: Closing the Sale.
Сдать: ссылку на итоги переговоров: о чём договорились и почему.$c$),
  ('startup', 23, 'https://drive.google.com/drive/folders/1AGWwxAfb8y3vjK6FP4EzsZvzsLIDxj8p',
$c$Занятие: воронка привлечения; реферальная механика и поисковая оптимизация в продукте.
Практикум: эксперимент с одним каналом.
LaunchX: Marketing Funnel; Marketing Materials.
Сдать: ссылку на результаты эксперимента с каналом.$c$),
  ('startup', 24, 'https://drive.google.com/drive/folders/13Ufbw91lQjQqCV7Ujxb25QWYn7-qArRH',
$c$Занятие: план выхода на рынок; продуктовый и рыночный план; трекшн.
Практикум: план выхода своей команды.
Событие недели: питч-разбор 2.
LaunchX: Workshop Go-To-Market; Product & Market Plans; Traction; Pitch Feedback 2.
Сдать: ссылку на план выхода на рынок.$c$),
  ('startup', 25, 'https://drive.google.com/drive/folders/1rg2IuTEAdYf0OJO_1hVBXq5loRu07Skl',
$c$Занятие: ошибки, которые видят пользователи; автоматические тесты.
Практикум: тесты главной функции.
Full Stack Open, часть 5:
https://fullstackopen.com/en/part5/
Сдать: ссылку на репозиторий с тестами главной функции.$c$),
  ('startup', 26, 'https://drive.google.com/drive/folders/1fpNx67Om2OWffbKByZU-7VvIcMzlvRS3',
$c$Занятие: TypeScript; проверка каждого изменения до публикации.
Практикум: TypeScript и CI в своём продукте.
Full Stack Open, части 9, 11:
https://fullstackopen.com/en/part9/
https://fullstackopen.com/en/part11/
Сдать: ссылку на репозиторий с TypeScript и CI.$c$),
  ('startup', 27, 'https://drive.google.com/drive/folders/1NaA37gre1IQrug5Exz8-jy1ICZBRFslx',
$c$Занятие: когда продукту нужно приложение; React Native и Expo.
Практикум: мобильная версия главной функции.
Full Stack Open, часть 10:
https://fullstackopen.com/en/part10/
Сдать: ссылку на мобильную версию или её репозиторий.$c$),
  ('startup', 28, 'https://drive.google.com/drive/folders/1BWHMB5yY9PVD0Xx0HgToVY0rVES6-i19',
$c$Занятие: где ИИ добавляет ценность продукту и работе команды.
Практикум: ИИ-функция в своём продукте.
LaunchX: Leveraging AI.
Сдать: ссылку на продукт с ИИ-функцией.$c$),
  ('startup', 29, 'https://drive.google.com/drive/folders/1_TDbbG19y8lihVXbQpkKGHL_BMR_bJAJ',
$c$Занятие: доступ к данным; права в базе; что обещать пользователю.
Практикум: проверка безопасности своего продукта.
LaunchX: Operations Assessment.
Full Stack Open, часть 4:
https://fullstackopen.com/en/part4/
Сдать: ссылку на результаты проверки: что нашли и что исправили.$c$),
  ('startup', 30, 'https://drive.google.com/drive/folders/1nKJc_zXhfs-ZqjY4598khXNfsLDgAOHF',
$c$Занятие: процессы; найм; устойчивость и влияние продукта.
Практикум: план команды.
Событие недели: питч-разбор 3.
LaunchX: Talent Acquisition; Logistics; Sustainability and Impact; Pitch Feedback 3.
Сдать: ссылку на план команды.$c$),
  ('startup', 31, 'https://drive.google.com/drive/folders/1A3AYn3Rc5CA8ItRHGpk8vFflyVPKjr4y',
$c$Занятие: регистрация, договоры, интеллектуальная собственность.
Практикум: разбор типового договора.
LaunchX: Legal Considerations.
Сдать: ссылку на разбор договора.$c$),
  ('startup', 32, 'https://drive.google.com/drive/folders/1ZVyBr7flEwVagkyejP1lb9kLF-5bmCBX',
$c$Занятие: как думает инвестор; гранты и акселераторы; стратегии выхода; итоговые финансы.
Практикум: итоговые финансы команды.
LaunchX: Intro to Investing; Exit Strategies; Finalizing Financials.
Сдать: ссылку на итоговые финансы.$c$),
  ('startup', 33, 'https://drive.google.com/drive/folders/1QJmWwqQ0K7Ua13p2-fQrUcIeN-ypMHkh',
$c$Занятие: что показывать на слайдах; питч в видео для конкурсов.
Практикум: дек и видео своей команды.
LaunchX: Live review — Pitch Deck; Workshop Create Your Pitch Video.
Сдать: ссылки на питч-дек и видео.$c$),
  ('startup', 34, 'https://drive.google.com/drive/folders/127VRbeVRHPbOg13HfhMxsNOptUf8wDPl',
$c$Занятие: ответы на вопросы жюри.
Практикум: полный прогон с вопросами.
Событие недели: питч-разбор 4.
LaunchX: Pitch Feedback 4.
Сдать: ссылку на итоговый питч-дек.$c$),
  ('startup', 35, 'https://drive.google.com/drive/folders/1g47np_t2LgJCtR0WveCKik46Lva6Dik2',
$c$Резервная неделя: новой темы нет.
Команда доводит продукт и готовится к конкурсам школьных стартапов.
Сдать: ссылку на то, что команда доработала за неделю.$c$),
  ('startup', 36, 'https://drive.google.com/drive/folders/1g47np_t2LgJCtR0WveCKik46Lva6Dik2',
$c$Резервная неделя: новой темы нет.
Команда доводит продукт и готовится к конкурсам школьных стартапов.
Сдать: ссылку на то, что команда доработала за неделю.$c$)
) as c(track_id, week_number, materials_url, assignment)
where w.track_id = c.track_id and w.week_number = c.week_number;

-- Week 1 = Monday 5 October 2026.
insert into public.cohort_weeks (cohort_id, week_number, starts_on)
select public.default_cohort_id(), n, date '2026-10-05' + (n - 1) * 7
from generate_series(1, 36) as n
where not exists (select 1 from public.cohort_weeks where cohort_id = public.default_cohort_id());

-- Drafts on the Monday of their week, 15:00 Petropavl time (UTC+5); staff set the real slot.
-- Not a staff action, so the audit log stays out of it.
alter table public.events disable trigger trg_events_after_write;

insert into public.events (type, title, track_id, starts_at, description, status)
select e.type, e.title, e.track_id, (cw.starts_on::text || ' 15:00+05')::timestamptz, e.description, 'draft'
from (values
  (8, 'contest', 'algo', 'Первый рейтинговый контест',
$c$Черновик из календаря курса (неделя 8). День, время, место и ответственного уточните перед подтверждением.

Контест в группе клуба на Codeforces, после него — разбор и дорешивание. Чтобы событие меняло рейтинг направления, отметьте его рейтинговым и опубликуйте правила до начала.$c$),
  (9, 'contest', 'algo', 'Контест клуба: итоги блока',
$c$Черновик из календаря курса (неделя 9). День, время, место и ответственного уточните перед подтверждением.

Контест в группе клуба на Codeforces, после него — разбор и дорешивание. Чтобы событие меняло рейтинг направления, отметьте его рейтинговым и опубликуйте правила до начала.$c$),
  (13, 'contest', 'algo', 'Контест клуба',
$c$Черновик из календаря курса (неделя 13). День, время, место и ответственного уточните перед подтверждением.

Контест в группе клуба на Codeforces, после него — разбор и дорешивание. Чтобы событие меняло рейтинг направления, отметьте его рейтинговым и опубликуйте правила до начала.$c$),
  (18, 'contest', 'algo', 'Контест клуба: итоги блока',
$c$Черновик из календаря курса (неделя 18). День, время, место и ответственного уточните перед подтверждением.

Контест в группе клуба на Codeforces, после него — разбор и дорешивание. Чтобы событие меняло рейтинг направления, отметьте его рейтинговым и опубликуйте правила до начала.$c$),
  (22, 'contest', 'algo', 'Контест клуба',
$c$Черновик из календаря курса (неделя 22). День, время, место и ответственного уточните перед подтверждением.

Контест в группе клуба на Codeforces, после него — разбор и дорешивание. Чтобы событие меняло рейтинг направления, отметьте его рейтинговым и опубликуйте правила до начала.$c$),
  (27, 'contest', 'algo', 'Контест клуба: итоги блока',
$c$Черновик из календаря курса (неделя 27). День, время, место и ответственного уточните перед подтверждением.

Контест в группе клуба на Codeforces, после него — разбор и дорешивание. Чтобы событие меняло рейтинг направления, отметьте его рейтинговым и опубликуйте правила до начала.$c$),
  (31, 'contest', 'algo', 'Контест клуба',
$c$Черновик из календаря курса (неделя 31). День, время, место и ответственного уточните перед подтверждением.

Контест в группе клуба на Codeforces, после него — разбор и дорешивание. Чтобы событие меняло рейтинг направления, отметьте его рейтинговым и опубликуйте правила до начала.$c$),
  (35, 'contest', 'algo', 'Итоговый контест',
$c$Черновик из календаря курса (неделя 35). День, время, место и ответственного уточните перед подтверждением.

Контест в группе клуба на Codeforces, после него — разбор и дорешивание. Чтобы событие меняло рейтинг направления, отметьте его рейтинговым и опубликуйте правила до начала.$c$),
  (8, 'tournament', 'ai', 'Турнир ботов: игры',
$c$Черновик из календаря курса (неделя 8). День, время, место и ответственного уточните перед подтверждением.

Программы участников соревнуются друг с другом. Судейский скрипт должен быть готов за две недели до турнира. Чтобы событие меняло рейтинг направления, отметьте его рейтинговым и опубликуйте правила до начала.$c$),
  (21, 'tournament', 'ai', 'Турнир на скорость: задачи с ограничениями',
$c$Черновик из календаря курса (неделя 21). День, время, место и ответственного уточните перед подтверждением.

Программы участников соревнуются друг с другом. Судейский скрипт должен быть готов за две недели до турнира. Чтобы событие меняло рейтинг направления, отметьте его рейтинговым и опубликуйте правила до начала. Время не меряется: считается число шагов или всё запускается на одной машине.$c$),
  (25, 'tournament', 'ai', 'Турнир ботов: игры с обучением',
$c$Черновик из календаря курса (неделя 25). День, время, место и ответственного уточните перед подтверждением.

Программы участников соревнуются друг с другом. Судейский скрипт должен быть готов за две недели до турнира. Чтобы событие меняло рейтинг направления, отметьте его рейтинговым и опубликуйте правила до начала.$c$),
  (29, 'tournament', 'ai', 'Турнир переговоров',
$c$Черновик из календаря курса (неделя 29). День, время, место и ответственного уточните перед подтверждением.

Программы участников соревнуются друг с другом. Судейский скрипт должен быть готов за две недели до турнира. Чтобы событие меняло рейтинг направления, отметьте его рейтинговым и опубликуйте правила до начала.$c$),
  (4, 'simulation', 'startup', 'Симуляция поиска клиентов',
$c$Черновик из календаря курса (неделя 4). День, время, место и ответственного уточните перед подтверждением.

Все получают одинаковый кейс и предлагают свои решения.$c$),
  (6, 'simulation', 'startup', 'Кейс: проверка гипотезы',
$c$Черновик из календаря курса (неделя 6). День, время, место и ответственного уточните перед подтверждением.

Все получают одинаковый кейс и предлагают свои решения.$c$),
  (16, 'pitch_review', 'startup', 'Питч-разбор 1',
$c$Черновик из календаря курса (неделя 16). День, время, место и ответственного уточните перед подтверждением.

Каждая команда питчит свой проект и получает обратную связь. Чтобы событие меняло рейтинг направления, отметьте его рейтинговым и опубликуйте правила до начала.$c$),
  (19, 'simulation', 'startup', 'Кейс: юнит-экономика',
$c$Черновик из календаря курса (неделя 19). День, время, место и ответственного уточните перед подтверждением.

Все получают одинаковый кейс и предлагают свои решения.$c$),
  (20, 'simulation', 'startup', 'Кейс: ценообразование',
$c$Черновик из календаря курса (неделя 20). День, время, место и ответственного уточните перед подтверждением.

Все получают одинаковый кейс и предлагают свои решения.$c$),
  (21, 'simulation', 'startup', 'Симуляция продаж',
$c$Черновик из календаря курса (неделя 21). День, время, место и ответственного уточните перед подтверждением.

Все получают одинаковый кейс и предлагают свои решения.$c$),
  (22, 'simulation', 'startup', 'Переговоры',
$c$Черновик из календаря курса (неделя 22). День, время, место и ответственного уточните перед подтверждением.

Вторая сторона играет по своей карточке роли с интересами и возражениями. Карточки — в материалах руководителей.$c$),
  (24, 'pitch_review', 'startup', 'Питч-разбор 2',
$c$Черновик из календаря курса (неделя 24). День, время, место и ответственного уточните перед подтверждением.

Каждая команда питчит свой проект и получает обратную связь. Чтобы событие меняло рейтинг направления, отметьте его рейтинговым и опубликуйте правила до начала.$c$),
  (30, 'pitch_review', 'startup', 'Питч-разбор 3',
$c$Черновик из календаря курса (неделя 30). День, время, место и ответственного уточните перед подтверждением.

Каждая команда питчит свой проект и получает обратную связь. Чтобы событие меняло рейтинг направления, отметьте его рейтинговым и опубликуйте правила до начала.$c$),
  (34, 'pitch_review', 'startup', 'Питч-разбор 4',
$c$Черновик из календаря курса (неделя 34). День, время, место и ответственного уточните перед подтверждением.

Каждая команда питчит свой проект и получает обратную связь. Чтобы событие меняло рейтинг направления, отметьте его рейтинговым и опубликуйте правила до начала.$c$),
  (8, 'demo_day', null, 'Demo Day — промежуточный показ',
$c$Черновик из календаря курса (неделя 8). День, время, место и ответственного уточните перед подтверждением.

Промежуточный показ работ всех трёх направлений.$c$)
) as e(week_number, type, track_id, title, description)
join public.cohort_weeks cw
  on cw.cohort_id = public.default_cohort_id() and cw.week_number = e.week_number
where not exists (select 1 from public.events);

alter table public.events enable trigger trg_events_after_write;

insert into public.news (title, body, pinned)
select 'AIT Hub открыт',
$c$Здесь всё, что нужно на неделе:
• Программа — тема недели, материалы в Drive и задание. Работу сдают ссылкой до воскресенья, руководитель проверяет и отвечает.
• Календарь — контесты, турниры, питч-разборы и события клуба. Событие появляется, когда клуб его подтвердил.
• AIT Points — очки за подтверждённую работу. Рейтинг направления — отдельно: он меняется только по итогам рейтинговых событий с заранее объявленными правилами.
• Команды и проекты — до пяти человек в команде, вклад каждого записывается.
Посещение занятий не обязательно, обязательна работа. Вопросы — руководителю направления.$c$,
       true
where not exists (select 1 from public.news);
