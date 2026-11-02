import LandingHeader from "../landing/landing-header";
import Link from "next/link";
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
          Версія 1.1 · чинна з 30 жовтня 2026 року.<br />
          Офіційне товариство: <strong>AVEiron LIMITED LIABILITY COMPANY</strong> (ТОВ &quot;AVEiron&quot;).
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "40px", font: "400 16px/1.7 'DM Sans', sans-serif", color: "#d2d5cd" }}>
          <article style={{ borderBottom: "1px solid #2a2d28", paddingBottom: "32px" }}>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>1. Загальні положення</h2>
            <p>
              Ця Політика конфіденційності описує, як компанія <strong>AVEiron LIMITED LIABILITY COMPANY</strong> (&quot;ми&quot;, &quot;наш&quot; або &quot;ReviewRadar&quot;) збирає, використовує, зберігає та захищає персональні дані та інформацію користувачів під час використання платформи <strong>ReviewRadar</strong> (`https://reviewradar.reviewradar-vova445.workers.dev`).
            </p>
            <p style={{ marginTop: "12px" }}>
              Ця політика описує поточну обробку даних. Ми застосовуємо вимоги законодавства про приватність, зокрема GDPR там, де він застосовується, та правила Google OAuth User Data Policy.
            </p>
          </article>

          <article style={{ borderBottom: "1px solid #2a2d28", paddingBottom: "32px" }}>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>2. Інформація, яку ми збираємо</h2>
            <p>Під час роботи з платформою ReviewRadar ми можемо збирати наступні категорії даних:</p>
            <ul style={{ paddingLeft: "20px", marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <li><strong>Облікові дані акаунта:</strong> електронна пошта, ім&apos;я користувача та пароль у формі криптографічного хешу.</li>
              <li><strong>OAuth-токени:</strong> токени Google Business Profile, якщо ви підключили цю інтеграцію. Booking.com, Tripadvisor, Yelp та Facebook поки не доступні.</li>
              <li><strong>Публічні відгуки бізнесу:</strong> текстуальний зміст відгуків, оцінки (рейтинг), дати публікації та назви локацій.</li>
              <li><strong>Технічні дані:</strong> HttpOnly cookie сесії та похідний ключ IP-адреси й email для обмеження спроб входу.</li>
            </ul>
          </article>

          <article style={{ borderBottom: "1px solid #2a2d28", paddingBottom: "32px" }}>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>3. Використання даних Google OAuth (Google Limited Use Requirements)</h2>
            <p>
              ReviewRadar підключає Google Business Profile API за вашою згодою для синхронізації доступних відгуків локацій.
            </p>
            <ul style={{ paddingLeft: "20px", marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <li>Ми використовуємо токени Google виключно для отримання публічних відгуків вашого бізнесу.</li>
              <li>Ми не продаємо дані Google OAuth. Дані зберігаються в Cloudflare; Google обробляє OAuth-запити та надає дані профілю за вашою згодою.</li>
              <li>Поточна версія не надсилає відгуки до зовнішніх AI-провайдерів: AI-аналіз ще не ввімкнений.</li>
              <li>Всі OAuth-токени зберігаються в зашифрованому вигляді на серверному рівні й ніколи не передаються в браузер.</li>
            </ul>
          </article>

          <article style={{ borderBottom: "1px solid #2a2d28", paddingBottom: "32px" }}>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>4. Мета обробки даних</h2>
            <p>Зараз дані використовуються для авторизації Google Business Profile, синхронізації відгуків і показу рейтингу та базових аналітичних метрик у workspace.</p>
            <ul style={{ paddingLeft: "20px", marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <li>AI-кластеризація, інсайти, доставка сповіщень і тижневі звіти наразі не ввімкнені.</li>
            </ul>
          </article>

          <article style={{ borderBottom: "1px solid #2a2d28", paddingBottom: "32px" }}>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>5. Захист та зберігання даних</h2>
            <p>
              Безпека закладена в архітектуру ReviewRadar. Усі дані передаються через захищене шифроване з&apos;єднання HTTPS/TLS.
              Захищені API-маршрути перевіряють сесію користувача та його доступ до workspace. OAuth-токени шифруються AES-256-GCM перед збереженням.
            </p>
            <p style={{ marginTop: "12px" }}>
              Імпортований відгук Google, його текст, ім&apos;я автора, відповідь компанії та похідні записи зберігаються до 30 днів від першого імпорту. Повторна синхронізація не продовжує строк. Прострочені записи видаляються щоденним завданням; після відключення Google відгуки та пов&apos;язаний вміст видаляються під час обробки відключення. Дані акаунта зберігаються, поки він активний; для запиту щодо акаунта зверніться за адресою нижче.
            </p>
          </article>

          <article style={{ borderBottom: "1px solid #2a2d28", paddingBottom: "32px" }}>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>6. Постачальники інфраструктури</h2>
            <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <li><strong>Cloudflare, Inc.</strong> — виконання Worker і зберігання даних у D1.</li>
            </ul>
            <p style={{ marginTop: "12px" }}><strong>Інтегрована платформа:</strong> Google LLC надає OAuth та Google Business Profile API, якщо ви підключили цей сервіс.</p>
            <p style={{ marginTop: "12px" }}>Поточний код не інтегрує зовнішній AI-сервіс, сервіс email-розсилок або платформу доставки сповіщень.</p>
          </article>

          <article style={{ borderBottom: "1px solid #2a2d28", paddingBottom: "32px" }}>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>7. Права користувачів</h2>
            <p>Ви маєте право у будь-який момент:</p>
            <ul style={{ paddingLeft: "20px", marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <li>Відкликати доступ Google Business Profile у налаштуваннях інтеграції.</li>
              <li>Подати запит на доступ, виправлення або видалення даних за контактною адресою. Самообслуговуваний експорт наразі недоступний.</li>
            </ul>
          </article>

          <article>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>8. Контактна інформація компанії</h2>
            <p>З усіх питань стосовно Політики конфіденційності та обробки даних звертайтеся за реквізитами:</p>
            <div style={{ marginTop: "16px", padding: "20px", borderRadius: "16px", background: "#1c1f1a", border: "1px solid #32362e" }}>
              <p><strong>Компанія:</strong> AVEiron LIMITED LIABILITY COMPANY (ТОВ &quot;AVEiron&quot;)</p>
              <p><strong>Email для запитів:</strong> privacy@reviewradar.com / support@reviewradar.com</p>
              <p><strong>Вебсайт:</strong> <a href="https://reviewradar.reviewradar-vova445.workers.dev" style={{ color: "var(--orange)" }}>https://reviewradar.reviewradar-vova445.workers.dev</a></p>
            </div>
          </article>
        </div>

        <div style={{ marginTop: "60px", paddingTop: "30px", borderTop: "1px solid #2a2d28" }}>
          <Link href="/" style={{ color: "var(--orange)", textDecoration: "none", fontWeight: 700 }}>
            ← Повернутися на головну
          </Link>
        </div>
      </section>
    </main>
  );
}
