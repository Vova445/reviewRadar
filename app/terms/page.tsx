import LandingHeader from "../landing/landing-header";
import Link from "next/link";
import "../landing/landing.css";
import "../landing/header-footer.css";
import "../landing/header-footer-fix.css";

export const metadata = {
  title: "Умови використання — ReviewRadar",
  description: "Умови використання та публічний договір платформи ReviewRadar компанії AVEiron LIMITED LIABILITY COMPANY.",
};

export default function TermsPage() {
  return (
    <main className="rrLanding" id="top" style={{ background: "#151713", color: "#f3f0e8", minHeight: "100vh" }}>
      <LandingHeader />

      <section style={{ padding: "clamp(130px, 15vh, 180px) clamp(24px, 5vw, 84px) 80px", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ color: "var(--orange)", fontSize: "11px", fontWeight: 800, letterSpacing: "0.18em", marginBottom: "16px" }}>
          TERMS OF SERVICE & LEGAL AGREEMENT
        </div>
        <h1 style={{ font: "750 clamp(36px, 5vw, 64px)/1.05 'Manrope', sans-serif", letterSpacing: "-0.05em", marginBottom: "32px" }}>
          Умови використання (Terms of Service)
        </h1>
        <p style={{ color: "#a0a49c", fontSize: "16px", lineHeight: "1.6", marginBottom: "48px" }}>
          Останнє оновлення: 2 вересня 2026 року.<br />
          Юридична особа: <strong>AVEiron LIMITED LIABILITY COMPANY</strong> (ТОВ &quot;AVEiron&quot;).
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "40px", font: "400 16px/1.7 'DM Sans', sans-serif", color: "#d2d5cd" }}>
          <article style={{ borderBottom: "1px solid #2a2d28", paddingBottom: "32px" }}>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>1. Прийняття умов</h2>
            <p>
              Ці Умови використання (&quot;Умови&quot;) регулюють доступ та використання веб-платформи <strong>ReviewRadar</strong>, що належить та обслуговується компанією <strong>AVEiron LIMITED LIABILITY COMPANY</strong>.
            </p>
            <p style={{ marginTop: "12px" }}>
              Створюючи акаунт або використовуючи сервіс, ви погоджуєтеся з цими Умовами в повному обсязі. Якщо ви не погоджуєтеся з будь-якою частиною умов, ви не маєте права використовувати сервіс.
            </p>
          </article>

          <article style={{ borderBottom: "1px solid #2a2d28", paddingBottom: "32px" }}>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>2. Опис послуг</h2>
            <p>
              ReviewRadar надає аналітичну платформу репутаційного інтелекту (Reputation Intelligence), яка збирає та аналізує публічні відгуки клієнтів з різних джерел (Google Business Profile, Booking.com, Tripadvisor, Yelp, Facebook).
            </p>
            <p style={{ marginTop: "12px" }}>
              Сервіс здійснює кластеризацію відгуків за допомогою алгоритмів штучного інтелекту, визначає темп і зміни тональності, а також надає робочі інсайти для власників бізнесу.
            </p>
          </article>

          <article style={{ borderBottom: "1px solid #2a2d28", paddingBottom: "32px" }}>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>3. Реєстрація акаунта та безпека</h2>
            <ul style={{ paddingLeft: "20px", marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <li>Ви зобов&apos;язані надавати достовірну інформацію під час реєстрації акаунта.</li>
              <li>Ви відповідаєте за збереження конфіденційності своїх авторизаційних даних та за будь-які дії, вчинені з вашого акаунта.</li>
              <li>Ви погоджуєтеся негайно повідомити нас про будь-які випадки несанкціонованого доступу до вашого акаунта.</li>
            </ul>
          </article>

          <article style={{ borderBottom: "1px solid #2a2d28", paddingBottom: "32px" }}>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>4. Інтеграції зі сторонніми платформами</h2>
            <p>
              ReviewRadar використовує офіційні API та авторизацію OAuth 2.0 для підключення сторонніх платформ. Ви підтверджуєте, що маєте належні права та повноваження для підключення бізнес-акаунтів відповідних локацій.
            </p>
          </article>

          <article style={{ borderBottom: "1px solid #2a2d28", paddingBottom: "32px" }}>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>5. Інтелектуальна власність</h2>
            <p>
              Усі майнові та немайнові права на платформу ReviewRadar, її програмний код, графічні елементи, логотипи, дизайн та аналітичні алгоритми належать компанії <strong>AVEiron LIMITED LIABILITY COMPANY</strong>.
            </p>
          </article>

          <article style={{ borderBottom: "1px solid #2a2d28", paddingBottom: "32px" }}>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>6. Обмеження відповідальності</h2>
            <p>
              Сервіс надається за принципом &quot;як є&quot; (&quot;as is&quot;). <strong>AVEiron LIMITED LIABILITY COMPANY</strong> не несе відповідальності за можливі збої в роботі сторонніх API (Google, Booking тощо) або тимчасову недоступність зовнішніх сервісів.
            </p>
          </article>

          <article>
            <h2 style={{ color: "#fff", font: "700 24px 'Manrope'", marginBottom: "16px" }}>7. Юридичні реквізити та контакти</h2>
            <div style={{ padding: "20px", borderRadius: "16px", background: "#1c1f1a", border: "1px solid #32362e" }}>
              <p><strong>Офіційна компанія:</strong> AVEiron LIMITED LIABILITY COMPANY (ТОВ &quot;AVEiron&quot;)</p>
              <p><strong>Email підтримки:</strong> support@reviewradar.com / legal@reviewradar.com</p>
              <p><strong>Адреса сервісу:</strong> <a href="https://reviewradar.reviewradar-vova445.workers.dev" style={{ color: "var(--orange)" }}>https://reviewradar.reviewradar-vova445.workers.dev</a></p>
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
