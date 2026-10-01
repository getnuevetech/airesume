/** Small account charts. Numbers stay visible next to every bar and ring. */

export function scoreTone(score: number): "high" | "good" | "mid" | "low" | "weak" {
  if (score >= 85) return "high";
  if (score >= 70) return "good";
  if (score >= 55) return "mid";
  if (score >= 40) return "low";
  return "weak";
}

export function ScorePill({ score }: { score: number }) {
  return <span className={`score-pill tone-${scoreTone(score)}`}>{score}%</span>;
}

export function ScoreRing({ label, value }: { label: string; value: number | null }) {
  const shown = value == null || Number.isNaN(value) ? null : Math.max(0, Math.min(100, Math.round(value)));
  const tone = shown == null ? "empty" : scoreTone(shown);
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const dash = shown == null ? 0 : (shown / 100) * circumference;
  return (
    <article className={`stat-visual tone-${tone}`}>
      <svg className="score-ring" viewBox="0 0 72 72" role="img" aria-label={`${label}: ${shown == null ? "not available" : `${shown} percent`}`}>
        <circle className="ring-track" cx="36" cy="36" r={radius} />
        <circle className="ring-value" cx="36" cy="36" r={radius} strokeDasharray={`${dash} ${circumference - dash}`} />
      </svg>
      <div>
        <strong>{shown == null ? "—" : `${shown}%`}</strong>
        <span>{label}</span>
      </div>
    </article>
  );
}

export function CountBars({ title, rows }: { title?: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  const summary = rows.map((row) => `${row.label} ${row.value}`).join(", ");
  return (
    <div className="count-bars" role="img" aria-label={title ? `${title}. ${summary}` : summary}>
      {rows.map((row, index) => {
        const width = row.value <= 0 ? 0 : Math.max(8, (row.value / max) * 100);
        return (
          <div className="count-bar" key={row.label}>
            <span>{row.label}</span>
            <span className="count-track">
              <span className={`count-fill fill-${index % 6}`} style={{ width: `${width}%` }} />
            </span>
            <strong>{row.value}</strong>
          </div>
        );
      })}
    </div>
  );
}

export const PIPELINE = [
  { id: "prepare", label: "Prepare" },
  { id: "applied", label: "Applied" },
  { id: "response", label: "Response" },
  { id: "interview", label: "Interview" },
  { id: "offer", label: "Offer" },
] as const;

const STAGE_BY_STATUS: Record<string, (typeof PIPELINE)[number]["id"]> = {
  Found: "prepare",
  Reviewed: "prepare",
  "Resume preparing": "prepare",
  Ready: "prepare",
  "Review required": "prepare",
  Applied: "applied",
  "Employer viewed": "response",
  "Recruiter contact": "response",
  Responded: "response",
  Interview: "interview",
  Offer: "offer",
  Hired: "offer",
};

export function applicationStage(status: string): { id: string; closed: string } {
  if (status === "Rejected" || status === "Withdrawn" || status === "Skipped") {
    return { id: "", closed: status };
  }
  return { id: STAGE_BY_STATUS[status] || "prepare", closed: "" };
}

export function pipelineRows(statuses: string[]) {
  const counts = new Map<string, number>([
    ["Prepare", 0],
    ["Applied", 0],
    ["Response", 0],
    ["Interview", 0],
    ["Offer", 0],
    ["Closed", 0],
  ]);
  for (const status of statuses) {
    const stage = applicationStage(status);
    if (stage.closed) {
      counts.set("Closed", (counts.get("Closed") || 0) + 1);
      continue;
    }
    const label = PIPELINE.find((step) => step.id === stage.id)?.label || "Prepare";
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

export function StageRail({ status }: { status: string }) {
  const stage = applicationStage(status);
  const index = PIPELINE.findIndex((step) => step.id === stage.id);
  return (
    <div className="stage-wrap">
      {stage.closed ? <span className="score-pill tone-weak">{stage.closed}</span> : null}
      <ol className="stage-rail" aria-label={stage.closed ? `${stage.closed}` : `Stage: ${status}`}>
        {PIPELINE.map((step, stepIndex) => {
          const state = stage.closed ? "wait" : stepIndex < index ? "done" : stepIndex === index ? "now" : "wait";
          return (
            <li key={step.id} className={`stage stage-${state}`} aria-current={state === "now" ? "step" : undefined}>
              <span className="stage-dot" aria-hidden="true" />
              <span className="stage-label">{step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function CategoryBars({
  rows,
}: {
  rows: { category: string; jobs: number; avgScore: number; strong: number }[];
}) {
  return (
    <div className="outlook-list">
      {rows.map((row) => {
        const tone = scoreTone(row.avgScore);
        const width = Math.max(0, Math.min(100, row.avgScore));
        return (
          <div className="outlook-row" key={row.category}>
            <div className="outlook-copy">
              <strong>{row.category}</strong>
              <span>{row.jobs} roles · {row.strong} strong</span>
            </div>
            <div className="outlook-meter" aria-hidden="true">
              <span className={`outlook-fill tone-${tone}`} style={{ width: `${width}%` }} />
            </div>
            <span className={`score-pill tone-${tone}`}>{row.avgScore}%</span>
          </div>
        );
      })}
    </div>
  );
}
