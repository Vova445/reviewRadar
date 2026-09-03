import LandingHeader from "../landing/landing-header";
import "../landing/landing.css";
import "../landing/header-footer.css";
import "../landing/header-footer-fix.css";

export const metadata = {
  title: "Політика конфіденційності — ReviewRadar",
  description: "Політика конфіденційності та обробки даних сервісу ReviewRadar компанії AVEiron LIMITED LIABILITY COMPANY.",
};

export default function PrivacyPage() {
  return (
    <main className="rrLanding" id="top" style={{ background: "#151713", color: "#f3f0e8", minHeight: "100vh" }}>
      <LandingHeader />

      <section style={{ padding: "clamp(130px, 15vh, 180px) clamp(24px, 5vw, 84px) 80px", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ color: "var(--orange)", fontSize: "11px", fontWeight: 800, letterSpacing: "0.18em", marginBottom: "16px" }}>
          LEGAL & PRIVACY POLICY
        </div>
        <h1 style={{ font: "750 clamp(36px, 5vw, 64px)/1.05 'Manrope', sans-serif", letterSpacing: "-0.05em", marginBottom: "32px" }}>
          Політика конфіденційності
        </h1>
        <p style={{ color: "#a0a49c", fontSize: "16px", lineHeight: "1.6", marginBottom: "48px" }}>
          Останнє оновлення: 2 вересня 2026 року.<br />
          Офіційне товариство: <strong>AVEiron LIMITED LIABILITY COMPANY</strong> (ТОВ &quot;AVEiron&quot;).
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "40px", font: "400 16px/1.7 'DM Sans', sans-serif", color: "#d2d5cd" }}>
          <article style={{ borderBottom: "1px solid #2a2d28", paddingBottom: "32px" }}>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>1. Загальні положення</h2>
            <p>
              Ця Політика конфіденційності описує, як компанія <strong>AVEiron LIMITED LIABILITY COMPANY</strong> (&quot;ми&quot;, &quot;наш&quot; або &quot;ReviewRadar&quot;) збирає, використовує, зберігає та захищає персональні дані та інформацію користувачів під час використання платформи <strong>ReviewRadar</strong> (`https://reviewradar.reviewradar-vova445.workers.dev`).
            </p>
            <p style={{ marginTop: "12px" }}>
              Ми поважаємо ваші права на приватність і прагнемо забезпечити максимальний захист усіх даних у відповідності до Загального регламенту про захист даних (GDPR) та стандартів Google OAuth User Data Policy.
            </p>
          </article>

          <article style={{ borderBottom: "1px solid #2a2d28", paddingBottom: "32px" }}>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>2. Інформація, яку ми збираємо</h2>
            <p>Під час роботи з платформою ReviewRadar ми можемо збирати наступні категорії даних:</p>
            <ul style={{ paddingLeft: "20px", marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <li><strong>Облікові дані акаунта:</strong> електронна пошта, ім&apos;я користувача, пароль у зашифрованому вигляді.</li>
              <li><strong>OAuth Токени доступу:</strong> авторизаційні токени Google Business Profile, Booking.com, Tripadvisor, Yelp та Facebook для синхронізації відгуків вашого бізнесу.</li>
              <li><strong>Публічні відгуки бізнесу:</strong> текстуальний зміст відгуків, оцінки (рейтинг), дати публікації та назви локацій.</li>
              <li><strong>Технічні дані:</strong> IP-адреса, файли cookies для підтримки захищеної сесії (HttpOnly cookies), логи доступу.</li>
            </ul>
          </article>

          <article style={{ borderBottom: "1px solid #2a2d28", paddingBottom: "32px" }}>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>3. Використання даних Google OAuth (Google Limited Use Requirements)</h2>
            <p>
              ReviewRadar підключається до сервісів Google (Google Business Profile API) виключно за вашою згодою для аналізу публічних відгуків ваших закладів.
            </p>
            <ul style={{ paddingLeft: "20px", marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <li>Ми використовуємо токени Google виключно для отримання публічних відгуків вашого бізнесу.</li>
              <li>Ми <strong>не передаємо</strong> і <strong>не продаємо</strong> ваші дані Google OAuth третім особам.</li>
              <li>Ми не використовуємо дані Google для цілей таргетованої реклами або навчання загальних штучних інтелектів без вашої дозволу.</li>
              <li>Всі OAuth-токени зберігаються в зашифрованому вигляді на серверному рівні й ніколи не передаються в браузер.</li>
            </ul>
          </article>

          <article style={{ borderBottom: "1px solid #2a2d28", paddingBottom: "32px" }}>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>4. Мета обробки даних</h2>
            <p>Збирані дані використовуються виключно для забезпечення функціональності платформи ReviewRadar:</p>
            <ul style={{ paddingLeft: "20px", marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <li>Кластеризація та аналіз тональності відгуків за допомогою алгоритмів AI.</li>
              <li>Виявлення операційних проблем та аномалій у репутації вашого бізнесу.</li>
              <li>Формування аналітичних звітів та сповіщень для вашої команди.</li>
            </ul>
          </article>

          <article style={{ borderBottom: "1px solid #2a2d28", paddingBottom: "32px" }}>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>5. Захист та зберігання даних</h2>
            <p>
              Безпека закладена в архітектуру ReviewRadar. Усі дані передаються через захищене шифроване з&apos;єднання HTTPS/TLS.
              Кожен запит проходить перевірку ізоляції workspace, токени зберігаються з використанням шифрування AES-256.
            </p>
          </article>

          <article style={{ borderBottom: "1px solid #2a2d28", paddingBottom: "32px" }}>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>6. Права користувачів</h2>
            <p>Ви маєте право у будь-який момент:</p>
            <ul style={{ paddingLeft: "20px", marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <li>Відкликати доступ до OAuth-акаунтів (Google, Booking, тощо).</li>
              <li>Запитувати видалення всіх ваших персональних даних та інтеграцій з нашої бази даних.</li>
              <li>Отримати експорт ваших даних у форматі JSON.</li>
            </ul>
          </article>

          <article>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>7. Контактна інформація компанії</h2>
            <p>З усіх питань стосовно Політики конфіденційності та обробки даних звертайтеся за реквізитами:</p>
            <div style={{ marginTop: "16px", padding: "20px", borderRadius: "16px", background: "#1c1f1a", border: "1px solid #32362e" }}>
              <p><strong>Компанія:</strong> AVEiron LIMITED LIABILITY COMPANY (ТОВ &quot;AVEiron&quot;)</p>
              <p><strong>Email для запитів:</strong> privacy@reviewradar.com / support@reviewradar.com</p>
              <p><strong>Вебсайт:</strong> <a href="https://reviewradar.reviewradar-vova445.workers.dev" style={{ color: "var(--orange)" }}>https://reviewradar.reviewradar-vova445.workers.dev</a></p>
            </div>
          </article>
        </div>

        <div style={{ marginTop: "60px", paddingTop: "30px", borderTop: "1px solid #2a2d28" }}>
          <a href="/" style={{ color: "var(--orange)", textDecoration: "none", fontWeight: 700 }}>
            ← Повернутися на головну
          </a>
        </div>
      </section>
    </main>
  );
}
