import type { ResumeView } from "./types";

export function ResumeSheet({ resume }: { resume: ResumeView }) {
  const template = resume.template || "classic";
  const initials = resume.name.split(" ").map((part) => part[0]).slice(0, 2).join("");
  const portrait = resume.photoUrl ? <img src={resume.photoUrl} alt="" /> : <span className="resume-fallback">{initials}</span>;
  const contact = [resume.city, resume.email, resume.phone].filter(Boolean).join(" · ");

  return (
    <article className={`resume-sheet tpl-${template}`}>
      <header className="resume-hero">
        {portrait}
        <div>
          <p className="eyebrow">Resume</p>
          <h1>{resume.name}</h1>
          <p className="resume-headline">{resume.headline}</p>
          <p className="role">{contact}</p>
        </div>
      </header>
      <div className="resume-body">
        <aside>
          <h2>Skills</h2>
          <div className="chips">
            {resume.skills.map((skill) => (
              <span className="chip" key={skill}>{skill}</span>
            ))}
          </div>
          {resume.education.length ? (
            <>
              <h2>Education</h2>
              {resume.education.map((item) => <p key={item}>{item}</p>)}
            </>
          ) : null}
        </aside>
        <div>
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
                  {(job.bullets || []).map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              </div>
            ))}
          </section>
        </div>
      </div>
    </article>
  );
}
