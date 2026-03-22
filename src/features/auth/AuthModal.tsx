import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowUpRight,
  Blocks,
  Building2,
  Eye,
  EyeOff,
  Factory,
  KeyRound,
  ShieldCheck,
  UserRoundPlus,
  Workflow,
  X,
} from 'lucide-react';
import { api } from '../../shared/api/client';
import type { AuthSessionResponse } from '../../shared/api/contracts';
import { readApiErrorMessage, readApiErrorStatus } from '../../shared/api/errors';
import { useAuthStore } from '../../shared/stores/auth';
import { usePinStore } from '../../shared/stores/pin';
import {
  formatKazakhPhoneInput,
  isKazakhPhoneComplete,
  normalizeKazakhPhone,
} from '../../shared/utils/kz';
import styles from './AuthModal.module.css';

type Step = 'login' | 'pin' | 'choose-type' | 'employee' | 'company';
type BrandScene = 'network' | 'briefing' | 'flow';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthSuccess: () => void;
  initialStep?: Step;
}

const BRAND_CAROUSEL = [
  {
    icon: Workflow,
    label: 'Поток',
    title: 'Клиенты, сделки и задачи в одном ритме',
    description: 'Единый экран без лишнего визуального шума.',
    scene: 'flow' as BrandScene,
  },
  {
    icon: ShieldCheck,
    label: 'Доступ',
    title: 'Роли и связи читаются с первого взгляда',
    description: 'Команда, права и контакты собраны в одной структуре.',
    scene: 'network' as BrandScene,
  },
  {
    icon: Factory,
    label: 'Операции',
    title: 'Продажи, сервис и производство держатся вместе',
    description: 'Интерфейс остаётся собранным даже при параллельной работе.',
    scene: 'briefing' as BrandScene,
  },
] as const;

function readAuthError(cause: unknown, fallback: string) {
  const message = readApiErrorMessage(cause, '').trim();
  if (message) {
    return message;
  }

  const status = readApiErrorStatus(cause);
  if (status === 401) {
    return 'Неверный email или пароль.';
  }

  if (status === 409) {
    return 'Этот email уже занят. Один email можно использовать только для одного аккаунта.';
  }

  if (status === 400) {
    return 'Проверьте заполнение полей и попробуйте ещё раз.';
  }

  return fallback;
}

function normalizePhonePayload(value: string) {
  return normalizeKazakhPhone(value) ?? undefined;
}

function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.passwordField}>
      <input
        className={styles.input}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className={styles.passwordToggle}
        onClick={() => setVisible((state) => !state)}
        aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function BrandScenePreview({ scene }: { scene: BrandScene }) {
  if (scene === 'network') {
    return (
      <div className={`${styles.slideScene} ${styles.sceneNetwork}`} aria-hidden="true">
        <span className={styles.sceneGlow} />
        <span className={`${styles.sceneNode} ${styles.sceneNodeCore}`} />
        <span className={`${styles.sceneNode} ${styles.sceneNodeTop}`} />
        <span className={`${styles.sceneNode} ${styles.sceneNodeLeft}`} />
        <span className={`${styles.sceneNode} ${styles.sceneNodeRight}`} />
        <span className={`${styles.sceneNode} ${styles.sceneNodeBottom}`} />
        <span className={`${styles.sceneLink} ${styles.sceneLinkTop}`} />
        <span className={`${styles.sceneLink} ${styles.sceneLinkLeft}`} />
        <span className={`${styles.sceneLink} ${styles.sceneLinkRight}`} />
        <span className={`${styles.sceneLink} ${styles.sceneLinkBottom}`} />

        <div className={`${styles.sceneMiniCard} ${styles.sceneMiniCardTop}`}>
          <span className={styles.sceneMiniLabel}>роли</span>
          <strong>owner / admin / team</strong>
        </div>
        <div className={`${styles.sceneMiniCard} ${styles.sceneMiniCardBottom}`}>
          <span className={styles.sceneMiniLabel}>контакты</span>
          <strong>единая структура</strong>
        </div>
      </div>
    );
  }

  if (scene === 'briefing') {
    return (
      <div className={`${styles.slideScene} ${styles.sceneBriefing}`} aria-hidden="true">
        <span className={styles.sceneGlow} />
        <span className={styles.sceneTable} />
        <span className={`${styles.sceneAvatar} ${styles.sceneAvatarOne}`} />
        <span className={`${styles.sceneAvatar} ${styles.sceneAvatarTwo}`} />
        <span className={`${styles.sceneAvatar} ${styles.sceneAvatarThree}`} />
        <span className={`${styles.sceneAvatar} ${styles.sceneAvatarFour}`} />

        <div className={styles.sceneBoard}>
          <span className={`${styles.sceneBoardRow} ${styles.sceneBoardRowLong}`} />
          <span className={`${styles.sceneBoardRow} ${styles.sceneBoardRowShort}`} />
          <span className={`${styles.sceneBoardRow} ${styles.sceneBoardRowMid}`} />
        </div>

        <div className={styles.sceneBriefCard}>
          <span className={styles.sceneMiniLabel}>синхронизация</span>
          <strong>обсуждение и решения</strong>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.slideScene} ${styles.sceneFlow}`} aria-hidden="true">
      <span className={styles.sceneGlow} />

      <div className={styles.sceneLane}>
        <div className={`${styles.sceneStage} ${styles.sceneStageActive}`}>
          <span className={styles.sceneStageLabel}>лид</span>
          <strong className={styles.sceneStageValue}>24</strong>
          <span className={styles.sceneStageBar} />
        </div>
        <div className={styles.sceneStage}>
          <span className={styles.sceneStageLabel}>сделка</span>
          <strong className={styles.sceneStageValue}>17</strong>
          <span className={styles.sceneStageBar} />
        </div>
        <div className={styles.sceneStage}>
          <span className={styles.sceneStageLabel}>задача</span>
          <strong className={styles.sceneStageValue}>31</strong>
          <span className={styles.sceneStageBar} />
        </div>
      </div>

      <div className={styles.sceneGraph}>
        <span className={`${styles.sceneGraphBar} ${styles.sceneGraphBarLow}`} />
        <span className={`${styles.sceneGraphBar} ${styles.sceneGraphBarMid}`} />
        <span className={`${styles.sceneGraphBar} ${styles.sceneGraphBarTall}`} />
        <span className={`${styles.sceneGraphBar} ${styles.sceneGraphBarMid}`} />
        <span className={`${styles.sceneGraphBar} ${styles.sceneGraphBarLow}`} />
      </div>
    </div>
  );
}

function PinStep({
  onSuccess,
  onUsePassword,
}: {
  onSuccess: () => void;
  onUsePassword: () => void;
}) {
  const storedPin = usePinStore((state) => state.pin);
  const user = useAuthStore((state) => state.user);
  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const pinLength = storedPin?.length ?? 4;
  const inputRef = useRef<HTMLInputElement>(null);

  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDigits('');
    setError('');
  }, [storedPin]);

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    };
  }, []);

  const submit = (value: string) => {
    if (value === storedPin) {
      onSuccess();
      return;
    }

    setDigits('');
    setError('Неверный PIN-код.');
    setShake(true);
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(() => setShake(false), 500);
  };

  return (
    <div className={styles.stepContent}>
      <div className={styles.stepHeader}>
        <h2 className={styles.title}>
          {user ? `С возвращением, ${user.full_name?.split(' ')[0] ?? 'в команду'}` : 'Введите PIN-код'}
        </h2>
        <p className={styles.subtitle}>
          Быстрый вход доступен только на доверенном устройстве. Если PIN не подходит, переключитесь на пароль.
        </p>
      </div>

      <div className={`${styles.pinArea} ${shake ? styles.pinAreaShake : ''}`} onClick={() => inputRef.current?.focus()} role="presentation">
        <div className={styles.pinDots}>
          {Array.from({ length: pinLength }, (_, index) => (
            <div
              key={index}
              className={`${styles.pinDot} ${digits.length > index ? styles.pinDotFilled : ''} ${error ? styles.pinDotError : ''}`}
            />
          ))}
        </div>
        <input
          ref={inputRef}
          className={styles.pinHiddenInput}
          type="password"
          inputMode="numeric"
          autoFocus
          value={digits}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, '').slice(0, pinLength);
            setDigits(next);
            setError('');
            if (next.length === pinLength) {
              submit(next);
            }
          }}
        />
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <button type="button" className={styles.linkButton} onClick={onUsePassword}>
        Войти с паролем
      </button>
    </div>
  );
}

export function AuthModal({
  open,
  onClose,
  onAuthSuccess,
  initialStep,
}: AuthModalProps) {
  const setAuth = useAuthStore((state) => state.setAuth);
  const inviteContext = useAuthStore((state) => state.inviteContext);
  const user = useAuthStore((state) => state.user);
  const pin = usePinStore((state) => state.pin);
  const isTrustedDevice = usePinStore((state) => state.isTrustedDevice);
  const trustDevice = usePinStore((state) => state.trustDevice);

  const defaultStep = useMemo<Step>(() => {
    if (initialStep) {
      return initialStep;
    }

    if (user && pin && isTrustedDevice) {
      return 'pin';
    }

    return 'login';
  }, [initialStep, isTrustedDevice, pin, user]);

  const [step, setStep] = useState<Step>(defaultStep);
  const [activeBrandSlide, setActiveBrandSlide] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [employeePhone, setEmployeePhone] = useState('');
  const [employeePassword, setEmployeePassword] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [companyOwnerName, setCompanyOwnerName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyPassword, setCompanyPassword] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setStep(defaultStep);
    setError('');
    setLoading(false);
  }, [defaultStep, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveBrandSlide(0);
    const timer = window.setInterval(() => {
      setActiveBrandSlide((current) => (current + 1) % BRAND_CAROUSEL.length);
    }, 4600);

    return () => window.clearInterval(timer);
  }, [open]);

  if (!open) {
    return null;
  }

  const activeStory = BRAND_CAROUSEL[activeBrandSlide];
  const ActiveStoryIcon = activeStory.icon;

  function applySession(session: AuthSessionResponse) {
    setAuth(
      session.user,
      session.org,
      session.access,
      session.refresh,
      session.capabilities,
      session.role,
      {
        membership: session.membership,
        inviteContext: null,
        orgs: session.orgs,
      },
    );
    trustDevice();
    setError('');
    onAuthSuccess();
  }

  async function submitLogin() {
    const email = loginEmail.trim().toLowerCase();
    if (!email || !loginPassword.trim()) {
      setError('Введите email и пароль.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const session = await api.post<AuthSessionResponse | null>('/auth/login/', {
        email,
        password: loginPassword,
      });

      if (!session) {
        setError('Аккаунт не найден. Проверьте данные или зарегистрируйтесь.');
        return;
      }

      applySession(session);
    } catch (cause) {
      setError(readAuthError(cause, 'Не удалось выполнить вход.'));
    } finally {
      setLoading(false);
    }
  }

  async function submitEmployeeRegistration() {
    if (!employeeName.trim() || !employeeEmail.trim() || !employeePassword.trim()) {
      setError('Заполните имя, email и пароль.');
      return;
    }

    if (employeePhone.trim() && !isKazakhPhoneComplete(employeePhone)) {
      setError('Телефон должен быть в формате +7 (___) ___-__-__.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const session = await api.post<AuthSessionResponse | null>('/auth/register/employee/', {
        full_name: employeeName.trim(),
        email: employeeEmail.trim().toLowerCase(),
        phone: normalizePhonePayload(employeePhone),
        password: employeePassword,
      });

      if (!session) {
        setError('Не удалось создать аккаунт сотрудника.');
        return;
      }

      applySession(session);
    } catch (cause) {
      setError(readAuthError(cause, 'Не удалось завершить регистрацию.'));
    } finally {
      setLoading(false);
    }
  }

  async function submitCompanyRegistration() {
    if (!companyName.trim() || !companyOwnerName.trim() || !companyEmail.trim() || !companyPassword.trim()) {
      setError('Заполните данные компании и владельца.');
      return;
    }

    if (companyPhone.trim() && !isKazakhPhoneComplete(companyPhone)) {
      setError('Телефон должен быть в формате +7 (___) ___-__-__.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const session = await api.post<AuthSessionResponse | null>('/auth/register/company/', {
        company_name: companyName.trim(),
        full_name: companyOwnerName.trim(),
        email: companyEmail.trim().toLowerCase(),
        phone: normalizePhonePayload(companyPhone),
        password: companyPassword,
      });

      if (!session) {
        setError('Не удалось создать компанию.');
        return;
      }

      applySession(session);
    } catch (cause) {
      setError(readAuthError(cause, 'Не удалось завершить регистрацию компании.'));
    } finally {
      setLoading(false);
    }
  }

  const backTarget: Partial<Record<Step, Step>> = {
    'choose-type': 'login',
    employee: 'choose-type',
    company: 'choose-type',
    pin: 'login',
  };

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <motion.div
          className={styles.panel}
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          transition={{ duration: 0.2 }}
        >
          <div className={styles.brandSide}>
            <div className={styles.brandHero}>
              <div className={styles.brandDisplay}>KORT</div>
            </div>

            <div className={styles.brandCarousel}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.article
                  key={activeStory.title}
                  className={styles.brandSlide}
                  initial={{ opacity: 0, x: 26, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -26, scale: 0.985 }}
                  transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className={styles.slideTop}>
                    <span className={styles.slideBadge}>
                      <ActiveStoryIcon size={14} />
                      {activeStory.label}
                    </span>
                    <span className={styles.slideCounter}>
                      {String(activeBrandSlide + 1).padStart(2, '0')}
                      {' / '}
                      {String(BRAND_CAROUSEL.length).padStart(2, '0')}
                    </span>
                  </div>

                  <BrandScenePreview scene={activeStory.scene} />

                  <div className={styles.slideCopy}>
                    <strong className={styles.slideTitle}>{activeStory.title}</strong>
                    <p className={styles.slideText}>{activeStory.description}</p>
                  </div>
                </motion.article>
              </AnimatePresence>

              <div className={styles.carouselDots} aria-label="Навигация по карточкам">
                {BRAND_CAROUSEL.map((story, index) => (
                  <button
                    key={story.title}
                    type="button"
                    className={`${styles.carouselDot} ${index === activeBrandSlide ? styles.carouselDotActive : ''}`}
                    onClick={() => setActiveBrandSlide(index)}
                    aria-label={`Показать карточку ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className={styles.formSide}>
            <div className={styles.formHeader}>
              <div className={styles.headerLeft}>
                {backTarget[step] && (
                  <button
                    type="button"
                    className={styles.backButton}
                    onClick={() => {
                      setError('');
                      setStep(backTarget[step]!);
                    }}
                  >
                    <ArrowLeft size={14} />
                    Назад
                  </button>
                )}
              </div>
              <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Закрыть">
                <X size={16} />
              </button>
            </div>

            <div className={styles.formViewport}>
              {step === 'pin' && (
                <PinStep
                  onSuccess={onAuthSuccess}
                  onUsePassword={() => {
                    setError('');
                    setStep('login');
                  }}
                />
              )}

              {step === 'login' && (
                <form
                  className={styles.stepContent}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitLogin();
                  }}
                >
                  <div className={styles.stepHeader}>
                    <h2 className={styles.title}>Вход</h2>
                    <p className={styles.subtitle}>
                      Аккаунт компании или сотрудника.
                    </p>
                    {inviteContext && (
                      <div className={styles.pinInfo}>
                        После входа аккаунт сразу подключится к компании «{inviteContext.companyName}».
                      </div>
                    )}
                  </div>

                  <div className={styles.formFields}>
                    <input
                      className={styles.input}
                      value={loginEmail}
                      onChange={(event) => {
                        setLoginEmail(event.target.value);
                        setError('');
                      }}
                      placeholder="Email"
                      autoComplete="email"
                    />
                    <PasswordField
                      value={loginPassword}
                      onChange={(value) => {
                        setLoginPassword(value);
                        setError('');
                      }}
                      placeholder="Пароль"
                      autoComplete="current-password"
                    />
                  </div>

                  {error && <div className={styles.errorMessage}>{error}</div>}

                  <button type="submit" className={styles.primaryButton} disabled={loading}>
                    <KeyRound size={16} />
                    {loading ? 'Входим...' : 'Войти'}
                  </button>

                  {pin && isTrustedDevice && user && (
                    <>
                      <div className={styles.orDivider}><span>или</span></div>
                      <button
                        type="button"
                        className={styles.pinButton}
                        onClick={() => {
                          setError('');
                          setStep('pin');
                        }}
                      >
                        <KeyRound size={15} />
                        Быстрый вход по PIN-коду
                      </button>
                    </>
                  )}

                  <div className={styles.footerRow}>
                    <span>Нет аккаунта?</span>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => {
                        setError('');
                        setStep('choose-type');
                      }}
                    >
                      Зарегистрироваться
                    </button>
                  </div>
                </form>
              )}

              {step === 'choose-type' && (
                <div className={styles.stepContent}>
                  <div className={styles.stepHeader}>
                    <h2 className={styles.title}>Продолжить как</h2>
                    <p className={styles.subtitle}>
                      Выберите тип аккаунта.
                    </p>
                  </div>

                  <div className={styles.typeGrid}>
                    <button
                      type="button"
                      className={`${styles.typeCard} ${styles.typeCardPrimary}`}
                      onClick={() => {
                        setError('');
                        setStep('company');
                      }}
                    >
                      <span className={styles.typeIcon}>
                        <Building2 size={18} />
                      </span>
                      <div className={styles.typeCardBody}>
                        <span className={styles.typeLabel}>
                          <span>Компания</span>
                          <ArrowUpRight size={15} />
                        </span>
                        <span className={styles.typeDesc}>
                          Создать компанию и сразу получить доступ владельца.
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`${styles.typeCard} ${styles.typeCardSecondary}`}
                      onClick={() => {
                        setError('');
                        setStep('employee');
                      }}
                    >
                      <span className={styles.typeIcon}>
                        <Blocks size={18} />
                      </span>
                      <div className={styles.typeCardBody}>
                        <span className={styles.typeLabel}>
                          <span>Сотрудник</span>
                          <ArrowUpRight size={15} />
                        </span>
                        <span className={styles.typeDesc}>
                          Создать профиль и подключиться к компании.
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {step === 'employee' && (
                <form
                  className={styles.stepContent}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitEmployeeRegistration();
                  }}
                >
                  <div className={styles.stepHeader}>
                    <h2 className={styles.title}>Регистрация сотрудника</h2>
                    <p className={styles.subtitle}>
                      Профиль создаётся сразу. Доступ к данным компании откроется после подключения.
                    </p>
                    {inviteContext && (
                      <div className={styles.pinInfo}>
                        Инвайт уже привяжет аккаунт к компании «{inviteContext.companyName}».
                      </div>
                    )}
                  </div>

                  <div className={styles.formFields}>
                    <input
                      className={styles.input}
                      value={employeeName}
                      onChange={(event) => {
                        setEmployeeName(event.target.value);
                        setError('');
                      }}
                      placeholder="ФИО"
                      autoComplete="name"
                    />
                    <input
                      className={styles.input}
                      value={employeeEmail}
                      onChange={(event) => {
                        setEmployeeEmail(event.target.value);
                        setError('');
                      }}
                      placeholder="Email"
                      autoComplete="email"
                    />
                    <input
                      className={styles.input}
                      value={employeePhone}
                      onChange={(event) => {
                        setEmployeePhone(formatKazakhPhoneInput(event.target.value));
                        setError('');
                      }}
                      placeholder="+7 (___) ___-__-__"
                      autoComplete="tel"
                      inputMode="tel"
                    />
                    <PasswordField
                      value={employeePassword}
                      onChange={(value) => {
                        setEmployeePassword(value);
                        setError('');
                      }}
                      placeholder="Пароль"
                      autoComplete="new-password"
                    />
                  </div>

                  {error && <div className={styles.errorMessage}>{error}</div>}

                  <button type="submit" className={styles.primaryButton} disabled={loading}>
                    <UserRoundPlus size={16} />
                    {loading ? 'Создаём аккаунт...' : 'Создать аккаунт сотрудника'}
                  </button>
                </form>
              )}

              {step === 'company' && (
                <form
                  className={styles.stepContent}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitCompanyRegistration();
                  }}
                >
                  <div className={styles.stepHeader}>
                    <h2 className={styles.title}>Регистрация компании</h2>
                    <p className={styles.subtitle}>
                      Компания создаётся сразу с доступом владельца.
                    </p>
                  </div>

                  <div className={styles.formFields}>
                    <input
                      className={styles.input}
                      value={companyName}
                      onChange={(event) => {
                        setCompanyName(event.target.value);
                        setError('');
                      }}
                      placeholder="Название компании"
                    />
                    <input
                      className={styles.input}
                      value={companyOwnerName}
                      onChange={(event) => {
                        setCompanyOwnerName(event.target.value);
                        setError('');
                      }}
                      placeholder="Имя владельца"
                      autoComplete="name"
                    />
                    <input
                      className={styles.input}
                      value={companyEmail}
                      onChange={(event) => {
                        setCompanyEmail(event.target.value);
                        setError('');
                      }}
                      placeholder="Email владельца"
                      autoComplete="email"
                    />
                    <input
                      className={styles.input}
                      value={companyPhone}
                      onChange={(event) => {
                        setCompanyPhone(formatKazakhPhoneInput(event.target.value));
                        setError('');
                      }}
                      placeholder="+7 (___) ___-__-__"
                      autoComplete="tel"
                      inputMode="tel"
                    />
                    <PasswordField
                      value={companyPassword}
                      onChange={(value) => {
                        setCompanyPassword(value);
                        setError('');
                      }}
                      placeholder="Пароль"
                      autoComplete="new-password"
                    />
                  </div>

                  {error && <div className={styles.errorMessage}>{error}</div>}

                  <button type="submit" className={styles.primaryButton} disabled={loading}>
                    <Building2 size={16} />
                    {loading ? 'Создаём компанию...' : 'Создать компанию'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
