# Deploy На Railway

Под этот репозиторий Railway-деплой нужно делать не одним сервисом, а раздельно:

1. `frontend` сервис из корня репозитория
2. `backend` сервис из папки `server/`
3. `postgres` сервис, если база тоже будет жить на Railway

Важно: когда я раньше писал "нужно поднять 2 сервиса", я имел в виду 2 прикладных сервиса приложения: фронтенд и бэкенд. База данных обычно становится третьим сервисом внутри того же Railway Project.

## Что получится в итоге

Пример итоговой схемы:

- `frontend`:
  - собирает Vite-приложение из корня репозитория
  - открывается пользователю в браузере
- `backend`:
  - собирает Fastify API из `server/`
  - отвечает на `https://.../api/v1/*`
- `postgres`:
  - хранит данные Prisma
  - отдаёт `DATABASE_URL` для backend

## До начала

Проверь локально, что проект уже зелёный:

```bash
npm run test
npm run test:e2e
npm run build
cd server
npm run build
```

## Какие файлы уже подготовлены

В репозитории уже есть:

- frontend Railway config: [railway.toml](/c:/Users/user/Documents/KORT-DEV-MODE/railway.toml)
- backend Railway config: [server/railway.toml](/c:/Users/user/Documents/KORT-DEV-MODE/server/railway.toml)
- backend env schema: [server/src/config.ts](/c:/Users/user/Documents/KORT-DEV-MODE/server/src/config.ts)
- healthcheck route: [server/src/app.ts](/c:/Users/user/Documents/KORT-DEV-MODE/server/src/app.ts#L121)

## Какие переменные реально нужны

### Frontend

Обязательно:

- `VITE_API_BASE_URL`

Опционально:

- `VITE_SENTRY_DSN`

Не нужно ставить на Railway:

- `VITE_MOCK_API=true`
- `VITE_PROXY_TARGET`

### Backend

Обязательно:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN`

Опционально:

- `JWT_ACCESS_TTL`
- `JWT_REFRESH_TTL`
- `CONSOLE_SERVICE_PASSWORD`

Обычно можно не трогать:

- `PORT`
- `HOST`

`PORT` Railway прокидывает сам.  
`HOST` у вас и так по умолчанию `0.0.0.0`.

## Что означает каждая важная переменная

### `VITE_API_BASE_URL`

Это публичный адрес backend API, который будет использовать браузер.

Пример:

```env
VITE_API_BASE_URL=https://kort-api-production.up.railway.app/api/v1
```

Важно:

- здесь нужен именно публичный HTTPS-домен backend
- сюда нельзя ставить `railway.internal`
- сюда нельзя ставить localhost

Почему: браузер пользователя не может ходить во внутреннюю сеть Railway. Railway сам пишет, что private network недоступна клиентским запросам из браузера, для браузера нужен public domain: https://docs.railway.com/networking/domains/working-with-domains

### `DATABASE_URL`

Это строка подключения Prisma/Fastify к PostgreSQL.

Если используешь Railway PostgreSQL, Railway сам даст эту переменную. Её нужно передать в backend сервис.

Пример вида:

```env
DATABASE_URL=postgresql://postgres:password@postgres.railway.internal:5432/railway
```

Точное значение руками придумывать не надо. Его берут из сервиса базы.

### `JWT_ACCESS_SECRET`

Секрет для access token.

Должен быть длинным случайным значением.

Пример генерации в PowerShell:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

### `JWT_REFRESH_SECRET`

Отдельный секрет для refresh token.

Нельзя делать его таким же, как `JWT_ACCESS_SECRET`.

Сгенерируй ещё одно отдельное случайное значение той же командой.

### `CORS_ORIGIN`

Это домен фронтенда, которому backend разрешит обращаться к API.

Пример:

```env
CORS_ORIGIN=https://kort-web-production.up.railway.app
```

Важно:

- здесь указывается домен фронта
- без `/api/v1`
- без завершающего `/`
- в текущем коде это одна строка, а не список доменов

Если потом подключишь свой frontend custom domain, `CORS_ORIGIN` нужно поменять на него.

## Пошаговый деплой

## Шаг 1. Создай Railway Project

1. Зайди в Railway.
2. Нажми `New Project`.
3. Выбери `Deploy from GitHub repo`.
4. Подключи этот репозиторий.

После этого у тебя будет один Railway Project, внутри которого ты создашь отдельные сервисы.

## Шаг 2. Создай PostgreSQL сервис

Если база будет на Railway:

1. Внутри Project нажми `New`.
2. Выбери `Database`.
3. Выбери `PostgreSQL`.
4. Дождись, пока сервис базы создастся.

После этого у Railway появятся переменные базы. Именно из них потом нужно подать `DATABASE_URL` в backend.

## Шаг 3. Создай backend сервис

1. Нажми `New`.
2. Выбери `GitHub Repo`.
3. Укажи тот же репозиторий.
4. Назови сервис, например `backend`.

Дальше в настройках сервиса выстави:

- `Root Directory` = `server`
- `Config as Code` = `/server/railway.toml`

Важно:

- `Root Directory` говорит Railway, из какой папки собирать код
- `Config as Code` лучше указывать явным путём к backend-конфигу

### Переменные backend

Открой backend service -> `Variables` и задай:

```env
DATABASE_URL=<из postgres сервиса или внешней БД>
JWT_ACCESS_SECRET=<длинный случайный секрет>
JWT_REFRESH_SECRET=<другой длинный случайный секрет>
CORS_ORIGIN=<публичный домен фронтенда>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
CONSOLE_SERVICE_PASSWORD=<опционально>
```

### Откуда брать `DATABASE_URL`

Есть 2 варианта.

#### Вариант A. База на Railway

Используй переменную, которую даёт Railway PostgreSQL сервис.

Самый безопасный путь:

1. Открой PostgreSQL service
2. Перейди в `Variables`
3. Скопируй `DATABASE_URL`
4. Вставь её в backend service -> `Variables`

Если хочешь, можно использовать и reference variable через Railway UI, но для первого деплоя проще и прозрачнее просто вставить готовое значение.

#### Вариант B. Внешняя база

Просто вставь внешний PostgreSQL URL от Supabase, Neon, Render, RDS или своего сервера.

## Шаг 4. Создай frontend сервис

1. Нажми `New`
2. Выбери `GitHub Repo`
3. Укажи тот же репозиторий
4. Назови сервис, например `frontend`

В настройках сервиса выстави:

- `Root Directory` = `.`
- `Config as Code` = `/railway.toml`

### Переменные frontend

Открой frontend service -> `Variables` и задай:

```env
VITE_API_BASE_URL=https://<backend-domain>/api/v1
VITE_SENTRY_DSN=
```

Пример:

```env
VITE_API_BASE_URL=https://kort-api-production.up.railway.app/api/v1
```

Важно:

- фронт должен знать уже готовый backend public URL
- если backend домен изменился, обнови `VITE_API_BASE_URL` и redeploy frontend

## Шаг 5. Получи публичные Railway-домены

Railway пишет, что сервису домен не назначается автоматически, его нужно сгенерировать в `Networking -> Public Networking -> Generate Domain`:

https://docs.railway.com/networking/domains/working-with-domains

Сделай так:

### Для backend

1. Зайди в backend service
2. Открой `Settings`
3. Найди `Networking`
4. Нажми `Generate Domain`
5. Получи что-то вроде:

```text
https://backend-production-xxxx.up.railway.app
```

### Для frontend

1. Зайди в frontend service
2. Повтори те же действия
3. Получи frontend domain

## Шаг 6. Обнови `CORS_ORIGIN` и `VITE_API_BASE_URL`

Теперь, когда у тебя есть оба публичных домена:

### На backend

Поставь:

```env
CORS_ORIGIN=https://<frontend-domain>
```

### На frontend

Поставь:

```env
VITE_API_BASE_URL=https://<backend-domain>/api/v1
```

После изменения переменных Railway обычно сам инициирует redeploy. Если нет, сделай redeploy вручную.

## Шаг 7. Проверь backend отдельно

Открой:

```text
https://<backend-domain>/api/v1/health
```

Ожидаемый ответ:

```json
{
  "status": "ok",
  "ts": "..."
}
```

Если healthcheck не открывается:

- проверь, что backend service вообще стартовал
- проверь логи deployment
- проверь `DATABASE_URL`
- проверь, что Prisma миграции не упали

## Шаг 8. Проверь frontend отдельно

Открой frontend domain.

Проверь:

1. страница загружается
2. логин работает
3. нет ошибок `CORS`
4. нет ошибок `Failed to fetch`
5. после логина идут реальные запросы в backend домен

## Шаг 9. Проверь базовые пользовательские сценарии

Минимум:

1. логин
2. создание клиента
3. открытие клиента
4. редактирование клиента
5. создание сделки
6. открытие сделки
7. редактирование сделки
8. открытие настроек

## Шаг 10. Если нужен свой домен

Railway поддерживает custom domains. По официальной документации:

- сначала добавляешь custom domain в сервис Railway
- Railway выдаёт CNAME value
- затем создаёшь DNS запись у регистратора
- после верификации Railway сам выдаёт SSL

Документация:

https://docs.railway.com/networking/domains/working-with-domains

### Если используешь Cloudflare

Railway отдельно предупреждает:

- при proxy через Cloudflare нужен `SSL/TLS = Full`
- `Full (Strict)` может не подойти в их типовой схеме

## Готовые примеры env

## Backend

```env
DATABASE_URL=postgresql://postgres:***@postgres.railway.internal:5432/railway
JWT_ACCESS_SECRET=replace_me_with_long_random_secret_1
JWT_REFRESH_SECRET=replace_me_with_long_random_secret_2
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
CORS_ORIGIN=https://kort-web-production.up.railway.app
CONSOLE_SERVICE_PASSWORD=replace_if_needed
```

## Frontend

```env
VITE_API_BASE_URL=https://kort-api-production.up.railway.app/api/v1
VITE_SENTRY_DSN=
```

## Как понять, куда какую переменную ставить

Правило простое:

- всё, что начинается с `VITE_`, ставится только во frontend service
- всё, что относится к Fastify, Prisma, JWT, CORS, ставится только в backend service

То есть:

- `VITE_API_BASE_URL` -> frontend
- `DATABASE_URL` -> backend
- `JWT_ACCESS_SECRET` -> backend
- `JWT_REFRESH_SECRET` -> backend
- `CORS_ORIGIN` -> backend

## Частые ошибки

### Ошибка 1. Поставили `VITE_API_BASE_URL` на backend

Так не сработает. Это переменная фронта.

### Ошибка 2. Поставили `DATABASE_URL` только в сервис базы, но не в backend

Backend сам её не "угадает". Ему нужно реально видеть переменную в своих `Variables`.

### Ошибка 3. В `VITE_API_BASE_URL` поставили `http://backend.railway.internal`

Браузер туда не достучится. Для фронта нужен публичный backend URL.

### Ошибка 4. В `CORS_ORIGIN` указали backend домен вместо frontend домена

Тогда браузерные запросы будут падать по CORS.

### Ошибка 5. В `CORS_ORIGIN` добавили `/api/v1`

Так делать не надо. Нужен только origin:

```text
https://frontend-domain
```

а не:

```text
https://frontend-domain/api/v1
```

### Ошибка 6. Сначала задеплоили frontend, а backend домен ещё не готов

Тогда фронт соберётся с пустым или неверным `VITE_API_BASE_URL`.  
Правильный порядок:

1. база
2. backend
3. backend public domain
4. frontend env
5. frontend deploy

## Рекомендуемый порядок деплоя

1. Создать Railway Project
2. Создать PostgreSQL service
3. Создать backend service
4. Задать backend env
5. Сгенерировать backend public domain
6. Создать frontend service
7. Задать frontend env с backend domain
8. Сгенерировать frontend public domain
9. Обновить backend `CORS_ORIGIN` на frontend domain
10. Перезапустить оба сервиса
11. Проверить `/api/v1/health`
12. Пройти smoke руками

## Что делать после смены домена

Если потом подключишь кастомный домен:

- новый frontend домен -> обновить `CORS_ORIGIN` на backend
- новый backend домен -> обновить `VITE_API_BASE_URL` на frontend

После этого сделать redeploy соответствующего сервиса.

## Короткая шпаргалка

### Frontend service

- Root Directory: `.`
- Config as Code: `/railway.toml`
- Variables:

```env
VITE_API_BASE_URL=https://<backend-domain>/api/v1
```

### Backend service

- Root Directory: `server`
- Config as Code: `/server/railway.toml`
- Variables:

```env
DATABASE_URL=...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
CORS_ORIGIN=https://<frontend-domain>
```

### Database service

- PostgreSQL на Railway
- источник `DATABASE_URL` для backend

## Полезные ссылки

- Railway Domains: https://docs.railway.com/networking/domains/working-with-domains
- Railway public domain generation: https://docs.railway.com/networking/domains/working-with-domains#railway-provided-domains
- Railway custom domains: https://docs.railway.com/networking/domains/working-with-domains#custom-domains
- Railway private networking: https://docs.railway.com/networking/domains/working-with-domains#private-domains
