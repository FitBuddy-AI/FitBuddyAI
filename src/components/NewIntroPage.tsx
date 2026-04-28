import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Brain, CalendarDays, ChevronRight, Dumbbell, Flame, Layers3, ShieldCheck, Sparkles, Target, TrendingUp } from 'lucide-react';
import './NewIntroPage.css';
import { loadUserData } from '../services/localStorage';

const heroStats = [
  {
    value: '01',
    label: 'guided intake',
    detail: 'one flow turns context into a usable plan',
  },
  {
    value: '24/7',
    label: 'calendar access',
    detail: 'your plan stays readable across devices',
  },
  {
    value: 'Auto',
    label: 'adaptive updates',
    detail: 'progress reshapes the next training week',
  },
];

const workflowCards = [
  {
    title: 'Guided intake',
    text: 'A focused questionnaire captures goals, schedule, and training constraints without making onboarding feel heavy.',
    Icon: Target,
  },
  {
    title: 'Adaptive planning',
    text: 'The generator returns a balanced week that combines effort, recovery, and progression in a format you can follow.',
    Icon: Brain,
  },
  {
    title: 'Visible progress',
    text: 'Calendar views, saved workouts, and rewards keep each session tied to a larger training story.',
    Icon: CalendarDays,
  },
  {
    title: 'Recovery-aware cadence',
    text: 'The system eases off when the week calls for it, so the plan stays realistic instead of rigid.',
    Icon: ShieldCheck,
  },
];

const weeklyBlocks = [
  { label: 'Mon', title: 'Upper Push', tone: 'green' },
  { label: 'Tue', title: 'Conditioning', tone: 'blue' },
  { label: 'Wed', title: 'Mobility + Core', tone: 'orange' },
  { label: 'Thu', title: 'Lower Strength', tone: 'green' },
  { label: 'Fri', title: 'Recovery', tone: 'blue' },
];

const featurePills = [
  'Clear weekly structure',
  'Recovery-aware guidance',
  'Saved workouts and rewards',
  'Progress that compounds',
];

const NewIntroPage: React.FC = () => {
  const currentUser = loadUserData();
  const hasUser = Boolean(currentUser?.id || currentUser?.data?.id);
  const startHref = hasUser ? '/calendar' : '/questionnaire';

  return (
    <div className="new-intro-page">
      <div className="new-intro-backdrop" aria-hidden="true">
        <span className="intro-orb orb-a" />
        <span className="intro-orb orb-b" />
        <span className="intro-orb orb-c" />
        <span className="intro-grid" />
      </div>

      <header className="new-intro-topbar">
        <Link to="/" className="new-intro-brand">
          <span className="new-intro-brand-mark">
            <Dumbbell size={18} />
          </span>
          <span className="new-intro-brand-copy">
            <strong>FitBuddyAI</strong>
            <span>fitness planning, designed like a product</span>
          </span>
        </Link>

        <nav className="new-intro-nav" aria-label="Intro navigation">
          <Link to="/workouts" className="new-intro-nav-link">Library</Link>
          <Link to="/calendar" className="new-intro-nav-link">Calendar</Link>
          <Link to={startHref} className="new-intro-nav-link accent">Start</Link>
        </nav>
      </header>

      <main className="new-intro-shell">
        <section className="new-intro-hero">
          <div className="new-intro-copy">
            <span className="new-intro-kicker">
              <Sparkles size={16} />
              Modern intro, clearer product story
            </span>
            <h1>Fitness planning that feels polished, personal, and easy to trust.</h1>
            <p className="new-intro-lead">
              FitBuddyAI turns onboarding into a guided product experience: a focused intake, a living weekly plan,
              and a progress system that adapts as you train instead of sending you into a random routine.
            </p>

            <div className="new-intro-actions">
              <Link to={startHref} className="btn btn-primary btn-large">
                {hasUser ? 'Open your calendar' : 'Build my plan'}
                <ArrowRight size={18} />
              </Link>
              <Link to="/workouts" className="btn btn-secondary btn-large">
                Browse the workout library
              </Link>
            </div>

            <div className="new-intro-pills" aria-label="Key product highlights">
              {featurePills.map((pill) => (
                <span key={pill} className="new-intro-pill">{pill}</span>
              ))}
            </div>

            <div className="new-intro-metrics">
              {heroStats.map((stat) => (
                <article key={stat.label} className={stat.value === '01' ? 'metric-card metric-card-primary' : 'metric-card'}>
                  <span className={stat.value === '01' ? 'metric-value' : 'metric-value metric-value-inline'}>{stat.value}</span>
                  <div>
                    <strong>{stat.label}</strong>
                    <span>{stat.detail}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="new-intro-panel">
            <div className="panel-card panel-card-hero">
              <div className="panel-badge">
                <Layers3 size={16} />
                <span>Live preview</span>
              </div>
              <h2>Your week, visualized like a modern dashboard.</h2>
              <p>
                The intro frames the core product loop: one assessment creates a structured plan, the calendar keeps
                it visible, and progress updates keep the next week honest.
              </p>

              <div className="dashboard-grid">
                <div className="dashboard-summary">
                  <span className="dashboard-label">Today</span>
                  <strong>Upper push + core</strong>
                  <p>40 min · moderate effort · recovery-aware</p>
                  <div className="progress-stack" aria-hidden="true">
                    <span className="progress-bar progress-bar-86" />
                    <span className="progress-bar progress-bar-64" />
                    <span className="progress-bar progress-bar-78" />
                  </div>
                </div>

                <div className="dashboard-week">
                  <div className="panel-week-header">
                    <span>Example week</span>
                    <span>balanced progression</span>
                  </div>
                  <div className="weekly-stack">
                    {weeklyBlocks.map((block) => (
                      <div key={block.label} className={`weekly-row weekly-row-${block.tone}`}>
                        <span>{block.label}</span>
                        <strong>{block.title}</strong>
                        <ChevronRight size={16} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="panel-stats">
                <div>
                  <strong>Adaptive</strong>
                  <span>weekly load</span>
                </div>
                <div>
                  <strong>Fast</strong>
                  <span>saved-workout sync</span>
                </div>
                <div>
                  <strong>Clear</strong>
                  <span>journey visibility</span>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="new-intro-grid" id="workflow">
          {workflowCards.map((card) => {
            const Icon = card.Icon;
            return (
              <article key={card.title} className="detail-card">
                <div className="detail-icon">
                  <Icon size={20} />
                </div>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            );
          })}
        </section>

        <section className="new-intro-banner">
          <div>
            <span className="banner-kicker">
              <Target size={16} />
              Built to move you forward
            </span>
            <h2>Less wandering, more momentum.</h2>
            <p>
              The intro explains the product loop in a way a professional landing page should: what it does, how it
              works, and why the next step matters.
            </p>
          </div>
          <Link to={startHref} className="banner-cta">
            <span>{hasUser ? 'Continue into the calendar' : 'Start the guided flow'}</span>
            <ArrowRight size={18} />
          </Link>
        </section>
      </main>
    </div>
  );
};

export default NewIntroPage;