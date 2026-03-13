import styles from './LegalPage.module.css'

export type LegalPageType = 'privacy' | 'cookies' | 'terms' | 'security' | 'contact' | 'accessibility'

interface Props {
  page: LegalPageType
  onBack: () => void
}

export function LegalPage({ page, onBack }: Props) {
  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={onBack}>&larr; Back</button>
      {page === 'privacy' && <PrivacyPolicy />}
      {page === 'cookies' && <CookiePolicy />}
      {page === 'terms' && <TermsOfService />}
      {page === 'security' && <SecurityPolicy />}
      {page === 'contact' && <ContactPage />}
      {page === 'accessibility' && <AccessibilityStatement />}
    </div>
  )
}

function PrivacyPolicy() {
  return (
    <>
      <div className={styles.title}>Privacy Policy</div>
      <div className={styles.updated}>Last updated: March 2026</div>

      <div className={styles.section}>
        <h3>What we collect</h3>
        <p>DepthViz collects only what is necessary to provide underwater visibility forecasts and community dive reports:</p>
        <ul>
          <li><span className={styles.highlight}>Email address</span> — for authentication via magic link (Supabase Auth)</li>
          <li><span className={styles.highlight}>Location searches</span> — coordinates you search for, to return forecast data</li>
          <li><span className={styles.highlight}>Saved locations</span> — dive sites you choose to bookmark</li>
          <li><span className={styles.highlight}>Dive reports</span> — visibility observations you voluntarily submit</li>
          <li><span className={styles.highlight}>Display name</span> — optional, shown on the community leaderboard</li>
        </ul>
      </div>

      <div className={styles.section}>
        <h3>What we do not collect</h3>
        <ul>
          <li>No tracking cookies or advertising pixels</li>
          <li>No browsing history or device fingerprinting</li>
          <li>No data sold to third parties</li>
        </ul>
      </div>

      <div className={styles.section}>
        <h3>Third-party services</h3>
        <p>We rely on the following external services to operate:</p>
        <ul>
          <li><span className={styles.highlight}>Supabase</span> — authentication and user data storage (hosted in EU)</li>
          <li><span className={styles.highlight}>Open-Meteo</span> — weather and marine forecast data (no personal data sent, only coordinates)</li>
          <li><span className={styles.highlight}>Copernicus Marine Service</span> — ocean model data (no personal data sent)</li>
          <li><span className={styles.highlight}>Open-Meteo Geocoding API</span> — location search (no personal data sent, only search queries)</li>
        </ul>
      </div>

      <div className={styles.section}>
        <h3>Data retention</h3>
        <p>Your account data and dive reports are retained as long as your account exists. You can request deletion of your account and all associated data by contacting us.</p>
      </div>

      <div className={styles.section}>
        <h3>Your rights</h3>
        <p>You may request access to, correction of, or deletion of your personal data at any time by emailing the address listed on our contact page.</p>
      </div>
    </>
  )
}

function CookiePolicy() {
  return (
    <>
      <div className={styles.title}>Cookie Policy</div>
      <div className={styles.updated}>Last updated: March 2026</div>

      <div className={styles.section}>
        <h3>What cookies we use</h3>
        <p>DepthViz uses only essential cookies required for the application to function:</p>
        <ul>
          <li><span className={styles.highlight}>Supabase auth token</span> — keeps you signed in between sessions (localStorage)</li>
          <li><span className={styles.highlight}>Cookie consent preference</span> — remembers your cookie banner choice (localStorage)</li>
        </ul>
      </div>

      <div className={styles.section}>
        <h3>What we do not use</h3>
        <ul>
          <li>No analytics or tracking cookies (no Google Analytics, no Hotjar, etc.)</li>
          <li>No advertising cookies or pixels</li>
          <li>No third-party social media cookies</li>
        </ul>
      </div>

      <div className={styles.section}>
        <h3>Managing cookies</h3>
        <p>You can clear all DepthViz data by clearing your browser's localStorage for this site. This will sign you out and reset your cookie preference.</p>
      </div>
    </>
  )
}

function TermsOfService() {
  return (
    <>
      <div className={styles.title}>Terms of Service</div>
      <div className={styles.updated}>Last updated: March 2026</div>

      <div className={styles.section}>
        <h3>Acceptance of terms</h3>
        <p>By using DepthViz, you agree to these terms. If you do not agree, please do not use the service.</p>
      </div>

      <div className={styles.section}>
        <h3>Service description</h3>
        <p>DepthViz provides underwater visibility forecasts based on weather and ocean model data. Forecasts are estimates and should never be treated as a substitute for local knowledge, proper dive planning, or professional judgment.</p>
      </div>

      <div className={styles.section}>
        <h3>Disclaimer of liability</h3>
        <p>DepthViz is provided "as is" without warranty of any kind. We are not responsible for any decisions made based on forecast data. <span className={styles.highlight}>Always dive with a buddy, check conditions locally, and follow safe diving practices.</span></p>
      </div>

      <div className={styles.section}>
        <h3>User conduct</h3>
        <p>When submitting dive reports, you agree to provide honest, good-faith observations. Deliberately submitting false data to manipulate forecasts may result in account suspension.</p>
      </div>

      <div className={styles.section}>
        <h3>Intellectual property</h3>
        <p>The DepthViz name, logo, visibility model, and application code are the intellectual property of their respective owners. Community dive reports are contributed under a Creative Commons Attribution license (CC BY 4.0), allowing the community to benefit from shared observations.</p>
      </div>

      <div className={styles.section}>
        <h3>Account termination</h3>
        <p>We reserve the right to suspend or terminate accounts that violate these terms, submit fraudulent data, or abuse the service.</p>
      </div>

      <div className={styles.section}>
        <h3>Changes to terms</h3>
        <p>We may update these terms from time to time. Continued use of DepthViz after changes constitutes acceptance of the revised terms.</p>
      </div>
    </>
  )
}

function SecurityPolicy() {
  return (
    <>
      <div className={styles.title}>Security Policy</div>
      <div className={styles.updated}>Last updated: March 2026</div>

      <div className={styles.section}>
        <h3>How we protect your data</h3>
        <ul>
          <li>Authentication is handled by Supabase with magic link (passwordless) email login</li>
          <li>All connections are encrypted via HTTPS/TLS</li>
          <li>API requests are authenticated with short-lived JWT tokens</li>
          <li>No passwords are stored — we use passwordless authentication only</li>
        </ul>
      </div>

      <div className={styles.section}>
        <h3>Vulnerability disclosure</h3>
        <p>If you discover a security vulnerability in DepthViz, please report it responsibly. Do not publicly disclose the issue until we have had a chance to address it.</p>
        <div className={styles.contactCard}>
          <p>
            Email: <a href="mailto:security@depthviz.com">security@depthviz.com</a><br />
            Please include a description of the vulnerability, steps to reproduce, and any potential impact.
          </p>
        </div>
        <p>We aim to acknowledge reports within 48 hours and will keep you updated on our progress.</p>
      </div>

      <div className={styles.section}>
        <h3>Abuse reporting</h3>
        <p>To report abusive behaviour, fraudulent dive reports, or any other misuse of the platform:</p>
        <div className={styles.contactCard}>
          <p>Email: <a href="mailto:abuse@depthviz.com">abuse@depthviz.com</a></p>
        </div>
      </div>
    </>
  )
}

function ContactPage() {
  return (
    <>
      <div className={styles.title}>Contact</div>
      <div className={styles.updated}>Last updated: March 2026</div>

      <div className={styles.section}>
        <h3>Business contact</h3>
        <div className={styles.contactCard}>
          <p>
            {/* TODO: Replace with your real business details */}
            DepthViz<br />
            [Your Name / Business Name]<br />
            [Your Address]<br />
            [City, Country]<br /><br />
            General enquiries: <a href="mailto:hello@depthviz.com">hello@depthviz.com</a><br />
            Security issues: <a href="mailto:security@depthviz.com">security@depthviz.com</a><br />
            Abuse reports: <a href="mailto:abuse@depthviz.com">abuse@depthviz.com</a>
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Support</h3>
        <p>For questions about your account, dive reports, or forecast data, email <a href="mailto:hello@depthviz.com">hello@depthviz.com</a>. We aim to respond within a few working days.</p>
      </div>

      <div className={styles.section}>
        <h3>Third-party services</h3>
        <p>DepthViz relies on the following third-party services:</p>
        <ul>
          <li><span className={styles.highlight}>Supabase</span> — user authentication and database (<a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">privacy policy</a>)</li>
          <li><span className={styles.highlight}>Open-Meteo</span> — weather and marine forecast API (<a href="https://open-meteo.com/en/terms" target="_blank" rel="noopener noreferrer">terms</a>)</li>
          <li><span className={styles.highlight}>Copernicus Marine Service</span> — ocean model data (<a href="https://marine.copernicus.eu/user-corner/service-commitments-and-licence" target="_blank" rel="noopener noreferrer">licence</a>)</li>
          <li><span className={styles.highlight}>Buy Me a Coffee</span> — voluntary donations (<a href="https://www.buymeacoffee.com/privacy-policy" target="_blank" rel="noopener noreferrer">privacy policy</a>)</li>
        </ul>
      </div>
    </>
  )
}

function AccessibilityStatement() {
  return (
    <>
      <div className={styles.title}>Accessibility</div>
      <div className={styles.updated}>Last updated: March 2026</div>

      <div className={styles.section}>
        <h3>Our commitment</h3>
        <p>We aim to make DepthViz accessible to all users. The application is designed with:</p>
        <ul>
          <li>Semantic HTML structure</li>
          <li>Keyboard-navigable interface</li>
          <li>Sufficient colour contrast for text elements</li>
          <li>Responsive layout that works on all screen sizes</li>
        </ul>
      </div>

      <div className={styles.section}>
        <h3>Known limitations</h3>
        <p>As a small project, we may not meet every WCAG 2.1 AA criterion. If you encounter an accessibility barrier, please let us know so we can work to fix it.</p>
      </div>

      <div className={styles.section}>
        <h3>Feedback</h3>
        <p>Email <a href="mailto:hello@depthviz.com">hello@depthviz.com</a> with any accessibility concerns or suggestions.</p>
      </div>
    </>
  )
}
