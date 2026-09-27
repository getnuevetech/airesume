import { Link, useParams } from "react-router-dom";
import { posts } from "../data";

export function BlogPage() {
  return (
    <div className="container narrow-page">
      <header className="page-hero">
        <p className="eyebrow">Blog</p>
        <h1>Notes for a calmer job search.</h1>
        <p className="lede">Short reads on resumes, match rates, and what to do with the hours you get back.</p>
      </header>
      <div className="blog-grid">
        {posts.map((post) => (
          <article className="blog-card" key={post.slug}>
            <p className="role">
              {post.date} · {post.minutes} min read
            </p>
            <h2>
              <Link to={`/blog/${post.slug}`}>{post.title}</Link>
            </h2>
            <p>{post.excerpt}</p>
            <Link className="link-green" to={`/blog/${post.slug}`}>
              Read article →
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}

export function BlogPostPage() {
  const { slug } = useParams();
  const post = posts.find((item) => item.slug === slug);
  if (!post) {
    return (
      <div className="container page-hero">
        <h1>That article is not here.</h1>
        <Link className="link-green" to="/blog">
          Back to the blog
        </Link>
      </div>
    );
  }
  return (
    <article className="container article">
      <p className="eyebrow">Blog</p>
      <h1>{post.title}</h1>
      <p className="role">
        {post.date} · {post.minutes} min read
      </p>
      {post.body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <Link className="link-green" to="/blog">
        ← All articles
      </Link>
    </article>
  );
}
