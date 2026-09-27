# JobScheduler SDK

SDK для написания задач JobScheduler на Python и TypeScript. Код планировщика
сюда не входит. Оба пакета используют один [JSON-протокол v1](protocol/README.md)
и работают без изменений JobScheduler.Core.

## Установка

| Язык | Установить в свой проект | Запуск задач |
| --- | --- | --- |
| Python 3.11+ | `python -m pip install jobscheduler-task-sdk` | `python -m scheduler_sdk.runner` |
| TypeScript / Node 20+ | `npm install @ahell/jobscheduler-sdk` | `node node_modules/@ahell/jobscheduler-sdk/dist/runner.js` |

До первого выпуска пакеты можно установить из клона этого репозитория:
`python -m pip install -e ./python` и `npm install ./typescript`.

## Python

Создайте в своём проекте `tasks.py`:

```python
from scheduler_sdk import TaskContext, process, task

process("people")

@task("normalize", process="people")
def normalize(username: str) -> dict[str, str]:
    return {"username": " ".join(username.split()).lower()}

@task("save", process="people", depends_on=["normalize"])
def save(context: TaskContext) -> dict[str, str]:
    path = context.workspace_path("username.txt")
    path.write_text(context.result("normalize")["username"], encoding="utf-8")
    return {"file": path.name}
```

`TASK_MODULE=tasks` указывает runner, какой модуль импортировать. Декоратор
`@task` связывает обычную функцию с процессом; `depends_on` задаёт порядок.

## TypeScript

Создайте Node-проект, установите SDK и компилятор:

```powershell
npm init -y
npm pkg set type=module
npm install @ahell/jobscheduler-sdk
npm install --save-dev typescript @types/node
```

Создайте `tsconfig.json` с `module` и `moduleResolution` равными `NodeNext`,
`rootDir: "src"`, `outDir: "dist"` и `target: "ES2022"`. Компилируйте задачи
командой `npx tsc` (`src/tasks.ts` → `dist/tasks.js`). Модуль задач:

```ts
import { writeFile } from "node:fs/promises";
import { process, task } from "@ahell/jobscheduler-sdk";

process("people");
task("normalize", { process: "people", parameters: { username: "string" } },
  ({ username }: { username: string }) => ({ username: username.trim().toLowerCase() }));
task("save", { process: "people", dependsOn: ["normalize"] },
  async (_, context) => {
    const name = context.result<{ username: string }>("normalize").username;
    await writeFile(context.workspacePath("username.txt"), name, "utf8");
    return { file: "username.txt" };
  });
```

В TypeScript типы параметров для формы JobScheduler задаются явно в
`parameters`, потому что после компиляции типы исчезают. Укажите
`TASK_MODULE=./dist/tasks.js`. Компиляция выполняется в вашем проекте до
подключения к JobScheduler; планировщик TypeScript не компилирует.

## Подключение к JobScheduler

В интерфейсе «Добавить процесс» укажите ID регистрации и `people` как ID
процесса SDK. Нажмите «Загрузить поля задач», чтобы получить параметры.

- **Компьютер, без Docker:** выберите этот режим, задайте `hostRunner` и
  существующую записываемую папку `workspaceRoot`. Для Python задайте
  `executable=python`, `arguments=["-m","scheduler_sdk.runner"]`,
  `workingDirectory` с `tasks.py`, `environment.TASK_MODULE=tasks`. Для
  TypeScript задайте `executable=node`, путь к установленному
  `node_modules/@ahell/jobscheduler-sdk/dist/runner.js` в `arguments`,
  `workingDirectory` проекта и `environment.TASK_MODULE=./dist/tasks.js`.
  Для обоих языков `workspaceRoot` должен существовать до сохранения процесса.
  Если Python SDK установлен в виртуальное окружение, укажите в `executable`
  полный путь к его `Scripts/python.exe`, а не системный `python`.
- **Docker:** соберите образ с установленным SDK и кодом своих задач. В качестве
  `ENTRYPOINT` используйте соответствующий runner, а в настройках процесса
  укажите имя образа. `hostRunner` не нужен.
- **Смешанный:** задайте Docker-образ и `hostRunner`. Задачи с
  `execution_target="host"` (Python) или `executionTarget: "host"`
  (TypeScript) выполняются на компьютере, остальные — в контейнерах.
  Смонтируйте общую папку с `read_only: false` для обмена файлами.

Пример `hostRunner` для Python (замените пути на свои):

```json
{
  "executable": "C:/project/.venv/Scripts/python.exe",
  "arguments": ["-m", "scheduler_sdk.runner"],
  "workingDirectory": "C:/project",
  "workspaceRoot": "C:/project/workspace",
  "environment": { "TASK_MODULE": "tasks" }
}
```

Для Docker-процесса с Python-задачами положите `tasks.py` и этот `Dockerfile`
в свой проект, затем выполните `docker build -t my-tasks:0.1 .`:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir jobscheduler-task-sdk==0.1.0
COPY tasks.py .
ENV TASK_MODULE=tasks
ENTRYPOINT ["python", "-m", "scheduler_sdk.runner"]
```

В настройках процесса укажите образ `my-tasks:0.1`. Если нужны файлы,
добавьте bind существующей папки компьютера к `/workspace` с
`read_only: false`. Для TypeScript используйте образ с Node 20+, установленным
npm-пакетом, скомпилированным `dist/tasks.js` и тем же runner, что указан выше.

`context.result("normalize")` получает JSON-результат зависимости.
`workspace_path()` / `workspacePath()` возвращает путь внутри отдельной папки
текущего запуска. Большие данные сохраняйте в файлы, между задачами передавайте
их относительные пути. Если задачам в Docker нужна сеть, включите её в
настройках процесса.

## Как работает

JobScheduler запускает runner отдельно для чтения каталога (`describe`) и для
каждого выполнения задачи (`execute`). На компьютере запрос приходит JSON через
stdin, в Docker — через `TASK_REQUEST_B64`. Runner возвращает один JSON-ответ
через stdout; логи идут в stderr. Результаты зависимостей передаются в
`upstream`. Подробный формат — в [protocol/README.md](protocol/README.md).

Инструкция для владельца пакетов по публикации — в [PUBLISHING.md](PUBLISHING.md).
