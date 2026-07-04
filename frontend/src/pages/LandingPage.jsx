import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './LandingPage.css';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="lp-page">
      <header className="lp-header">
        <div className="lp-header-inner">
          <Link to="/" className="lp-logo">
            <span className="lp-logo-icon" aria-hidden="true">♻</span>
            WasteCoord<span className="lp-logo-city"> Nairobi</span>
          </Link>

          <nav className="lp-nav" aria-label="Landing page">
            <a href="#how-it-works" className="lp-nav-link">How it works</a>
            <a href="#about" className="lp-nav-link">About</a>

            <div className="lp-header-actions">
              {isAuthenticated ? (
                <Link to="/dashboard" className="lp-btn lp-btn-primary lp-btn-sm">
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" className="lp-btn lp-btn-ghost lp-btn-sm">Sign in</Link>
                  <Link to="/register" className="lp-btn lp-btn-primary lp-btn-sm">Get started</Link>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="lp-hero">
          <div className="lp-hero-inner">
            <div>
              <span className="lp-hero-eyebrow">For every neighbourhood in Nairobi</span>
              <h1 className="lp-hero-title">
                Cleaner streets start with a <em>pickup you can count on</em>
              </h1>
              <p className="lp-hero-sub">
                WasteCoord brings county teams, collection crews, and residents together
                so waste gets collected on time — and nothing falls through the cracks.
              </p>
              <div className="lp-hero-actions">
                <Link to="/register" className="lp-btn lp-btn-primary lp-btn-lg">Get started</Link>
                <a href="#how-it-works" className="lp-btn lp-btn-ghost lp-btn-lg">See how it works</a>
              </div>
            </div>
            <div className="lp-hero-art-wrap">
              <HeroIllustration />
            </div>
          </div>
        </section>

        {/* Built for everyone */}
        <section className="lp-section" aria-labelledby="roles-title">
          <h2 className="lp-section-title" id="roles-title">Built for everyone</h2>
          <p className="lp-section-sub">
            Whether you plan collections, drive the truck, or put the bins out —
            WasteCoord keeps you in the loop.
          </p>
          <div className="lp-cards">
            <div className="lp-card">
              <div className="lp-card-icon"><LandmarkIcon /></div>
              <h3 className="lp-card-title">County officials</h3>
              <p className="lp-card-text">
                See every zone at a glance and make sure no neighbourhood gets left behind.
              </p>
            </div>
            <div className="lp-card">
              <div className="lp-card-icon"><TruckIcon /></div>
              <h3 className="lp-card-title">Collectors</h3>
              <p className="lp-card-text">
                Know exactly where to go each day and log your pickups in seconds, right from your phone.
              </p>
            </div>
            <div className="lp-card">
              <div className="lp-card-icon"><HomeIcon /></div>
              <h3 className="lp-card-title">Residents</h3>
              <p className="lp-card-text">
                Know when your pickup is due — and speak up easily when one gets missed.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="lp-how" id="how-it-works" aria-labelledby="how-title">
          <div className="lp-section">
            <h2 className="lp-section-title" id="how-title">How it works</h2>
            <p className="lp-section-sub">
              A simple loop that keeps every street on schedule.
            </p>
            <ol className="lp-steps">
              <li className="lp-step">
                <span className="lp-step-num" aria-hidden="true">1</span>
                <h3 className="lp-step-title">Schedules are set</h3>
                <p className="lp-step-text">
                  County officials give every zone a pickup day and a crew to match.
                </p>
              </li>
              <li className="lp-step">
                <span className="lp-step-num" aria-hidden="true">2</span>
                <h3 className="lp-step-title">Crews make the rounds</h3>
                <p className="lp-step-text">
                  Collectors follow their route and record each pickup as it happens.
                </p>
              </li>
              <li className="lp-step">
                <span className="lp-step-num" aria-hidden="true">3</span>
                <h3 className="lp-step-title">Residents speak up</h3>
                <p className="lp-step-text">
                  Missed a collection? Report it in a moment and it lands with the right people.
                </p>
              </li>
              <li className="lp-step">
                <span className="lp-step-num" aria-hidden="true">4</span>
                <h3 className="lp-step-title">Everyone stays informed</h3>
                <p className="lp-step-text">
                  Issues get resolved, schedules stay honest, and streets stay clean.
                </p>
              </li>
            </ol>
          </div>
        </section>

        {/* Why it matters */}
        <section className="lp-about" id="about" aria-labelledby="about-title">
          <div className="lp-section">
            <div className="lp-about-inner">
              <h2 className="lp-section-title" id="about-title">Why it matters</h2>
              <p className="lp-about-text">
                Nairobi is home to millions of people — and every one of them deserves a
                clean street. When collections run on a shared schedule that everyone can
                see, missed pickups get noticed and fixed instead of forgotten.
              </p>
              <p className="lp-about-text">
                WasteCoord is about that simple promise: coordination and accountability,
                so the city we share stays a city we're proud of.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="lp-cta" aria-labelledby="cta-title">
          <div className="lp-cta-inner">
            <h2 className="lp-cta-title" id="cta-title">Ready for a cleaner neighbourhood?</h2>
            <p className="lp-cta-sub">
              Join WasteCoord today — it only takes a minute to sign up.
            </p>
            <Link to="/register" className="lp-btn lp-btn-inverse lp-btn-lg">Create an account</Link>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <p className="lp-footer-brand">♻ WasteCoord Nairobi</p>
        <p className="lp-footer-line">A waste collection coordination platform for Nairobi.</p>
        <p className="lp-footer-fine">© {new Date().getFullYear()} WasteCoord Nairobi · Built for cleaner streets.</p>
      </footer>
    </div>
  );
}

/* ── Inline SVG illustration: city skyline, collection truck, greenery ── */
function HeroIllustration() {
  return (
    <svg
      className="lp-hero-art"
      viewBox="0 0 520 380"
      role="img"
      aria-label="Illustration of a waste collection truck driving through a green Nairobi neighbourhood"
    >
      {/* Sun */}
      <circle cx="430" cy="70" r="34" fill="var(--color-primary-200)" />
      <circle cx="430" cy="70" r="22" fill="var(--color-primary-300)" />

      {/* Skyline */}
      <g fill="var(--color-primary-100)">
        <rect x="60" y="120" width="52" height="140" rx="4" />
        <rect x="128" y="80" width="64" height="180" rx="4" />
        <rect x="208" y="140" width="46" height="120" rx="4" />
        <rect x="270" y="100" width="58" height="160" rx="4" />
        <rect x="344" y="150" width="44" height="110" rx="4" />
      </g>
      {/* Windows */}
      <g fill="var(--color-primary-200)">
        <rect x="70" y="134" width="10" height="12" rx="2" />
        <rect x="92" y="134" width="10" height="12" rx="2" />
        <rect x="70" y="158" width="10" height="12" rx="2" />
        <rect x="92" y="158" width="10" height="12" rx="2" />
        <rect x="140" y="96" width="12" height="14" rx="2" />
        <rect x="166" y="96" width="12" height="14" rx="2" />
        <rect x="140" y="124" width="12" height="14" rx="2" />
        <rect x="166" y="124" width="12" height="14" rx="2" />
        <rect x="140" y="152" width="12" height="14" rx="2" />
        <rect x="166" y="152" width="12" height="14" rx="2" />
        <rect x="218" y="154" width="10" height="12" rx="2" />
        <rect x="238" y="154" width="10" height="12" rx="2" />
        <rect x="218" y="178" width="10" height="12" rx="2" />
        <rect x="238" y="178" width="10" height="12" rx="2" />
        <rect x="282" y="114" width="11" height="13" rx="2" />
        <rect x="304" y="114" width="11" height="13" rx="2" />
        <rect x="282" y="140" width="11" height="13" rx="2" />
        <rect x="304" y="140" width="11" height="13" rx="2" />
        <rect x="354" y="164" width="10" height="12" rx="2" />
        <rect x="372" y="164" width="10" height="12" rx="2" />
      </g>

      {/* Hills */}
      <ellipse cx="110" cy="300" rx="190" ry="60" fill="var(--color-primary-300)" />
      <ellipse cx="420" cy="305" rx="220" ry="66" fill="var(--color-primary-400)" />

      {/* Trees */}
      <g>
        <rect x="76" y="238" width="8" height="24" rx="3" fill="var(--color-primary-800)" />
        <circle cx="80" cy="228" r="20" fill="var(--color-primary-500)" />
        <rect x="448" y="230" width="9" height="28" rx="3" fill="var(--color-primary-800)" />
        <circle cx="452" cy="216" r="24" fill="var(--color-primary-600)" />
        <circle cx="418" cy="240" r="14" fill="var(--color-primary-500)" />
      </g>

      {/* Road */}
      <rect x="0" y="290" width="520" height="52" fill="var(--color-gray-200)" />
      <g fill="#fff">
        <rect x="24" y="313" width="36" height="5" rx="2.5" />
        <rect x="96" y="313" width="36" height="5" rx="2.5" />
        <rect x="168" y="313" width="36" height="5" rx="2.5" />
        <rect x="240" y="313" width="36" height="5" rx="2.5" />
        <rect x="312" y="313" width="36" height="5" rx="2.5" />
        <rect x="384" y="313" width="36" height="5" rx="2.5" />
        <rect x="456" y="313" width="36" height="5" rx="2.5" />
      </g>

      {/* Collection truck */}
      <g>
        {/* Cargo body */}
        <rect x="150" y="216" width="130" height="72" rx="10" fill="var(--color-primary-600)" />
        {/* Recycle mark on the body */}
        <circle cx="215" cy="252" r="22" fill="var(--color-primary-500)" />
        <path
          d="M215 238l7 12h-14z M204 262l7-12 6 10h-9z M226 262l-7-12-6 10h9z"
          fill="#fff"
          opacity="0.9"
        />
        {/* Cab */}
        <path
          d="M280 240h34a10 10 0 0 1 8 4l14 20a8 8 0 0 1 2 5v11a8 8 0 0 1-8 8h-50z"
          fill="var(--color-primary-700)"
        />
        <rect x="288" y="246" width="24" height="18" rx="4" fill="var(--color-primary-100)" />
        {/* Bumper */}
        <rect x="146" y="282" width="196" height="10" rx="5" fill="var(--color-primary-800)" />
        {/* Wheels */}
        <g>
          <circle cx="185" cy="296" r="15" fill="var(--color-gray-800)" />
          <circle cx="185" cy="296" r="7" fill="var(--color-gray-300)" />
          <circle cx="255" cy="296" r="15" fill="var(--color-gray-800)" />
          <circle cx="255" cy="296" r="7" fill="var(--color-gray-300)" />
          <circle cx="312" cy="296" r="15" fill="var(--color-gray-800)" />
          <circle cx="312" cy="296" r="7" fill="var(--color-gray-300)" />
        </g>
      </g>

      {/* Bins by the roadside */}
      <g>
        <rect x="392" y="262" width="22" height="28" rx="4" fill="var(--color-primary-700)" />
        <rect x="389" y="258" width="28" height="7" rx="3.5" fill="var(--color-primary-800)" />
        <rect x="112" y="266" width="20" height="24" rx="4" fill="var(--color-primary-500)" />
        <rect x="109" y="262" width="26" height="6" rx="3" fill="var(--color-primary-700)" />
      </g>

      {/* Floating leaves */}
      <g fill="var(--color-primary-400)">
        <path d="M52 90c10-14 26-16 26-16s0 16-10 24c-7 6-16 4-16 4s-2-6 0-12z" />
        <path d="M470 150c8-11 20-12 20-12s0 12-8 18c-5 5-12 3-12 3s-2-4 0-9z" opacity="0.8" />
        <path d="M330 60c8-11 20-12 20-12s0 12-8 18c-5 5-12 3-12 3s-2-4 0-9z" opacity="0.7" />
      </g>
    </svg>
  );
}

/* ── Small stroke icons (lucide-style, drawn inline) ── */
function LandmarkIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="22" x2="21" y2="22" />
      <line x1="6" y1="18" x2="6" y2="11" />
      <line x1="10" y1="18" x2="10" y2="11" />
      <line x1="14" y1="18" x2="14" y2="11" />
      <line x1="18" y1="18" x2="18" y2="11" />
      <polygon points="12 2 20 7 4 7" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </svg>
  );
}
