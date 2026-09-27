import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ResumeSheet } from "../account/ResumeSheet";
import type { ResumeView } from "../account/types";

export function PublicResumePage() {
  const { slug } = useParams();
  const [resume, setResume] = useState<ResumeView | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    void fetch(`/api/public/resume/${slug}`)
      .then(async (response) => {
        if (!response.ok) {
          setMissing(true);
          return;
        }
        setResume((await response.json()) as ResumeView);
      })
      .catch(() => setMissing(true));
  }, [slug]);

  if (missing) {
    return (
      <main className="public-resume">
        <p>This resume link is not available.</p>
      </main>
    );
  }
  if (!resume) return <main className="public-resume"><p>Loading resume…</p></main>;
  return (
    <main className="public-resume">
      <ResumeSheet resume={resume} />
    </main>
  );
}
