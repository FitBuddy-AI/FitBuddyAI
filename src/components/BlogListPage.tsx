import React from 'react';
import { Link } from 'react-router-dom';
import './BlogPage.css';

const posts = [
  {
    slug: 'fitbuddy-times',
    title: 'The FitBuddy Times',
    summary: 'A light-hearted dispatch about the team building FitBuddyAI and the fitness habits behind it.'
  },
  {
    slug: 'training-consistency',
    title: 'Why Consistency Beats Perfect Plans',
    summary: 'Small, repeatable sessions usually create better progress than waiting for the perfect routine.'
  },
  {
    slug: 'recovery-basics',
    title: 'Recovery Basics for Busy Weeks',
    summary: 'Simple recovery habits that make it easier to stay on track when your schedule gets crowded.'
  }
];

const BlogListPage: React.FC = () => {
  return (
    <div className="fb-news-root">
      <header className="fb-masthead" role="banner">
        <div className="masthead-left" aria-hidden>
          <div className="newspaper-logo">🏋️‍♂️</div>
        </div>
        <div className="masthead-right">
          <h1 className="paper-title">FitBuddy Blog</h1>
          <div className="paper-sub">Stories, updates, and fitness notes from the team</div>
        </div>
      </header>

      <main className="fb-paper card" role="main">
        <section className="lead">
          <div className="lead-text">
            <h2 className="lead-title">Latest posts</h2>
            <p className="lead-dek">A small reading desk for updates, training ideas, and the occasional behind-the-scenes story.</p>
          </div>
        </section>

        <div className="story story-list">
          {posts.map((post) => (
            <article key={post.slug} className="encouragement story-card">
              <strong>{post.title}</strong>
              <p className="story-summary">{post.summary}</p>
              <div className="story-actions">
                <Link className="cta" to={`/blog/${post.slug}`}>Read post</Link>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
};

export default BlogListPage;
