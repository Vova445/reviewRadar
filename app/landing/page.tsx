"use client";
import { useEffect, type CSSProperties } from "react";
import Link from "next/link";
import "./landing.css";
import "./header-footer.css";
import "./header-footer-fix.css";
import "./signal-wow.css";
import "./sections-wow.css";
import LandingHeader from "./landing-header";
import { useLanguage } from "../components/language";

const sources = [
  "Google Business Profile",
  "Booking.com",
  "Tripadvisor",
  "Yelp",
  "Facebook",
];
const marquee = [...sources, ...sources, ...sources, ...sources];
const landingEnglish = new Map<string, string>([
  ["Відгуки говорять.", "Reviews speak."],
  [" слухає.", " listens."],
  [
    "Збирайте реальний голос клієнтів в одному місці. Помічайте проблеми раніше. Розумійте, що робити далі.",
    "Bring the real voice of your customers into one place. Spot problems earlier. Know what to do next.",
  ],
  ["Створити акаунт ", "Create account "],
  ["Без демо-даних. Тільки ваші відгуки.", "No demo data. Only your reviews."],
  ["01 / ЧОМУ REVIEWRADAR", "01 / WHY REVIEWRADAR"],
  ["Не читайте сотні відгуків.", "Don’t read hundreds of reviews."],
  ["Побачте один сигнал.", "See one clear signal."],
  [
    "Окремий відгук — це думка. Повторюваний патерн — це бізнес-проблема.",
    "One review is an opinion. A recurring pattern is a business problem.",
  ],
  [
    "ReviewRadar структурує потік зворотного зв’язку, щоб власник за кілька секунд розумів: що змінилося, чому це важливо і де діяти.",
    "ReviewRadar structures customer feedback so an owner can understand in seconds what changed, why it matters and where to act.",
  ],
  ["Різні слова.", "Different words."],
  ["Одна проблема.", "One problem."],
  [
    "ReviewRadar перетворює шум відгуків на структурований сигнал, який можна вимірювати й відстежувати.",
    "ReviewRadar turns review noise into a structured signal you can measure and track.",
  ],
  ["02 / ЩО ВИ ОТРИМУЄТЕ", "02 / WHAT YOU GET"],
  ["Від хаосу", "From chaos"],
  ["до ясності.", "to clarity."],
  [
    "AI об’єднує різні формулювання в одну зрозумілу тему.",
    "AI groups different phrases into one clear topic.",
  ],
  [
    "Помічає різкі зміни раніше, ніж вони стають рейтингом.",
    "Spots sharp changes before they affect your rating.",
  ],
  [
    "Не просто “негатив”. Конкретний наступний крок для команди.",
    "Not just ‘negative’. A concrete next step for your team.",
  ],
  [
    "Одна картина для всього бізнесу. Окремий фокус для кожної локації.",
    "One picture for the entire business. A focused view for every location.",
  ],
  ["03 / ЯК ЦЕ ПРАЦЮЄ", "03 / HOW IT WORKS"],
  ["Від джерела", "From source"],
  ["до рішення.", "to action."],
  [
    "Один надійний pipeline. Кожен крок залишає структурований, перевірений результат.",
    "One reliable pipeline. Every step produces a structured, verified result.",
  ],
  ["Підключення", "Connect"],
  [
    "Авторизуйте власний бізнес-акаунт і виберіть локації.",
    "Authorize your business account and select locations.",
  ],
  ["Синхронізація", "Sync"],
  [
    "Worker безпечно отримує та нормалізує доступні відгуки.",
    "A worker securely retrieves and normalizes available reviews.",
  ],
  ["Аналіз", "Analysis"],
  [
    "AI повертає тональність, теми та терміновість у валідованому JSON.",
    "AI returns sentiment, topics and urgency as validated JSON.",
  ],
  ["Рішення", "Action"],
  [
    "Аномалії стають зрозумілими інсайтами, сповіщеннями й діями.",
    "Anomalies become clear insights, alerts and actions.",
  ],
  ["Захист — частина", "Security is part"],
  ["архітектури.", "of the architecture."],
  [
    "Доступ перевіряється на кожному рівні: від сесії користувача до конкретного workspace та зовнішнього джерела.",
    "Access is verified at every level, from the user session to a specific workspace and external source.",
  ],
  ["Ізоляція workspace", "Workspace isolation"],
  [
    "Кожен запит прив’язаний до авторизованого простору.",
    "Every request is tied to an authorized workspace.",
  ],
  ["Секрети на сервері", "Server-side secrets"],
  [
    "OAuth credentials ніколи не потрапляють у браузер.",
    "OAuth credentials never reach the browser.",
  ],
  ["Чесний стан даних", "Honest data state"],
  [
    "Немає синхронізації — немає вигаданих показників.",
    "No sync means no invented metrics.",
  ],
  ["Будьте готові", "Be ready"],
  ["почути головне.", "to hear what matters."],
  ["Сигнали з реальних відгуків.", "Signals from real reviews."],
  ["Рішення для реального бізнесу.", "Decisions for real businesses."],
  ["НАВІГАЦІЯ", "NAVIGATION"],
  ["Можливості", "Features"],
  ["Як працює", "How it works"],
  ["Безпека", "Security"],
  ["АКАУНТ", "ACCOUNT"],
  ["Увійти", "Sign in"],
  ["Реєстрація", "Register"],
  ["МОВА / REGION", "LANGUAGE / REGION"],
  ["Українська / English", "Ukrainian / English"],
  ["На початок ", "Back to top "],
  ["Політика конфіденційності", "Privacy Policy"],
  ["Умови використання", "Terms of Service"],
  ["СОЦМЕРЕЖІ", "SOCIALS"],
]);
const landingUkrainian = new Map(
  Array.from(landingEnglish, ([uk, en]) => [en, uk]),
);
function useLandingTranslation(en: boolean) {
  useEffect(() => {
    const root = document.querySelector(".rrLanding");
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.nodeValue;
      if (!text) continue;
      const translated = (en ? landingEnglish : landingUkrainian).get(text);
      if (translated) node.nodeValue = translated;
    }
  }, [en]);
}

function FeatureIcon({ name }: { name: string }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "cluster":
      return (
        <svg {...common}>
          <circle cx="6" cy="7" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <circle cx="8" cy="18" r="2.5" />
          <circle cx="18" cy="17" r="2.5" />
          <path d="M8.4 7.8l7.2-1M7.3 9.2l.9 6.3m2.2 1.9l5.1-.3m1.5-8.7l.7 6" />
        </svg>
      );
    case "trend":
      return (
        <svg {...common}>
          <path d="M4 18V6m0 12h16" />
          <path d="m7 15 4-4 3 2 5-6" />
          <path d="M15 7h4v4" />
        </svg>
      );
    case "spark":
      return (
        <svg {...common}>
          <path d="M12 3c.7 4.6 2.4 6.3 7 7-4.6.7-6.3 2.4-7 7-.7-4.6-2.4-6.3-7-7 4.6-.7 6.3-2.4 7-7Z" />
          <path d="M19 16c.2 1.8.9 2.5 2.7 2.7-1.8.2-2.5.9-2.7 2.7-.2-1.8-.9-2.5-2.7-2.7 1.8-.2 2.5-.9 2.7-2.7Z" />
        </svg>
      );
    case "locations":
      return (
        <svg {...common}>
          <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" />
          <circle cx="12" cy="10" r="2" />
        </svg>
      );
    case "connect":
      return (
        <svg {...common}>
          <path d="M8.5 15.5 6 18a3.5 3.5 0 1 1-5-5l3-3a3.5 3.5 0 0 1 5 0" />
          <path d="m15.5 8.5 2.5-2.5a3.5 3.5 0 1 1 5 5l-3 3a3.5 3.5 0 0 1-5 0M8 12h8" />
        </svg>
      );
    case "sync":
      return (
        <svg {...common}>
          <path d="M20 7h-6V1" />
          <path d="M20 7a9 9 0 0 0-15.5-3M4 17h6v6" />
          <path d="M4 17a9 9 0 0 0 15.5 3" />
        </svg>
      );
    case "analysis":
      return (
        <svg {...common}>
          <path d="M4 19V9m5 10V5m5 14v-7m5 7V3" />
          <path d="M2 21h20" />
        </svg>
      );
    case "action":
      return (
        <svg {...common}>
          <path d="m14 3 7 7-11 11H3v-7L14 3Z" />
          <path d="m12 5 7 7M3 21l5-5" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common}>
          <rect x="4" y="10" width="16" height="11" rx="3" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
        </svg>
      );
    case "key":
      return (
        <svg {...common}>
          <circle cx="8" cy="15" r="4" />
          <path d="m11 12 9-9m-3 3 3 3m-6 0 3 3" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 4 6v5c0 5.2 3.2 8.2 8 10 4.8-1.8 8-4.8 8-10V6l-8-3Z" />
          <path d="m9 12 2 2 4-5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
      );
  }
}

export default function LandingPage() {
  const { language } = useLanguage();
  const en = language === "en";
  useLandingTranslation(en);
  return (
    <main className="rrLanding" id="top">
      <LandingHeader />

      <section className="rrHero">
        <div className="rrGlow one" />
        <div className="rrGlow two" />
        <div className="rrKicker">
          <i />
          REPUTATION INTELLIGENCE · UA / EN
        </div>
        <h1>
          Відгуки говорять.
          <br />
          <em>ReviewRadar</em> слухає.
        </h1>
        <div className="rrHeroFoot">
          <p>
            Збирайте реальний голос клієнтів в одному місці. Помічайте проблеми
            раніше. Розумійте, що робити далі.
          </p>
          <div>
            <a href="/auth?mode=signup">
              Створити акаунт <b>↗</b>
            </a>
            <span>
              <i />
              Без демо-даних. Тільки ваші відгуки.
            </span>
          </div>
        </div>
        <div className="rrRadar" aria-hidden="true">
          <div className="rrSweep" />
          <b>R</b>
          <i className="dot a" />
          <i className="dot b" />
          <i className="dot c" />
          <span className="pulse p1" />
          <span className="pulse p2" />
        </div>
        <div className="rrScroll">
          SCROLL TO DISCOVER <i>↓</i>
        </div>
      </section>

      <div className="rrTicker" aria-label="Supported review platforms">
        <div className="rrTickerTrack">
          {marquee.map((source, index) => (
            <span key={`${source}-${index}`}>
              {source}
              <i>✦</i>
            </span>
          ))}
        </div>
      </div>

      <section className="rrProblem" id="why">
        <div className="rrEyebrow">01 / ЧОМУ REVIEWRADAR</div>
        <div className="rrProblemGrid">
          <h2>
            Не читайте сотні відгуків.
            <br />
            <em>Побачте один сигнал.</em>
          </h2>
          <div>
            <p>
              Окремий відгук — це думка. Повторюваний патерн — це
              бізнес-проблема.
            </p>
            <p>
              ReviewRadar структурує потік зворотного зв’язку, щоб власник за
              кілька секунд розумів: що змінилося, чому це важливо і де діяти.
            </p>
          </div>
        </div>
        <div className="rrSignalStage">
          <div className="rrSignalCanvas">
            <div className="rrCanvasHead">
              <span>LIVE CLUSTERING PREVIEW</span>
              <b>
                <i />
                SIGNAL FOUND
              </b>
            </div>
            <svg
              className="rrConnections"
              viewBox="0 0 900 500"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M130 110 C290 95 330 215 455 250" />
              <path d="M170 350 C285 330 330 285 455 250" />
              <path d="M330 92 C370 140 400 180 455 250" />
              <path d="M320 410 C380 350 405 310 455 250" />
              <path d="M680 105 C610 145 540 185 455 250" />
              <path d="M720 360 C620 330 550 290 455 250" />
            </svg>
            <div className="rrTopicCore">
              <span>CANONICAL TOPIC</span>
              <b>
                Waiting
                <br />
                time
              </b>
              <small>AI grouped signal</small>
              <i />
              <i />
            </div>
            {[
              ["slow service", "12%", "17%", "0s"],
              ["long wait", "17%", "69%", ".7s"],
              ["waited too long", "36%", "13%", "1.4s"],
              ["service was slow", "34%", "82%", ".3s"],
              ["черга", "72%", "16%", "1s"],
              ["довго чекали", "76%", "70%", "1.8s"],
            ].map(([word, x, y, delay]) => (
              <span
                className="rrReviewChip"
                key={word}
                style={
                  { "--x": x, "--y": y, "--delay": delay } as CSSProperties
                }
              >
                <i>“</i>
                {word}
                <b />
              </span>
            ))}
            <div className="rrScanBeam" />
          </div>
          <aside className="rrSignal">
            <div className="rrSignalTop">
              <small>PATTERN DETECTED</small>
              <span>01</span>
            </div>
            <b>
              Різні слова.
              <br />
              Одна проблема.
            </b>
            <p>
              ReviewRadar перетворює шум відгуків на структурований сигнал, який
              можна вимірювати й відстежувати.
            </p>
            <div className="rrSignalRoute">
              <span>PHRASES</span>
              <i>→</i>
              <span>TOPIC</span>
              <i>→</i>
              <strong>ACTION</strong>
            </div>
          </aside>
        </div>
      </section>

      <section className="rrBento">
        <div className="rrBentoTitle">
          <span>02 / ЩО ВИ ОТРИМУЄТЕ</span>
          <h2>
            Від хаосу
            <br />
            до ясності.
          </h2>
        </div>
        <div className="rrBentoGrid">
          <article className="wide dark">
            <div className="rrCardIcon">
              <FeatureIcon name="cluster" />
            </div>
            <small>TOPIC CLUSTERS</small>
            <h3>AI об’єднує різні формулювання в одну зрозумілу тему.</h3>
            <div className="rrCluster">
              <span>“довго чекали”</span>
              <span>“slow service”</span>
              <span>“waited too long”</span>
              <b>→ WAITING TIME</b>
            </div>
          </article>
          <article className="coral">
            <div className="rrCardIcon">
              <FeatureIcon name="trend" />
            </div>
            <small>ANOMALY RADAR</small>
            <h3>Помічає різкі зміни раніше, ніж вони стають рейтингом.</h3>
            <div className="rrWave">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </article>
          <article>
            <div className="rrCardIcon">
              <FeatureIcon name="spark" />
            </div>
            <small>ACTION LAYER</small>
            <h3>Не просто “негатив”. Конкретний наступний крок для команди.</h3>
            <div className="rrActionLine">
              <i>01</i>
              <span>Issue</span>
              <b>→</b>
              <span>Reason</span>
              <b>→</b>
              <span>Action</span>
            </div>
          </article>
          <article className="wide">
            <div className="rrCardIcon">
              <FeatureIcon name="locations" />
            </div>
            <small>MULTI-LOCATION</small>
            <h3>
              Одна картина для всього бізнесу. Окремий фокус для кожної локації.
            </h3>
            <div className="rrLocations">
              <span>
                LVIV
                <i />
              </span>
              <span>
                KYIV
                <i />
              </span>
              <span>
                WARSAW
                <i />
              </span>
              <span>
                KRAKOW
                <i />
              </span>
            </div>
          </article>
        </div>
      </section>

      <section className="rrFlow" id="flow">
        <div className="rrFlowHead">
          <span>03 / ЯК ЦЕ ПРАЦЮЄ</span>
          <h2>
            Від джерела
            <br />
            до рішення.
          </h2>
          <p>
            Один надійний pipeline. Кожен крок залишає структурований,
            перевірений результат.
          </p>
        </div>
        <div className="rrPipeline">
          <div className="rrPipelineRail">
            <i />
            <b />
          </div>
          {[
            [
              "connect",
              "01",
              "Підключення",
              "Авторизуйте власний бізнес-акаунт і виберіть локації.",
              "OAUTH",
            ],
            [
              "sync",
              "02",
              "Синхронізація",
              "Worker безпечно отримує та нормалізує доступні відгуки.",
              "QUEUE",
            ],
            [
              "analysis",
              "03",
              "Аналіз",
              "AI повертає тональність, теми та терміновість у валідованому JSON.",
              "AI + ZOD",
            ],
            [
              "action",
              "04",
              "Рішення",
              "Аномалії стають зрозумілими інсайтами, сповіщеннями й діями.",
              "INSIGHT",
            ],
          ].map(([icon, n, title, text, tag]) => (
            <article key={n}>
              <div className="rrPipelineIcon">
                <FeatureIcon name={icon} />
                <span>{n}</span>
              </div>
              <div>
                <small>{tag}</small>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
              <b>↗</b>
            </article>
          ))}
        </div>
        <div className="rrFlowOutput">
          <span>
            <i />
            PIPELINE OUTPUT
          </span>
          <p>Raw review</p>
          <b>→</b>
          <p>Structured signal</p>
          <b>→</b>
          <strong>Clear action</strong>
        </div>
      </section>

      <section className="rrTrust" id="trust">
        <div className="rrTrustVisual">
          <div className="rrTrustGrid" />
          <div className="rrTrustRing outer">
            <span>WORKSPACE BOUNDARY</span>
          </div>
          <div className="rrTrustRing middle">
            <span>ENCRYPTED LAYER</span>
          </div>
          <div className="rrTrustCore">
            <FeatureIcon name="lock" />
            <b>YOUR DATA</b>
            <small>SERVER PROTECTED</small>
          </div>
          <div className="rrTrustBadge token">
            <FeatureIcon name="key" />
            <span>
              OAuth tokens<b>Server only</b>
            </span>
          </div>
          <div className="rrTrustBadge session">
            <FeatureIcon name="shield" />
            <span>
              Session<b>HttpOnly</b>
            </span>
          </div>
          <div className="rrTrustBadge verify">
            <FeatureIcon name="check" />
            <span>
              Source<b>Verified</b>
            </span>
          </div>
        </div>
        <div className="rrTrustCopy">
          <span>04 / TRUST BY DESIGN</span>
          <h2>
            Захист — частина
            <br />
            архітектури.
          </h2>
          <p>
            Доступ перевіряється на кожному рівні: від сесії користувача до
            конкретного workspace та зовнішнього джерела.
          </p>
          <div className="rrTrustRules">
            <article>
              <b>01</b>
              <div>
                <h3>Ізоляція workspace</h3>
                <p>Кожен запит прив’язаний до авторизованого простору.</p>
              </div>
            </article>
            <article>
              <b>02</b>
              <div>
                <h3>Секрети на сервері</h3>
                <p>OAuth credentials ніколи не потрапляють у браузер.</p>
              </div>
            </article>
            <article>
              <b>03</b>
              <div>
                <h3>Чесний стан даних</h3>
                <p>Немає синхронізації — немає вигаданих показників.</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <footer className="rrFooter">
        <div className="rrFooterGlow" />
        <div className="rrFooterCta">
          <div>
            <span>THE NEXT REVIEW IS ALREADY ON ITS WAY</span>
            <h2>
              Будьте готові
              <br />
              <em>почути головне.</em>
            </h2>
          </div>
        </div>
        <div className="rrFooterRule" />
        <div className="rrFooterTop">
          <div className="rrFooterBrand">
            <Link href="/" className="rrLogo light">
              <b>R</b>
              <span>ReviewRadar</span>
            </Link>
            <p>
              Сигнали з реальних відгуків.
              <br />
              Рішення для реального бізнесу.
            </p>
            <span className="rrSystem">
              <i />
              SYSTEM READY
            </span>
            <div
              style={{
                marginTop: "16px",
                color: "#8a8e85",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}
            >
              AVEiron LIMITED LIABILITY COMPANY
            </div>
          </div>
          <div>
            <small>НАВІГАЦІЯ</small>
            <a href="#why">Можливості</a>
            <a href="#flow">Як працює</a>
            <a href="#trust">Безпека</a>
          </div>
          <div>
            <small>АКАУНТ & ЮРИДИЧНЕ</small>
            <a href="/auth">Увійти</a>
            <a href="/auth?mode=signup">Реєстрація</a>
            <a href="/privacy">Політика конфіденційності</a>
            <a href="/terms">Умови використання</a>
          </div>
          <div>
            <small>СОЦМЕРЕЖІ</small>
            <a href="https://t.me" target="_blank" rel="noopener noreferrer">
              Telegram ↗
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn ↗
            </a>
            <a href="https://x.com" target="_blank" rel="noopener noreferrer">
              X (Twitter) ↗
            </a>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Facebook ↗
            </a>
            <a className="rrToTop" href="#top">
              На початок <i>↑</i>
            </a>
          </div>
        </div>
        <div className="rrFooterWord">
          <span>REVIEW</span>
          <span>RADAR</span>
        </div>
        <div className="rrFooterBottom">
          <span>
            © 2026 AVEiron LIMITED LIABILITY COMPANY. Всі права захищені.
          </span>
          <span>Privacy-first reputation intelligence</span>
          <span>Built for businesses that listen.</span>
        </div>
      </footer>
    </main>
  );
}
