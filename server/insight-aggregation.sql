WITH periods AS (
  SELECT
    rt.topic_id,
    COUNT(*) FILTER (WHERE r.review_created_at >= $2 AND r.review_created_at < $3) AS current_count,
    COUNT(*) FILTER (WHERE r.review_created_at >= $1 AND r.review_created_at < $2) AS previous_count
  FROM review_topics rt
  JOIN reviews r ON r.id = rt.review_id
  WHERE r.workspace_id = $4 AND rt.sentiment = 'negative'
  GROUP BY rt.topic_id
)
SELECT
  p.topic_id,
  t.name,
  p.current_count,
  p.previous_count,
  CASE
    WHEN p.previous_count = 0 THEN NULL
    ELSE ROUND(((p.current_count - p.previous_count)::numeric / p.previous_count) * 100, 1)
  END AS growth_percent
FROM periods p
JOIN topics t ON t.id = p.topic_id
WHERE p.current_count >= $5
ORDER BY p.current_count DESC;
