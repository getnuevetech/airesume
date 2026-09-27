import { Link } from "react-router-dom";
import { Stars } from "../components/Icons";
import { stories } from "../data";

export function StoriesPage() {
  return (
    <div className="container narrow-page">
      <header className="page-hero">
        <p className="eyebrow">Real people</p>
        <h1>Real results.</h1>
        <p className="lede">
          Designers, engineers, and marketers who let the search run and spent their time on the interviews.
        </p>
      </header>
      <div className="story-list">
        {stories.map((story) => (
          <article className="story story-wide" key={story.id}>
            <img src={story.avatar} alt={`Portrait of ${story.name}`} />
            <div>
              <p className="quote">“{story.quote}”</p>
              <p>{story.detail}</p>
              <p className="who">{story.name}</p>
              <p className="role">{story.role}</p>
              <Stars />
            </div>
          </article>
        ))}
      </div>
      <div className="band">
        <h2>Your search can feel this straightforward.</h2>
        <Link className="btn btn-primary btn-lg" to="/get-started">
          Get Started Free →
        </Link>
      </div>
    </div>
  );
}
