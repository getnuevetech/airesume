import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

type Resume = {
  name: string;
  headline: string;
  summary: string;
  skills: string[];
  employment: { title?: string; employer?: string; dates?: string; bullets?: string[] }[];
  education: string[];
  photoUrl: string;
  city: string;
  email: string;
  phone: string;
};

export function PublicResumePage() {
  const { slug } = useParams();
  const [resume, setResume] = useState<Resume | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    void fetch(`/api/public/resume/${slug}`)
      .then(async (response) => {
        if (!response.ok) {
          setMissing(true);
          return;
        }
        setResume((await response.json()) as Resume);
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

  const initials = resume.name.split(" ").map((part) => part[0]).slice(0, 2).join("");

  return (
    <main className="public-resume">
      <article className="resume-sheet">
        <header className="resume-hero">
          {resume.photoUrl ? <img src={resume.photoUrl} alt="" /> : <span className="resume-fallback">{initials}</span>}
          <div>
            <p className="eyebrow">JobPilot resume</p>
            <h1>{resume.name}</h1>
            <p className="resume-headline">{resume.headline}</p>
            <p className="role">{[resume.city, resume.email, resume.phone].filter(Boolean).join(" · ")}</p>
          </div>
        </header>
        <section>
          <h2>Summary</h2>
          <p>{resume.summary}</p>
        </section>
        <section>
          <h2>Experience</h2>
          {resume.employment.map((job) => (
            <div key={`${job.title}-${job.employer}`}>
              <h3>{job.title}</h3>
              <p className="role">{[job.employer, job.dates].filter(Boolean).join(" · ")}</p>
              <ul>
                {(job.bullets || []).map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
        <section>
          <h2>Skills</h2>
          <div className="chips">
            {resume.skills.map((skill) => (
              <span className="chip" key={skill}>{skill}</span>
            ))}
          </div>
        </section>
        {resume.education.length ? (
          <section>
            <h2>Education</h2>
            {resume.education.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </section>
        ) : null}
      </article>
    </main>
  );
}
