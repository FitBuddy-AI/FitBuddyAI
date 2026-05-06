import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Dumbbell,
  ExternalLink,
  Filter,
  Mail,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react';
import './HelpCenter.css';

const SUPPORT_EMAIL = 'fitbuddyaig@gmail.com';
const SUPPORT_WEBHOOK_URL = 'https://corsproxy.io/?key=7cf03de1&url=https://script.google.com/macros/s/AKfycbwFDdT0QVaP2jY8t4N0048PfQW_rYxB4noFaG-nExO9MZ5h3DCuNLUPNg3-qntT01tg/exec?gid=0';

type Category = {
  id: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  keywords: string[];
};

type Article = {
  id: string;
  categoryId: string;
  title: string;
  summary: string;
  bullets: string[];
  keywords: string[];
  routeLabel?: string;
  routeTo?: string;
  supportSubject: string;
  supportMessage: string;
  accent: 'green' | 'blue' | 'orange';
};

type Faq = {
  id: string;
  categoryId: string;
  question: string;
  answer: string;
  keywords: string[];
  supportSubject: string;
  supportMessage: string;
};

const categories: Category[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    summary: 'Create a plan, set goals, and launch your first week fast.',
    icon: Sparkles,
    keywords: ['start', 'setup', 'questionnaire', 'plan', 'onboarding'],
  },
  {
    id: 'account',
    title: 'Account & Sign-in',
    summary: 'Restore access, verify email, and manage profile data safely.',
    icon: ShieldCheck,
    keywords: ['account', 'login', 'sign in', 'verify', 'restore', 'backup'],
  },
  {
    id: 'workouts',
    title: 'Workouts & Plans',
    summary: 'Swap workouts, regenerate blocks, and keep your calendar moving.',
    icon: Target,
    keywords: ['workout', 'calendar', 'regenerate', 'swap', 'routine', 'plan'],
  },
  {
    id: 'ai',
    title: 'AI Assistant',
    summary: 'Get better answers when the assistant needs more context.',
    icon: WandSparkles,
    keywords: ['ai', 'chat', 'assistant', 'gemini', 'prompt', 'response'],
  },
  {
    id: 'privacy',
    title: 'Privacy & Data',
    summary: 'See how data is stored, backed up, and deleted when needed.',
    icon: BookOpen,
    keywords: ['privacy', 'data', 'delete', 'security', 'terms', 'policy'],
  },
];

const articles: Article[] = [
  {
    id: 'first-plan',
    categoryId: 'getting-started',
    title: 'Build your first workout plan',
    summary: 'Answer the setup questions, confirm your goals, and launch a plan that fits your schedule.',
    bullets: [
      'Go to the questionnaire and choose your training level, equipment, and weekly availability.',
      'Review the generated plan before saving it to your calendar.',
      'Return anytime to regenerate the plan when your goals change.',
    ],
    keywords: ['questionnaire', 'plan', 'setup', 'start', 'launch'],
    routeLabel: 'Open questionnaire',
    routeTo: '/questionnaire',
    supportSubject: 'Help getting started with my first plan',
    supportMessage: 'I need help creating my first workout plan. My goals and setup are below:\n\n',
    accent: 'green',
  },
  {
    id: 'restore-account',
    categoryId: 'account',
    title: 'Restore your account or backup',
    summary: 'Sign back in, rehydrate your data, or ask support to help recover your plan.',
    bullets: [
      'Use your original sign-in method first so cloud-backed data can sync back automatically.',
      'If you used local storage, check the restore options in settings before reaching out.',
      'If recovery still fails, send support the email used for the account and the approximate creation date.',
    ],
    keywords: ['restore', 'recover', 'backup', 'sign in', 'account', 'sync'],
    supportSubject: 'Help restoring my account or backup',
    supportMessage: 'I cannot restore my account or backup. Please help me recover my data.\n\nEmail used:\n',
    accent: 'blue',
  },
  {
    id: 'calendar',
    categoryId: 'workouts',
    title: 'Edit your workout calendar',
    summary: 'Update workout days, swap sessions, and keep the schedule realistic for your week.',
    bullets: [
      'Open the calendar and tap the workout you want to change.',
      'Choose a swap or regeneration option that matches your available time.',
      'Save the change and verify the updated week before leaving the page.',
    ],
    keywords: ['calendar', 'schedule', 'swap', 'edit', 'workout', 'week'],
    routeLabel: 'Open chat for help',
    routeTo: '/chat',
    supportSubject: 'Help editing my workout calendar',
    supportMessage: 'I need help editing my workout calendar. The issue is:\n\n',
    accent: 'orange',
  },
  {
    id: 'regenerate',
    categoryId: 'workouts',
    title: 'Regenerate or replace a workout',
    summary: 'Swap a single session without rebuilding the whole plan.',
    bullets: [
      'Open the workout menu and select regenerate or replace.',
      'Keep the training focus and duration similar so the week stays balanced.',
      'Confirm the replacement before navigating away.',
    ],
    keywords: ['regenerate', 'replace', 'swap', 'session', 'workout', 'plan'],
    supportSubject: 'Help regenerating a workout',
    supportMessage: 'I want help regenerating a workout. Please review the session details below:\n\n',
    accent: 'green',
  },
  {
    id: 'ai-help',
    categoryId: 'ai',
    title: 'Get better answers from the AI assistant',
    summary: 'Ask with more context when a response needs more detail or a clearer goal.',
    bullets: [
      'Mention your goal, available equipment, and any injuries or limitations.',
      'Keep the prompt short and direct when asking for a workout adjustment.',
      'If a reply looks off, ask a follow-up instead of restarting the conversation.',
    ],
    keywords: ['ai', 'chat', 'assistant', 'prompt', 'gemini', 'response'],
    routeLabel: 'Open chat',
    routeTo: '/chat',
    supportSubject: 'AI assistant gave me an unclear answer',
    supportMessage: 'The AI assistant needs a better answer for this question:\n\n',
    accent: 'blue',
  },
  {
    id: 'privacy',
    categoryId: 'privacy',
    title: 'Understand data, privacy, and deletion',
    summary: 'Review where your information lives and how to request changes or removal.',
    bullets: [
      'Open the privacy policy for the current storage and retention details.',
      'Check the terms page if you need the current service rules or user rights.',
      'Contact support with the data request you want handled and the email on file.',
    ],
    keywords: ['privacy', 'policy', 'data', 'delete', 'terms', 'rights'],
    routeLabel: 'Open privacy policy',
    routeTo: '/privacy',
    supportSubject: 'Privacy or data request',
    supportMessage: 'I need help with privacy or data handling. Please review the request below:\n\n',
    accent: 'orange',
  },
];

const faqs: Faq[] = [
  {
    id: 'faq-plan',
    categoryId: 'getting-started',
    question: 'How do I get my personalized workout plan?',
    answer: 'Open the questionnaire, answer the setup questions, and submit the form. The plan is generated from your goals, equipment, and availability.',
    keywords: ['plan', 'questionnaire', 'start', 'generate'],
    supportSubject: 'Question about generating my workout plan',
    supportMessage: 'I need help generating a personalized workout plan.\n\n',
  },
  {
    id: 'faq-workout',
    categoryId: 'workouts',
    question: 'Can I change workouts or difficulty?',
    answer: 'Yes. Open the calendar, choose the workout, and pick a swap or regeneration option that matches your recovery and schedule.',
    keywords: ['workout', 'difficulty', 'calendar', 'swap', 'regenerate'],
    supportSubject: 'Question about changing a workout',
    supportMessage: 'I need help changing a workout or difficulty level.\n\n',
  },
  {
    id: 'faq-restore',
    categoryId: 'account',
    question: 'How do I restore my account or backups?',
    answer: 'Sign in with the same account you used before, then check the restore flow in settings. If the plan still does not appear, contact support with the email on file.',
    keywords: ['restore', 'backup', 'account', 'sign in', 'recovery'],
    supportSubject: 'Question about restoring my account',
    supportMessage: 'I need help restoring my account or backup.\n\n',
  },
  {
    id: 'faq-privacy',
    categoryId: 'privacy',
    question: 'How is my data stored and protected?',
    answer: 'Your plan data follows the app’s privacy policy. Review the privacy page for the current storage, backup, and deletion details.',
    keywords: ['privacy', 'stored', 'protected', 'data', 'security'],
    supportSubject: 'Question about privacy and stored data',
    supportMessage: 'I need help understanding how my data is stored or protected.\n\n',
  },
];

const quickFilters = [
  { label: 'All', value: 'all' },
  ...categories.map((category) => ({ label: category.title, value: category.id })),
];

function supportSummary(name: string, email: string, subject: string, message: string) {
  return [
    'FitBuddyAI support request',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    `Subject: ${subject}`,
    '',
    message,
  ].join('\n');
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function matchesText(parts: string[], query: string) {
  if (!query) {
    return true;
  }

  return parts.some((part) => normalize(part).includes(query));
}

export default function HelpCenter() {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [prefillSubject, setPrefillSubject] = useState('');
  const [prefillMessage, setPrefillMessage] = useState('');
  const resultsRef = useRef<HTMLElement | null>(null);

  const searchTerm = normalize(query);

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const categoryMatches = activeCategory === 'all' || article.categoryId === activeCategory;
      const textMatches = matchesText([article.title, article.summary, ...article.bullets, ...article.keywords], searchTerm);
      return categoryMatches && textMatches;
    });
  }, [activeCategory, searchTerm]);

  const filteredFaqs = useMemo(() => {
    return faqs.filter((faq) => {
      const categoryMatches = activeCategory === 'all' || faq.categoryId === activeCategory;
      const textMatches = matchesText([faq.question, faq.answer, ...faq.keywords], searchTerm);
      return categoryMatches && textMatches;
    });
  }, [activeCategory, searchTerm]);

  const resultsCount = filteredArticles.length + filteredFaqs.length;

  const openModal = (subject = 'Help request', message = '') => {
    setPrefillSubject(subject);
    setPrefillMessage(message);
    setModalOpen(true);
  };

  const openCategory = (categoryId: string) => {
    setActiveCategory(categoryId);
    if (categoryId === 'all') {
      setQuery('');
    } else {
      const category = categories.find((item) => item.id === categoryId);
      if (category) {
        setQuery(category.title);
      }
    }

    window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const openSupportForArticle = (article: Article) => {
    openModal(article.supportSubject, `${article.supportMessage}${article.title}\n\n`);
  };

  const openSupportForFaq = (faq: Faq) => {
    openModal(faq.supportSubject, `${faq.supportMessage}${faq.question}\n\n`);
  };

  const resetFilters = () => {
    setQuery('');
    setActiveCategory('all');
  };

  const featuredArticle = articles[0];

  return (
    <div className="hc-page">
      <header className="hc-hero">
        <div className="hc-hero-shell">
          <div className="hc-hero-copy">
            <div className="hc-brand">
              <div className="hc-brand-mark" aria-hidden="true">
                <Dumbbell size={24} />
              </div>
              <div>
                <p className="hc-eyebrow">Help Center</p>
                <h1>Answers that move as fast as your training does.</h1>
              </div>
            </div>
            <p className="hc-subtitle">
              Search guides, open the right tool, or send support the exact context they need.
            </p>
            <div className="hc-hero-actions">
              <Link to="/questionnaire" className="btn btn-primary">Start plan</Link>
              <Link to="/chat" className="btn btn-secondary">Open chat</Link>
              <button type="button" className="btn btn-accent" onClick={() => openModal('Contact support', 'I need help with FitBuddyAI.\n\n')}>
                Contact support
              </button>
            </div>
            <div className="hc-stats">
              <div className="hc-stat">
                <span>24h</span>
                <p>Typical support response</p>
              </div>
              <div className="hc-stat">
                <span>5</span>
                <p>Core help categories</p>
              </div>
              <div className="hc-stat">
                <span>Live</span>
                <p>Search and support flows</p>
              </div>
            </div>
          </div>

          <div className="hc-search-panel">
            <div className="hc-search-box">
              <Search size={18} />
              <input
                aria-label="Search help center"
                placeholder="Search articles, FAQs, and support topics"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="hc-chip-row" role="toolbar" aria-label="Help center filters">
              {quickFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={`hc-chip ${activeCategory === filter.value ? 'active' : ''}`}
                  onClick={() => openCategory(filter.value)}
                >
                  {filter.value === 'all' ? <Filter size={14} /> : null}
                  <span>{filter.label}</span>
                </button>
              ))}
            </div>
            <div className="hc-search-meta">
              <span>{resultsCount} result{resultsCount === 1 ? '' : 's'}</span>
              {(query || activeCategory !== 'all') ? (
                <button type="button" className="hc-reset" onClick={resetFilters}>Reset filters</button>
              ) : (
                <span className="hc-search-tip">Try: backup, calendar, privacy, chat</span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="hc-grid">
        <aside className="hc-sidebar">
          <section className="hc-card hc-card-soft">
            <div className="hc-card-head">
              <h2>Popular articles</h2>
              <p className="muted">The fastest paths to the most common tasks.</p>
            </div>
            <div className="hc-popular-list">
              {articles.slice(0, 3).map((article) => (
                <button
                  key={article.id}
                  type="button"
                  className="hc-popular-item"
                  onClick={() => {
                    setActiveCategory(article.categoryId);
                    setQuery(article.title);
                    window.requestAnimationFrame(() => {
                      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });
                  }}
                >
                  <span>{article.title}</span>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
          </section>

          <section className="hc-card hc-card-soft">
            <div className="hc-card-head">
              <h2>Support</h2>
              <p className="muted">If the answer needs a human, send the details in one shot.</p>
            </div>
            <div className="hc-support-stack">
              <a className="hc-support-link" href={`mailto:${SUPPORT_EMAIL}`}>
                <Mail size={16} />
                <span>{SUPPORT_EMAIL}</span>
              </a>
              <div className="hc-support-note">
                <Clock3 size={16} />
                <span>Typical response within 24 hours.</span>
              </div>
              <button type="button" className="btn btn-primary" onClick={() => openModal('Contact support', 'Please help me with:\n\n')}>
                Contact support
              </button>
            </div>
          </section>
        </aside>

        <section className="hc-main" ref={resultsRef}>
          <section className="hc-section">
            <div className="hc-section-head">
              <div>
                <p className="hc-section-kicker">Browse topics</p>
                <h2>Explore by category</h2>
              </div>
              <p className="muted">The cards below stay searchable and filter with the top bar.</p>
            </div>
            <div className="hc-category-grid">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={`hc-category-card ${activeCategory === category.id ? 'active' : ''}`}
                    onClick={() => openCategory(category.id)}
                  >
                    <div className="hc-category-icon" aria-hidden="true"><Icon size={20} /></div>
                    <div className="hc-category-copy">
                      <h3>{category.title}</h3>
                      <p className="muted">{category.summary}</p>
                    </div>
                    <ArrowRight size={16} className="hc-card-arrow" />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="hc-section">
            <div className="hc-section-head">
              <div>
                <p className="hc-section-kicker">Search results</p>
                <h2>Articles and tasks</h2>
              </div>
              <p className="muted">Filtered by your search and selected category.</p>
            </div>

            {filteredArticles.length > 0 ? (
              <div className="hc-article-grid">
                {filteredArticles.map((article) => (
                  <article key={article.id} className={`hc-article-card accent-${article.accent}`}>
                    <div className="hc-article-head">
                      <div>
                        <p className="hc-article-tag">{categories.find((category) => category.id === article.categoryId)?.title}</p>
                        <h3>{article.title}</h3>
                      </div>
                      <span className="hc-article-index">{article.bullets.length} steps</span>
                    </div>
                    <p className="muted">{article.summary}</p>
                    <ul className="hc-article-list">
                      {article.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                    <div className="hc-card-actions">
                      {article.routeLabel && article.routeTo ? (
                        <Link to={article.routeTo} className="btn btn-secondary">
                          {article.routeLabel}
                          <ExternalLink size={16} />
                        </Link>
                      ) : null}
                      <button type="button" className="btn btn-accent" onClick={() => openSupportForArticle(article)}>
                        Ask support
                        <Send size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="hc-empty-state">
                <WandSparkles size={24} />
                <div>
                  <h3>No articles matched that search.</h3>
                  <p className="muted">Try a broader term or open support and send the exact issue.</p>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => openModal('Search did not find an answer', `Search query: ${query}\n\nI need help with:`)}>
                  Ask support
                </button>
              </div>
            )}
          </section>

          <section className="hc-section">
            <div className="hc-section-head">
              <div>
                <p className="hc-section-kicker">Frequently asked questions</p>
                <h2>Common questions</h2>
              </div>
              <p className="muted">Answers stay visible and searchable as you filter the page.</p>
            </div>
            <Accordion items={filteredFaqs} onAskSupport={openSupportForFaq} />
          </section>
        </section>

        <aside className="hc-sidebar hc-sidebar-right">
          <section className="hc-card hc-feature-card">
            <p className="hc-section-kicker">Featured guide</p>
            <h2>{featuredArticle.title}</h2>
            <p className="muted">{featuredArticle.summary}</p>
            <ul className="hc-feature-list">
              {featuredArticle.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <div className="hc-card-actions hc-card-actions-stacked">
              {featuredArticle.routeLabel && featuredArticle.routeTo ? (
                <Link to={featuredArticle.routeTo} className="btn btn-secondary">
                  {featuredArticle.routeLabel}
                  <ExternalLink size={16} />
                </Link>
              ) : null}
              <button type="button" className="btn btn-primary" onClick={() => openSupportForArticle(featuredArticle)}>
                Ask support
              </button>
            </div>
          </section>

          <section className="hc-card hc-resource-card">
            <div className="hc-card-head">
              <h2>Resources</h2>
              <p className="muted">Open the official pages that back the support flow.</p>
            </div>
            <div className="hc-resource-list">
              <Link to="/questionnaire" className="hc-resource-link">
                <Sparkles size={16} />
                <span>Start questionnaire</span>
              </Link>
              <Link to="/chat" className="hc-resource-link">
                <MessageSquare size={16} />
                <span>Open AI chat</span>
              </Link>
              <Link to="/privacy" className="hc-resource-link">
                <ShieldCheck size={16} />
                <span>Privacy policy</span>
              </Link>
              <Link to="/terms" className="hc-resource-link">
                <BookOpen size={16} />
                <span>Terms of service</span>
              </Link>
            </div>
          </section>

          <section className="hc-card hc-resource-card">
            <div className="hc-card-head">
              <h2>Direct support</h2>
              <p className="muted">Use the same details to contact support by email.</p>
            </div>
            <a className="hc-support-link hc-support-link-large" href={`mailto:${SUPPORT_EMAIL}`}>
              <Mail size={16} />
              <span>{SUPPORT_EMAIL}</span>
            </a>
          </section>
        </aside>
      </main>

      <SupportModal
        open={modalOpen}
        initialSubject={prefillSubject}
        initialMessage={prefillMessage}
        onClose={() => {
          setModalOpen(false);
          setPrefillSubject('');
          setPrefillMessage('');
        }}
      />
    </div>
  );
}

function SupportModal({
  open,
  onClose,
  initialSubject,
  initialMessage,
}: {
  open: boolean;
  onClose: () => void;
  initialSubject: string;
  initialMessage: string;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState(initialMessage);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setName('');
    setEmail('');
    setSubject(initialSubject);
    setMessage(initialMessage);
    setStatus('idle');
    setStatusText('');
  }, [open, initialSubject, initialMessage]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject || 'FitBuddyAI support request')}&body=${encodeURIComponent(supportSummary(name || 'Your name', email || 'your email', subject || 'FitBuddyAI support request', message || ''))}`;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName || !trimmedEmail || !trimmedSubject || !trimmedMessage) {
      setStatus('error');
      setStatusText('Fill in every field before sending the request.');
      return;
    }

    setStatus('submitting');
    setStatusText('Sending your request to support...');

    const payload = {
      timestamp: new Date().toISOString(),
      source: 'help-center',
      name: trimmedName,
      email: trimmedEmail,
      subject: trimmedSubject,
      message: trimmedMessage,
      page: typeof window !== 'undefined' ? window.location.pathname : '/help',
    };

    try {
      const response = await fetch(SUPPORT_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Support request failed with status ${response.status}`);
      }

      setStatus('success');
      setStatusText('Your request was sent and logged for follow-up.');
    } catch (error) {
      console.error('Help center support request failed:', error);
      setStatus('error');
      setStatusText('We could not reach the support queue. Use the email fallback below to send the same details.');
    }
  };

  const copySummary = async () => {
    const summary = supportSummary(name, email, subject, message);
    try {
      await navigator.clipboard.writeText(summary);
      setStatusText('Support summary copied to your clipboard.');
    } catch {
      setStatusText('Copy is not available in this browser, but the summary is ready to send by email.');
    }
  };

  return (
    <div className="hc-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="hc-modal" role="dialog" aria-modal="true" aria-labelledby="support-title" onClick={(event) => event.stopPropagation()}>
        <header className="hc-modal-header">
          <div>
            <p className="hc-section-kicker">Contact support</p>
            <h3 id="support-title">Send a production-ready support request</h3>
          </div>
          <button className="hc-close" type="button" onClick={onClose} aria-label="Close support form">×</button>
        </header>

        {status === 'success' ? (
          <div className="hc-modal-body hc-success-state">
            <div className="hc-success-icon" aria-hidden="true">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h4>Your request was sent.</h4>
              <p className="muted">Support has the request now. You can copy the summary or open your email app with the same details.</p>
            </div>
            <div className="hc-support-actions-row">
              <button type="button" className="btn btn-secondary" onClick={copySummary}>
                Copy summary
                <Copy size={16} />
              </button>
              <a className="btn btn-primary" href={mailtoHref}>
                Open email app
                <Mail size={16} />
              </a>
              <button type="button" className="btn btn-accent" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form className="hc-form" onSubmit={handleSubmit}>
            <div className="hc-form-grid">
              <label>
                <span>Name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
              </label>
              <label>
                <span>Email</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
              </label>
            </div>

            <label>
              <span>Subject</span>
              <input value={subject} onChange={(event) => setSubject(event.target.value)} required />
            </label>

            <label>
              <span>Message</span>
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={7} required />
            </label>

            <div className={`hc-status ${status}`} aria-live="polite">{statusText || 'Typical response time is under 24 hours.'}</div>

            <div className="hc-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <a className="btn btn-secondary" href={mailtoHref}>
                Open email app
                <Mail size={16} />
              </a>
              <button type="submit" className="btn btn-primary" disabled={status === 'submitting'}>
                {status === 'submitting' ? 'Sending...' : 'Send request'}
                <Send size={16} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Accordion({ items, onAskSupport }: { items: Faq[]; onAskSupport: (item: Faq) => void }) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    setOpenId(items[0]?.id ?? null);
  }, [items]);

  return (
    <div className="hc-accordion" role="region" aria-label="Help center frequently asked questions">
      {items.map((item) => {
        const isOpen = openId === item.id;

        return (
          <article key={item.id} className={`hc-accordion-item ${isOpen ? 'open' : ''}`}>
            <button type="button" className="hc-accordion-button" aria-expanded={isOpen} onClick={() => setOpenId(isOpen ? null : item.id)}>
              <span>{item.question}</span>
              <ChevronDown size={18} className="hc-accordion-icon" />
            </button>
            <div className="hc-accordion-panel">
              <p>{item.answer}</p>
              <button type="button" className="hc-inline-action" onClick={() => onAskSupport(item)}>
                Ask support about this
                <ArrowRight size={14} />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
