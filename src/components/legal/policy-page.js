import Link from 'next/link';
import LegalFooter from './legal-footer';

export default function PolicyPage({ title, intro, sections }) {
  return (
    <main className="policy-shell">
      <header className="policy-header">
        <Link href="/login" aria-label="CodeEmy sign in">
          <img src="/codeemy-technologies.png" width="190" height="80" alt="CodeEmy Technologies" />
        </Link>
        <Link href="/login">Back to sign in →</Link>
      </header>
      <article className="policy-document">
        <p className="policy-kicker">CODEEMY LMS · YOUR LEARNING WORKSPACE</p>
        <h1>{title}</h1>
        <p className="policy-updated">Last updated: 12 November 2026</p>
        <p className="policy-intro">{intro}</p>
        <nav className="policy-contents" aria-label="On this page">
          {sections.map((section, index) => (
            <a key={section.title} href={'#section-' + (index + 1)}>
              {index + 1}. {section.title}
            </a>
          ))}
        </nav>
        {sections.map((section, index) => (
          <section id={'section-' + (index + 1)} key={section.title}>
            <h2>
              {index + 1}. {section.title}
            </h2>
            {section.paragraphs.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </section>
        ))}
        <section id="contact">
          <h2>Contact CodeEmy</h2>
          <p>
            For account support, policy questions or privacy requests, contact{' '}
            <a href="mailto:info.codeemy@gmail.com">info.codeemy@gmail.com</a>. Send your account
            email and a description of your request. Do not send passwords, sign-in codes or payment
            credentials.
          </p>
        </section>
      </article>
      <LegalFooter />
    </main>
  );
}
