
Надо переработать систему добавления сотрудников. Ранее сотрудники почти ничем не отличались от компании методом авторизации, и у них максимум не было доступа к плиткам до approve. Сейчас надо сделать так: 
1. Если пользователь зашёл на сайт, в поле авторизации в качестве логина теперь должен быть ещё возможность ввести номер телефона с казахстанским маркером. В поле просто приглушённым плэйсхолдером будет подсказка введите email или номер телефона
2. Надо разработать такую умную систему, которая будет конвертировать набранные номера именно на казахстанский маркер, к примеру в Казахстане можно официально звонить как через +7 так и просто набрав 8 вместо +7 (пример 8***-***-**-** вместо +7***-***-**-**), но стандарт это +7, однако многие люди пишут просто 8 или некоторые даже пишут просто 7 без + и получается 77***-***-**_**. Тем самым программа должна уметь все эти префиксы перед основным трёхзначным кодом(номером оператора) ставить +7 даже если там они указывают другие цифры, а не в глухую ожидать +7. 
3. в разделе настроек "Компания и доступ" разработать отдельный удобный функционал, где теперь сотрудники будут регистрироваться только через администратора (то бишь владельца бизнеса или тех кто уполномочен быть админом). Происходить это будет так: 
3.1. Админ заполняет специальное поле которое будет открываться по кнопке "Добавить сотрудника", в этом поле Админ указывает номер телефона (где уже установлен казахстанский маркер с +7), ФИО, указывает Отдел, а затем галочкой помечает какие права даются этому сотруднику (в пункте 4 подробнее про права) и нажимает сохранить и появляется запись в базе данных со всеми его данными
3.2. Надо вообще в поле "Зарегистрироваться" убрать регистрацию в качестве сотрудника, данная логика переработана и оставить только регистрацию компании и при нажатии Зарегистрироваться - сразу должна выйти поле указания данных компании без разделения на лишние карточки выбора сотрудник или компания.
3.3. Теперь вернёмся на начало когда сотрудник только открыл сайт. Вот сотрудник открывает сайт как обычный пользователь и в поле авторизации сотрудник вводит номер телефона 2 раза - в поле логина и в поле пароля и данная фича только на первый заход этого аккаунта и пока он не установил пароль. 
3.4. как только сотрудник зашёл в аккаунт введя номер телефон дважды в полях для логина и пароля - его автоматически должно скинуть в раздел настройках где он должен установить пароль и сохранить. Как только сотрудник установил пароль, дальше он должен будет заходить только с новым паролем. 
3.5. Если сотрудник случайно забыл пароль, его сбросить может только администратор в поле настройках сотрудника
3.6. В настройках у администратора в поле где происходит добавление сотрудников - должно быть какой-то удобный раздел для уже зарегистрированных сотрудников, где у каждого сотрудника должна открываться модальное окно со всеми данными, функциями сброса пароля, изменением прав с галочками, функцией увольнения сотрудника (где уволить будет означать потерю доступа к аккаунту, но эта кнопка должна быть с подтверждением чтоб случайно не уволить).
3.7. нужно так же добавить в поле к данным сотрудников того, кем конкретно этот сотрудник был добавлен, поскольку одного сотрудника может быть уполномочен добавить другой кто-то выше
4. Необходимо переработать и внедрить функцию прав для всех сотрудников, права будут доступны в соответствии с тем сколько галочек с правами будут установлены для каждого сотрудника. Не забудем, что владелец сайта - это тот кто прошёл регистрацию компанией и указал свои ФИО, он автоматически будет помечаться в системе как руководитель и у него абсолютные права. 
4.1. Галочка: Полный доступ (пользователь с таким правом будет абсолютным и он может делать всё и применять все доступные функций на сайте в том числе с подключением всяких API и Вебхуков), Галочка: Финансовый отчёт (данная галочка нужна будет бухгалтерам, финансовым аналитикам и всем остальным, кому нужен исключительный доступ только к к тем функциям на сайте, где можно загружать всякие таблицы excel и наоборот скачивать их оттуда), Галочка: Продажи (тут сотрудник будет иметь доступ только того что касается продаж, всякие там лиды, сводки, сделки, заявки), Производство (тут сотрудник имеет доступ только к разделу производство), Галочка: Наблюдающий ( имеет доступ ко всем уголкам сайта, но не имеет право взаимодействия и редактирования чего-то, может только заходить смотреть и прокручивать). 

Весь этот рефакторинг по фронтенд части произвести так, чтобы они все ожидали грамотно собранные бэкенд концы, чтобы их удобно и логично было бы подключить к базе  


Техническое задание: Переработка системы аутентификации и управления сотрудниками
Версия: 1.0
Статус: Черновик

1. Модуль авторизации — поддержка номера телефона
1.1. Расширение поля логина
В форме входа поле «Логин» должно принимать два типа идентификаторов:

Email-адрес
Номер телефона (казахстанский формат)

Плейсхолдер поля: Введите email или номер телефона (приглушённый серый текст).
1.2. Нормализация номера телефона
Пользователи вводят казахстанские номера в разных форматах — система должна автоматически приводить их к стандарту +7XXXXXXXXXX.
Введённый форматРезультат после нормализации87XX XXX XX XX+77XX XXX XX XX77XX XXX XX XX+77XX XXX XX XX+77XX XXX XX XX+77XX XXX XX XX
Логика нормализации (frontend):

Убрать все пробелы, дефисы и скобки.
Если строка начинается с 8 — заменить 8 на +7.
Если строка начинается с 7 (без +) — добавить + в начало.
Если строка уже начинается с +7 — оставить без изменений.
Передавать на бэкенд только нормализованный формат +7XXXXXXXXXX.


2. Регистрация — только для компаний
2.1. Упрощение формы регистрации
Убрать экран выбора типа аккаунта («Сотрудник» / «Компания»). Кнопка «Зарегистрироваться» должна сразу открывать форму регистрации компании.
Поля формы:

Название компании
ФИО владельца
Email
Номер телефона
Пароль / Подтверждение пароля

Бизнес-правило: Пользователь, прошедший регистрацию через эту форму, автоматически получает роль «Руководитель» с абсолютными правами доступа.

3. Управление сотрудниками (раздел «Компания и доступ»)
3.1. Добавление сотрудника администратором
Регистрация сотрудников производится исключительно через администратора. Самостоятельная регистрация в качестве сотрудника недоступна.
Форма добавления сотрудника (открывается по кнопке «Добавить сотрудника»):
ПолеТипОбязательноНомер телефонаТекст (+7, с нормализацией)ДаФИОТекстДаОтделВыпадающий списокДаПрава доступаЧекбоксы (см. раздел 4)Да
После сохранения создаётся запись в БД со статусом pending_first_login. В поле added_by фиксируется ID администратора, добавившего сотрудника.
3.2. Первый вход сотрудника
При первом входе (статус pending_first_login, пароль не установлен):

Сотрудник вводит номер телефона в поле «Логин».
Сотрудник вводит тот же номер телефона в поле «Пароль».
Система распознаёт первый вход и автоматически перенаправляет на страницу установки пароля.
После сохранения нового пароля статус аккаунта меняется на active, и в дальнейшем вход осуществляется только по паролю.

3.3. Сброс пароля сотрудника
Самостоятельный сброс пароля для сотрудника не предусмотрен. Сброс выполняется только администратором через карточку сотрудника (см. п. 3.4). После сброса аккаунт возвращается в статус pending_first_login.
3.4. Список и управление сотрудниками
В разделе «Компания и доступ» отображается список всех сотрудников. При клике на сотрудника открывается модальное окно со следующими данными и действиями:
Информационный блок:

ФИО
Номер телефона
Отдел
Дата добавления
Кем добавлен (added_by)
Статус аккаунта (active / pending_first_login / dismissed)

Функциональный блок:

Редактирование прав доступа (чекбоксы, см. раздел 4)
Кнопка «Сбросить пароль»
Кнопка «Уволить сотрудника» — с обязательным диалогом подтверждения («Вы уверены? Это действие лишит сотрудника доступа к аккаунту»). При подтверждении статус меняется на dismissed, вход блокируется.


4. Система прав доступа
Права назначаются через чекбоксы при добавлении или редактировании сотрудника. Допускается назначение нескольких прав одновременно.
ПравоОписаниеПолный доступВсе функции системы, включая настройку API и вебхуков. Эквивалент прав руководителя.Финансовый отчётДоступ только к финансовым модулям: загрузка и выгрузка Excel-таблиц, финансовая аналитика.ПродажиДоступ к модулям: лиды, сделки, заявки, сводки по продажам.ПроизводствоДоступ только к разделу производства.НаблюдательДоступ на просмотр ко всем разделам без права редактирования и взаимодействия.
Бизнес-правило: Руководитель (первичный владелец аккаунта) имеет абсолютные права вне зависимости от чекбоксов — его права не редактируются через этот интерфейс.

5. Требования к реализации (Frontend)

Все компоненты должны быть готовы к подключению бэкенд-эндпоинтов: использовать чёткие интерфейсы (типы данных, структуры запросов/ответов) и не содержать хардкода бизнес-логики.
Нормализация телефонного номера выполняется на клиенте до отправки любого запроса.
Управление состоянием прав и статусов сотрудников — через единое хранилище (Redux / Zustand или аналог).
Все деструктивные действия (увольнение, сброс пароля) сопровождаются диалогом подтверждения.
Модальные окна и формы должны корректно обрабатывать состояния: loading, success, error.


6. API-контракт (ожидаемые эндпоинты)
МетодЭндпоинтОписаниеPOST/auth/loginВход по email или телефону + парольPOST/auth/set-passwordУстановка пароля при первом входеGET/company/employeesСписок сотрудников компанииPOST/company/employeesДобавление сотрудникаPATCH/company/employees/:idРедактирование данных / правPOST/company/employees/:id/reset-passwordСброс пароля администраторомPOST/company/employees/:id/dismissУвольнение сотрудникаPOST/auth/register/companyРегистрация компании


Блок 1 — AuthModal.tsx (главный файл рефакторинга)
Что сейчас: Монолитный компонент 600+ строк, тип Step = 'login' | 'pin' | 'choose-type' | 'employee' | 'company'. Функция submitLogin() отправляет только { email, password }. Поле логина — простой <input> с плейсхолдером "Email".
Что делать:
1.1. Поле логина — поддержка телефона
В AuthModal.tsx найти блок step === 'login'. Поле loginEmail переименовать в loginIdentifier. Обновить onChange:
ts// Было:
onChange={(e) => setLoginEmail(e.target.value)}
placeholder="Email"

// Станет:
onChange={(e) => {
  const v = e.target.value;
  // Если пользователь начинает вводить цифры — форматируем как телефон
  const looksLikePhone = /^[+78\d]/.test(v.replace(/\s/g,''));
  setLoginIdentifier(looksLikePhone ? formatKazakhPhoneInput(v) : v);
  setError('');
}}
placeholder="Email или номер телефона"
autoComplete="username"
1.2. Функция submitLogin() — нормализация перед отправкой
tsasync function submitLogin() {
  const raw = loginIdentifier.trim();
  if (!raw || !loginPassword.trim()) {
    setError('Введите email или телефон и пароль.');
    return;
  }

  // Попытка нормализовать как казахстанский телефон
  const phone = normalizeKazakhPhone(raw); // вернёт "+7XXXXXXXXXX" или null
  const isPhone = phone !== null;

  if (isPhone && !isKazakhPhoneComplete(raw)) {
    setError('Телефон должен быть в формате +7 (___) ___-__-__.');
    return;
  }

  const payload = isPhone
    ? { phone, password: loginPassword }
    : { email: raw.toLowerCase(), password: loginPassword };

  // ... POST /auth/login/ с payload
}
1.3. Удаление шага employee

Убрать 'employee' из типа Step.
Удалить весь JSX-блок step === 'employee'.
Удалить стейт: employeeName, employeeEmail, employeePhone, employeePassword.
Удалить функцию submitEmployeeRegistration().
Удалить кнопку «Сотрудник» из шага choose-type.

1.4. Убрать шаг choose-type
Вместо промежуточного экрана выбора — кнопка «Зарегистрироваться» на шаге login сразу переключает setStep('company').
ts// Было:
onClick={() => setStep('choose-type')}

// Станет:
onClick={() => setStep('company')}
Тип Step итого становится: 'login' | 'pin' | 'company' | 'set-password'.
1.5. Добавление шага set-password (первый вход сотрудника)
Новый шаг в модале:
tsx{step === 'set-password' && (
  <SetPasswordStep
    onSuccess={() => {
      applySession(session);
    }}
  />
)}
Логика: при submitLogin(), если бэкенд возвращает { requires_password_setup: true }, вместо applySession() вызвать setStep('set-password') и сохранить временный токен первого входа.

Блок 2 — src/shared/api/contracts.ts
Что сейчас: TeamMemberResponse содержит только id, full_name, email, status, role?.
Что добавить:
ts// Тип прав сотрудника (новая система)
export type EmployeePermission =
  | 'full_access'
  | 'financial_report'
  | 'sales'
  | 'production'
  | 'observer';

// Расширенный тип сотрудника
export interface EmployeeRecord {
  id: string;
  full_name: string;
  phone: string;              // обязательно, в формате +7XXXXXXXXXX
  email?: string | null;
  department?: string | null;
  status: 'pending_first_login' | 'active' | 'dismissed';
  permissions: EmployeePermission[];
  added_by_id: string;
  added_by_name: string;
  created_at: string;
  updated_at: string;
}

// Payload для POST /company/employees/
export interface CreateEmployeePayload {
  phone: string;
  full_name: string;
  department?: string;
  permissions: EmployeePermission[];
}

// Payload для PATCH /company/employees/:id
export interface UpdateEmployeePayload {
  permissions?: EmployeePermission[];
  department?: string;
}

// Ответ при сбросе пароля
export interface ResetPasswordResponse {
  success: boolean;
}

// Запрос на установку пароля (первый вход)
export interface SetPasswordPayload {
  new_password: string;
  confirm_password: string;
}

Блок 3 — src/shared/stores/auth.ts
Что сейчас: MembershipRole = 'owner' | 'admin' | 'manager' | 'viewer'. Нет модели прав сотрудников.
Что добавить:
ts// Новый тип — права конкретного сотрудника
export type EmployeePermission =
  | 'full_access'
  | 'financial_report'
  | 'sales'
  | 'production'
  | 'observer';

// Расширить User
export type User = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  status?: string;
  is_owner?: boolean;            // <-- новое
  employee_permissions?: EmployeePermission[]; // <-- новое
};
В AuthState добавить:
tsemployeePermissions: EmployeePermission[];
setEmployeePermissions: (perms: EmployeePermission[]) => void;

Блок 4 — src/shared/hooks/useCapabilities.ts
Что сейчас: IMPLIED_BY_ROLE маппит owner | admin | manager | viewer на массивы строковых capabilities.
Что добавить — новая функция useEmployeePermissions():
tsimport type { EmployeePermission } from '../stores/auth';

const PERMISSION_CAPS: Record<EmployeePermission, string[]> = {
  full_access: [
    'billing.manage', 'integrations.manage', 'audit.read',
    'team.manage', 'automations.manage', 'reports.read',
    'sales.manage', 'production.manage', 'imports.manage',
  ],
  financial_report: [
    'imports.manage', 'reports.read', 'exports.manage',
  ],
  sales: [
    'leads.manage', 'deals.manage', 'customers.manage',
    'tasks.manage', 'summary.read',
  ],
  production: [
    'production.manage', 'requests.manage',
  ],
  observer: [
    'leads.read', 'deals.read', 'customers.read', 'tasks.read',
    'production.read', 'reports.read', 'summary.read',
  ],
};

export function useEmployeePermissions() {
  const user = useAuthStore((s) => s.user);
  const perms = user?.employee_permissions ?? [];

  // owner — абсолютные права, игнорируем галочки
  if (user?.is_owner) {
    return {
      hasPermission: (_: EmployeePermission) => true,
      can: (_: string) => true,
      permissions: Object.keys(PERMISSION_CAPS) as EmployeePermission[],
    };
  }

  const caps = new Set(
    perms.flatMap((p) => PERMISSION_CAPS[p] ?? [])
  );

  return {
    hasPermission: (p: EmployeePermission) => perms.includes(p),
    can: (cap: string) => caps.has(cap),
    permissions: perms,
  };
}

Блок 5 — src/shared/hooks/useRole.ts
Добавить функцию useIsOwner() и дополнить useRole():
tsexport function useRole() {
  // ... существующий код ...

  // Добавить:
  const isOwnerFlag = useAuthStore((state) => state.user?.is_owner ?? false);

  return {
    role,
    isOwner: isOwner || isOwnerFlag,   // учитываем флаг is_owner
    isAdmin,
    isManager,
    isViewer,
  };
}
```

---

## Блок 6 — `src/pages/settings/index.tsx` — панель управления сотрудниками

**Что сейчас:** Раздел `company-access` существует, но управление командой через инвайты. Нет UI для создания сотрудников администратором.

**Что создать:** Новый компонент `EmployeePanel` внутри раздела `company-access`.

**Структура нового компонента `EmployeePanel.tsx`:**
```
EmployeePanel
├── Кнопка «Добавить сотрудника» (только для isAdmin)
│   └── Открывает AddEmployeeModal
│       ├── Поле: номер телефона (с formatKazakhPhoneInput)
│       ├── Поле: ФИО
│       ├── Поле: Отдел (select)
│       └── Чекбоксы прав: full_access | financial_report | sales | production | observer
│
├── Список сотрудников (EmployeeList)
│   └── EmployeeCard × N
│       ├── ФИО, телефон, отдел, статус-бейдж
│       └── Клик → EmployeeDetailModal
│
└── EmployeeDetailModal
    ├── Блок данных (ФИО, телефон, отдел, кем добавлен, дата)
    ├── Статус-бейдж (active | pending_first_login | dismissed)
    ├── Чекбоксы прав (редактирование)
    ├── Кнопка «Сбросить пароль» (→ PATCH, меняет статус на pending_first_login)
    └── Кнопка «Уволить» (красная, с confirm-диалогом → POST /dismiss/)
API-вызовы внутри компонента:
ts// Получить список
const { data } = useQuery(['employees'], () =>
  api.get<EmployeeRecord[]>('/company/employees/')
);

// Добавить сотрудника
const addMutation = useMutation((payload: CreateEmployeePayload) =>
  api.post('/company/employees/', payload)
);

// Обновить права / отдел
const updateMutation = useMutation(({ id, ...payload }: { id: string } & UpdateEmployeePayload) =>
  api.patch(`/company/employees/${id}/`, payload)
);

// Сбросить пароль
const resetMutation = useMutation((id: string) =>
  api.post(`/company/employees/${id}/reset-password/`)
);

// Уволить
const dismissMutation = useMutation((id: string) =>
  api.post(`/company/employees/${id}/dismiss/`)
);

Блок 7 — src/pages/auth/register/index.tsx
Что сейчас: <AuthModal initialStep="choose-type" />.
Что изменить:
tsx// Было:
<AuthModal initialStep="choose-type" ... />

// Станет:
<AuthModal initialStep="company" ... />
Это единственное изменение в файле — минимальная точка касания.

Блок 8 — Маршрут accept-invite
Что сейчас: src/pages/auth/accept-invite/index.tsx — полноценная страница обработки инвайт-токенов с 80+ строками логики.
Что делать: Страницу не удалять сразу — оставить с баннером «Система приглашений изменена. Обратитесь к администратору.» и кнопкой перехода на /auth/login. Удалить после подтверждения от бэкенда, что старые токены деактивированы.

Блок 9 — Первый вход сотрудника (новый шаг set-password)
Новый компонент SetPasswordStep.tsx:
tsxinterface Props {
  tempToken: string;        // токен из первого входа (phone+phone)
  onSuccess: (session: AuthSessionResponse) => void;
}

export function SetPasswordStep({ tempToken, onSuccess }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!password || password !== confirm) {
      setError('Пароли не совпадают.');
      return;
    }
    if (password.length < 8) {
      setError('Пароль должен быть не менее 8 символов.');
      return;
    }
    setLoading(true);
    try {
      const session = await api.post<AuthSessionResponse>(
        '/auth/set-password/',
        { new_password: password, confirm_password: confirm },
        { headers: { Authorization: `Bearer ${tempToken}` } }
      );
      onSuccess(session);
    } catch (cause) {
      setError(readAuthError(cause, 'Не удалось установить пароль.'));
    } finally {
      setLoading(false);
    }
  }

  // ... JSX с двумя PasswordField + кнопка «Сохранить пароль»
}

Итоговая карта изменений по файлам
ФайлДействиеПриоритетfeatures/auth/AuthModal.tsxИзменить: убрать employee/choose-type, добавить phone в login, добавить шаг set-password🔴 Критичноpages/auth/register/index.tsxИзменить: initialStep="company"🔴 Критичноshared/api/contracts.tsРасширить: добавить EmployeeRecord, EmployeePermission, payloads🔴 Критичноshared/stores/auth.tsРасширить: EmployeePermission в User, новый стейт🟠 Важноshared/hooks/useCapabilities.tsРасширить: useEmployeePermissions(), PERMISSION_CAPS🟠 Важноshared/hooks/useRole.tsДоработать: учёт is_owner флага🟠 Важноpages/settings/index.tsxРасширить: встроить EmployeePanel в раздел company-access🟠 Важноfeatures/auth/SetPasswordStep.tsxСоздать новый компонент🟡 Среднеfeatures/auth/AddEmployeeModal.tsxСоздать новый компонент🟡 Среднеfeatures/auth/EmployeeDetailModal.tsxСоздать новый компонент🟡 Среднеfeatures/auth/EmployeePanel.tsxСоздать новый компонент🟡 Среднеpages/auth/accept-invite/index.tsxЗаморозить: убрать логику, оставить редирект🟢 Низкоshared/utils/kz.tsБез изменений — уже готов formatKazakhPhoneInput и normalizeKazakhPhone✅ Готово

Порядок внедрения
Фаза 1 — типы и контракты (без UI, не ломает ничего существующего):
contracts.ts → auth.ts → useCapabilities.ts → useRole.ts
Фаза 2 — новые изолированные компоненты (не встроены никуда):
SetPasswordStep.tsx → AddEmployeeModal.tsx → EmployeeDetailModal.tsx → EmployeePanel.tsx
Фаза 3 — рефакторинг существующих файлов:
AuthModal.tsx (удалить employee-шаг, добавить phone + set-password) → register/index.tsx (одна строка)
Фаза 4 — встройка и подключение:
settings/index.tsx (встроить EmployeePanel) → accept-invite (заморозить)
Фаза 5 — подключение к реальному бэкенду:
Заменить mock-вызовы на реальные эндпоинты по контракту из раздела API