"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLanguage } from "../components/language";
import "./reviews.css";

type Review = {
  id: string;
  location_id: string;
  location_name: string;
  location_timezone: string;
  rating: number;
  source: string;
  review_created_at: number;
  author_name: string | null;
  comment: string | null;
  sentiment: string | null;
  urgency: string | null;
  ai_summary: string | null;
};
type Filters = { q: string; rating: string; from: string; to: string; sentiment: string; topic: string; sort: string };
type Topic = { id: string; name: string };
type ReviewPage = { reviews: Review[]; total: number; topics: Topic[]; pageInfo: { hasPreviousPage: boolean; hasNextPage: boolean; previousCursor: string | null; nextCursor: string | null } };
const defaults: Filters = { q: "", rating: "all", from: "", to: "", sentiment: "all", topic: "all", sort: "newest" };
const filterKeys = Object.keys(defaults) as (keyof Filters)[];

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const filters = { ...defaults };
  for (const key of filterKeys) {
    const value = params.get(key);
    if (value !== null) filters[key] = value;
  }
  return { filters, cursor: params.get("cursor") ?? "", direction: (params.get("direction") === "previous" ? "previous" : "next") as "next" | "previous" };
}

function writeUrlState(filters: Filters, cursor: string, direction: "next" | "previous", replace = false) {
  const url = new URL(window.location.href);
  for (const key of filterKeys) {
    const value = filters[key];
    if (value && value !== defaults[key]) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  if (cursor) url.searchParams.set("cursor", cursor);
  else url.searchParams.delete("cursor");
  if (cursor && direction === "previous") url.searchParams.set("direction", "previous");
  else url.searchParams.delete("direction");
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (replace) window.history.replaceState({ ...(window.history.state ?? {}), reviews: true }, "", path);
  else window.history.pushState({ ...(window.history.state ?? {}), reviews: true }, "", path);
}

export default function ReviewsPanel({ totalCount, analyzedCount, negativeCount, locationCount, stale }: { reviews: Review[]; totalCount: number; analyzedCount: number; negativeCount: number; locationCount: number; stale: boolean }) {
  const { language } = useLanguage();
  const en = language === "en";
  const [filters, setFilters] = useState(defaults);
  const [searchDraft, setSearchDraft] = useState("");
  const [cursor, setCursor] = useState("");
  const [direction, setDirection] = useState<"next" | "previous">("next");
  const [initialized, setInitialized] = useState(false);
  const [page, setPage] = useState<ReviewPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const syncFromUrl = useCallback(() => {
    const state = readUrlState();
    setFilters(state.filters);
    setSearchDraft(state.filters.q);
    setCursor(state.cursor);
    setDirection(state.direction);
  }, []);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      syncFromUrl();
      setInitialized(true);
    }, 0);
    const onPopState = () => syncFromUrl();
    window.addEventListener("popstate", onPopState);
    return () => {
      window.clearTimeout(initialize);
      window.removeEventListener("popstate", onPopState);
    };
  }, [syncFromUrl]);

  useEffect(() => {
    if (!initialized) return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    for (const key of filterKeys) if (filters[key] && filters[key] !== defaults[key]) params.set(key, filters[key]);
    if (cursor) params.set("cursor", cursor);
    if (cursor && direction === "previous") params.set("direction", direction);
    const setPendingState = window.setTimeout(() => {
      setLoading(true);
      setError(false);
    }, 0);
    fetch(`/api/reviews?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`reviews_${response.status}`);
        return response.json() as Promise<ReviewPage>;
      })
      .then(result => setPage(result))
      .catch(cause => { if (!controller.signal.aborted) { setError(true); console.error("Review list load failed", cause); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => {
      window.clearTimeout(setPendingState);
      controller.abort();
    };
  }, [initialized, filters, cursor, direction]);

  function applyFilters(next: Filters) {
    setFilters(next);
    setCursor("");
    setDirection("next");
    writeUrlState(next, "", "next");
  }

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters({ ...filters, q: searchDraft.trim() });
  }

  function clearFilters() {
    setSearchDraft("");
    applyFilters(defaults);
  }

  function goToPage(nextCursor: string | null, nextDirection: "next" | "previous") {
    if (!nextCursor) return;
    setCursor(nextCursor);
    setDirection(nextDirection);
    writeUrlState(filters, nextCursor, nextDirection);
  }

  const labels = {
    search: en ? "Search text" : "Пошук у відгуках",
    apply: en ? "Search" : "Знайти",
    rating: en ? "Rating" : "Оцінка",
    dateFrom: en ? "From date" : "Від дати",
    dateTo: en ? "To date" : "До дати",
    sentiment: en ? "Sentiment" : "Тональність",
    topic: en ? "Topic" : "Тема",
    sort: en ? "Sort" : "Сортувати",
    all: en ? "All" : "Усі",
    newest: en ? "Newest first" : "Спочатку нові",
    oldest: en ? "Oldest first" : "Спочатку старі",
    clear: en ? "Clear filters" : "Очистити фільтри",
    emptyTitle: en ? "No reviews yet" : "Відгуків поки немає",
    emptyText: en ? "Connect a source and sync reviews to get started." : "Підключіть джерело й синхронізуйте відгуки, щоб почати.",
    noResults: en ? "No reviews match these filters." : "За цими фільтрами відгуків немає.",
    previous: en ? "Previous" : "Назад",
    next: en ? "Next" : "Далі",
    loading: en ? "Loading reviews…" : "Завантажуємо відгуки…",
    failed: en ? "Reviews could not be loaded." : "Не вдалося завантажити відгуки.",
    retry: en ? "Try again" : "Спробувати ще раз",
    resultCount: en ? "matching reviews" : "відгуків за фільтрами",
  };

  return <>
    <section className="radarPageHead noIndex"><div><small>{en ? "CUSTOMER VOICE" : "ГОЛОС КЛІЄНТІВ"}</small><h1>{en ? "Reviews" : "Відгуки"}</h1></div><p>{en ? "Search, filter and inspect real customer feedback from every connected source." : "Шукайте, фільтруйте й аналізуйте реальні відгуки з усіх підключених джерел."}</p></section>
    <section className="reviewSummary"><div><small>{en ? "ALL-TIME REVIEWS" : "ВІДГУКИ · УВЕСЬ ЧАС"}</small><b>{totalCount}</b></div><div><small>{en ? "NEGATIVE · ANALYZED" : "НЕГАТИВНІ · АНАЛІЗОВАНІ"}</small><b>{negativeCount}</b></div><div><small>{en ? "CONNECTED LOCATIONS" : "ПІДКЛЮЧЕНІ ЛОКАЦІЇ"}</small><b>{locationCount}</b></div><p>{en ? `Analyzed ${analyzedCount} of ${totalCount} retained reviews.` : `Проаналізовано ${analyzedCount} з ${totalCount} збережених відгуків.`}{stale && <><br />{en ? "STALE · Latest sync is over 24 hours old" : "ЗАСТАРІЛО · остання синхронізація понад 24 години тому"}</>}</p></section>
    <section className="reviewToolbarV2">
      <form className="reviewSearchV2" onSubmit={applySearch}><label>{labels.search}<input maxLength={200} value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder={en ? "Author or phrase…" : "Автор або фраза…"} /></label><button type="submit">{labels.apply}</button></form>
      <label>{labels.rating}<select value={filters.rating} onChange={event => applyFilters({ ...filters, rating: event.target.value })}><option value="all">{labels.all}</option>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} ★</option>)}</select></label>
      <label>{labels.dateFrom}<input type="date" value={filters.from} onChange={event => applyFilters({ ...filters, from: event.target.value })} /></label>
      <label>{labels.dateTo}<input type="date" value={filters.to} onChange={event => applyFilters({ ...filters, to: event.target.value })} /></label>
      <label>{labels.sentiment}<select value={filters.sentiment} onChange={event => applyFilters({ ...filters, sentiment: event.target.value })}><option value="all">{labels.all}</option><option value="positive">{en ? "Positive" : "Позитивні"}</option><option value="neutral">{en ? "Neutral" : "Нейтральні"}</option><option value="negative">{en ? "Negative" : "Негативні"}</option><option value="mixed">{en ? "Mixed" : "Змішані"}</option></select></label>
      <label>{labels.topic}<select value={filters.topic} onChange={event => applyFilters({ ...filters, topic: event.target.value })}><option value="all">{labels.all}</option>{(page?.topics ?? []).map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
      <label>{labels.sort}<select value={filters.sort} onChange={event => applyFilters({ ...filters, sort: event.target.value })}><option value="newest">{labels.newest}</option><option value="oldest">{labels.oldest}</option></select></label>
    </section>
    <div className="reviewResultBar" aria-live="polite"><b>{page?.total ?? 0} {labels.resultCount}</b><button type="button" onClick={clearFilters}>{labels.clear}</button></div>
    {error ? <section className="reviewMessage" role="alert"><p>{labels.failed}</p><button type="button" onClick={() => setFilters(current => ({ ...current }))}>{labels.retry}</button></section> : loading ? <section className="reviewTableWrap" aria-label={labels.loading} aria-busy="true"><div className="reviewSkeleton"><span /><span /><span /><span /><span /></div><div className="reviewSkeleton"><span /><span /><span /><span /><span /></div><div className="reviewSkeleton"><span /><span /><span /><span /><span /></div></section> : totalCount === 0 ? <section className="radarEmpty"><div className="radarEmptyVisual"><i /><i /><i /><b>R</b></div><div><small>{en ? "DATA REQUIRED" : "ПОТРІБНІ ДАНІ"}</small><h2>{labels.emptyTitle}</h2><p>{labels.emptyText}</p></div></section> : !page?.total || !page.reviews.length ? <section className="reviewMessage"><p>{labels.noResults}</p><button type="button" onClick={clearFilters}>{labels.clear}</button></section> : <>
      <section className="reviewTableWrap"><table className="reviewTable"><thead><tr><th>{en ? "Date" : "Дата"}</th><th>{en ? "Customer / location" : "Клієнт / локація"}</th><th>{labels.rating}</th><th>{labels.sentiment}</th><th>{en ? "Review" : "Відгук"}</th></tr></thead><tbody>{page.reviews.map(review => <tr key={review.id}><td>{new Date(review.review_created_at).toLocaleDateString(en ? "en-GB" : "uk-UA", { timeZone: review.location_timezone })}</td><td><b>{review.author_name || (en ? "Anonymous" : "Анонім")}</b><small>{review.location_name} · {review.source}</small></td><td aria-label={`${review.rating} / 5`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</td><td><span className={`reviewSentiment ${review.sentiment ?? "pending"}`}>{review.sentiment ?? (en ? "Not analyzed" : "Не проаналізовано")}</span></td><td><p>{review.comment || (en ? "Review without text." : "Відгук без тексту.")}</p>{review.ai_summary && <small className="reviewAiSummary">{review.ai_summary}</small>}</td></tr>)}</tbody></table></section>
      <nav className="reviewPagination" aria-label={en ? "Review pages" : "Сторінки відгуків"}><button type="button" disabled={!page.pageInfo.hasPreviousPage || loading} onClick={() => goToPage(page.pageInfo.previousCursor, "previous")}>{labels.previous}</button><span>{page.reviews.length} / {page.total}</span><button type="button" disabled={!page.pageInfo.hasNextPage || loading} onClick={() => goToPage(page.pageInfo.nextCursor, "next")}>{labels.next}</button></nav>
    </>}
  </>;
}
