"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LanguageToggle, useLanguage } from "../components/language";
import "./onboarding.css";
import "./onboarding-a11y.css";

type OnboardingData = {
  user: { email: string; name: string | null };
  workspace: { name: string };
  state: { currentStep: number; completedSteps: number[]; selectedLocationIds: string[] };
  connection: string;
  locations: { id: string; name: string; provider_location_id: string; city: string | null; country: string | null; selected: number | null }[];
  sync: { jobs: { status: string; count: number }[]; reviews: number };
};

const ui = {
  uk: {
    labels: ["Акаунт", "Google", "Локації", "Перший звіт"],
    eyebrow: "ПОЧАТОК РОБОТИ · REVIEWRADAR", title: ["Ваш акаунт", "Підключіть Google", "Оберіть локації", "Готуємо перший звіт"],
    copy: ["Перевірте профіль і налаштуйте робочий простір.", "Підключіть Google Business Profile, щоб імпортувати відгуки.", "Виберіть локації, за якими ReviewRadar стежитиме.", "ReviewRadar синхронізує відгуки. Прогрес оновлюється автоматично."],
    continue: "Продовжити", connect: "Підключити Google", reconnect: "Спробувати ще раз", connected: "Google підключено", choose: "Обрати локації", selected: "обрано", loading: "Завантаження…", noLocations: "Google не повернув доступних локацій.", noLocationsHelp: "Переконайтеся, що ваш акаунт керує локаціями Business Profile і в Google Cloud увімкнено Business Profile API.", retry: "Оновити локації", back: "Назад", goDashboard: "Перейти до панелі", progress: "Прогрес синхронізації", reviews: "відгуків отримано", wait: "Синхронізація триває. Можна залишити цю сторінку — прогрес збережеться.", error: "Не вдалося завантажити стан майстра.", googleDenied: "Google не надав доступ. Ваш акаунт не змінено. Спробуйте підключитися ще раз або перевірте доступ до Business Profile.", googleConfig: "Не вдалося налаштувати Google OAuth. Перевірте GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, точний GOOGLE_REDIRECT_URI та дозвіл потрібних Business Profile API у Google Cloud.", account: "Профіль", workspace: "Робочий простір", step: "Крок", of: "з", completed: "Готово", syncStatus: { queued: "У черзі", running: "Синхронізується", retry: "Повторна спроба", completed: "Завершено", failed: "Помилка", revoked: "Доступ відкликано" } as Record<string, string>,
  },
  en: {
    labels: ["Account", "Google", "Locations", "First report"],
    eyebrow: "GETTING STARTED · REVIEWRADAR", title: ["Your account", "Connect Google", "Choose locations", "Preparing your first report"],
    copy: ["Review your profile and set up your workspace.", "Connect Google Business Profile to import your reviews.", "Choose the locations ReviewRadar should monitor.", "ReviewRadar is syncing your reviews. Progress updates automatically."],
    continue: "Continue", connect: "Connect Google", reconnect: "Try again", connected: "Google connected", choose: "Choose locations", selected: "selected", loading: "Loading…", noLocations: "Google returned no available locations.", noLocationsHelp: "Make sure your account manages Business Profile locations and the Business Profile APIs are enabled in Google Cloud.", retry: "Refresh locations", back: "Back", goDashboard: "Open dashboard", progress: "Sync progress", reviews: "reviews received", wait: "Sync is in progress. You can leave this page; your progress is saved.", error: "Could not load your onboarding state.", googleDenied: "Google did not grant access. Your account was not changed. Try connecting again or check your Business Profile access.", googleConfig: "Google OAuth could not be configured. Check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, the exact GOOGLE_REDIRECT_URI, and the required Business Profile APIs in Google Cloud.", account: "Profile", workspace: "Workspace", step: "Step", of: "of", completed: "Done", syncStatus: { queued: "Queued", running: "Syncing", retry: "Retrying", completed: "Complete", failed: "Failed", revoked: "Access revoked" } as Record<string, string>,
  },
};

export default function Onboarding() {
  const router = useRouter();
  const { language } = useLanguage();
  const t = ui[language];
  const [data, setData] = useState<OnboardingData | null>(null);
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const initialRoute = useRef(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/onboarding", { cache: "no-store" });
    if (response.status === 401) { router.replace("/auth?next=%2Fonboarding"); return; }
    if (!response.ok) throw new Error("state_failed");
    const next = await response.json() as OnboardingData;
    setData(next);
    setSelected(next.locations.filter((location) => location.selected === 1).map((location) => location.provider_location_id));
    if (!initialRoute.current) {
      initialRoute.current = true;
      const requested = Number(new URLSearchParams(window.location.search).get("step"));
      setStep(requested >= 1 && requested <= 4 ? requested : next.state.currentStep);
      window.history.replaceState({}, "", "/onboarding");
    }
  }, [router]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const oauthError = query.get("error");
    if (oauthError) Promise.resolve().then(() => setNotice(oauthError === "access_denied" ? t.googleDenied : t.googleConfig));
    const timer = window.setTimeout(() => { load().catch(() => setError(t.error)); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, t.error, t.googleConfig, t.googleDenied]);

  useEffect(() => {
    if (step !== 4) return;
    const timer = window.setInterval(() => { load().catch(() => undefined); }, 3000);
    return () => window.clearInterval(timer);
  }, [step, load]);

  async function saveStep(nextStep: number, completed = true, selectedLocationIds?: string[]) {
    const response = await fetch("/api/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step: nextStep, completed, ...(selectedLocationIds ? { selectedLocationIds } : {}) }) });
    if (!response.ok) throw new Error("save_failed");
    setStep(completed ? Math.min(4, nextStep + 1) : nextStep);
    await load();
  }

  async function connectGoogle() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/v1/integrations/google/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnUrl: "/onboarding?step=3" }) });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "google_setup_failed");
      window.location.assign(result.url);
    } catch { setNotice(t.googleConfig); setBusy(false); }
  }

  async function selectLocations() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/v1/integrations/google/locations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locations: selected }) });
      if (!response.ok) { const result = await response.json() as { error?: string }; throw new Error(result.error || "selection_failed"); }
      await saveStep(3, true, selected);
    } catch { setError(t.noLocationsHelp); }
    finally { setBusy(false); }
  }

  const statuses = data?.sync.jobs ?? [];
  const total = statuses.reduce((sum, item) => sum + item.count, 0);
  const done = statuses.filter((item) => ["completed", "failed", "revoked"].includes(item.status)).reduce((sum, item) => sum + item.count, 0);
  const percent = total ? Math.round(done / total * 100) : 0;

  return <main className="onboarding">
    <header><Link className="obLogo" href="/"><b>R</b>Review<span>Radar</span></Link><span>{t.eyebrow}</span><LanguageToggle/><a href="/dashboard">×</a></header>
    <nav className="obSteps" aria-label="Onboarding progress">{t.labels.map((label, index) => <div key={label} className={step === index + 1 ? "active" : (data?.state.completedSteps.includes(index + 1) ? "done" : "")}><b>{data?.state.completedSteps.includes(index + 1) ? "✓" : `0${index + 1}`}</b><span>{label}</span></div>)}</nav>
    <section className={`obCard ${step >= 3 ? "wide" : ""}`}>
      <div className="obIntro"><small>{t.step} 0{step} {t.of} 04</small><h1>{t.title[step - 1]}</h1><p>{t.copy[step - 1]}</p></div>
      {notice && <div className="obNotice" role="alert">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
      {error && <div className="obNotice" role="alert">{error}</div>}
      {!data ? <p role="status">{t.loading}</p> : step === 1 ? <>
        <div className="obAccount"><span>{t.account}</span><b>{data.user.name || data.user.email}</b><small>{data.user.email}</small><span>{t.workspace}</span><b>{data.workspace.name}</b></div>
        <button className="obPrimary" onClick={() => saveStep(1).catch(() => setError(t.error))}>{t.continue} →</button>
      </> : step === 2 ? <>
        <div className="connectGoogle"><b>G</b><span><strong>Google Business Profile</strong><small>{data.connection === "connected" ? t.connected : "OAuth · secure connection"}</small></span><em>{data.connection === "connected" ? "✓" : ""}</em></div>
        <ul className="permissionList"><li>✓ {language === "en" ? "Read managed business locations" : "Перегляд керованих бізнес-локацій"}</li><li>✓ {language === "en" ? "Import customer reviews" : "Імпорт відгуків клієнтів"}</li><li>✓ {language === "en" ? "Tokens encrypted on the server" : "Токени шифруються на сервері"}</li></ul>
        <div className="obActions">{data.connection === "connected" ? <button className="obPrimary" onClick={() => saveStep(2).catch(() => setError(t.error))}>{t.continue} →</button> : <button className="obPrimary" disabled={busy} onClick={connectGoogle}>{busy ? t.loading : (notice ? t.reconnect : t.connect)} →</button>}</div>
      </> : step === 3 ? <>
        {data.connection !== "connected" ? <div className="obNotice">{t.googleDenied}<button onClick={() => setStep(2)}>{t.back}</button></div> : data.locations.length === 0 ? <div className="obNotice"><b>{t.noLocations}</b><p>{t.noLocationsHelp}</p><a href="/integrations/google/locations">{t.retry}</a></div> : <>
          <div className="obToolbar"><span><b>{selected.length}</b> {t.selected}</span><button onClick={() => setSelected(selected.length === data.locations.length ? [] : data.locations.map((location) => location.provider_location_id))}>{selected.length === data.locations.length ? (language === "en" ? "Clear all" : "Скасувати вибір") : (language === "en" ? "Select all" : "Обрати всі")}</button></div>
          <div className="obLocations">{data.locations.map((location) => { const checked = selected.includes(location.provider_location_id); return <button key={location.id} className={checked ? "selected" : ""} aria-pressed={checked} onClick={() => setSelected((current) => checked ? current.filter((id) => id !== location.provider_location_id) : [...current, location.provider_location_id])}><i>{checked ? "✓" : ""}</i><span><b>{location.name}</b><small>{[location.city, location.country].filter(Boolean).join(", ")}</small></span></button>; })}</div>
          <div className="obActions"><button className="obBack" onClick={() => { setStep(2); void saveStep(2, false); }}>{t.back}</button><button className="obPrimary" disabled={!selected.length || busy} onClick={selectLocations}>{busy ? t.loading : t.choose} →</button></div>
        </>}
      </> : <>
        <div className="obProgress"><div className="radarPulse"><b>R</b><i/><em/></div><h2>{t.progress}</h2><div className="progressTrack"><i style={{ width: `${total ? percent : 5}%` }}/></div><strong>{total ? `${percent}%` : t.loading}</strong><div className="obSyncStats"><span>{data.sync.reviews} {t.reviews}</span>{statuses.map((status) => <span key={status.status}>{t.syncStatus[status.status] || status.status}: {status.count}</span>)}</div><p>{t.wait}</p></div>
        <a className="dashboardLink" href="/dashboard">{t.goDashboard} →</a>
      </>}
    </section>
    <footer>REVIEWRADAR · REPUTATION INTELLIGENCE</footer>
  </main>;
}
