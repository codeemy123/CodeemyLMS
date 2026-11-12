import Link from 'next/link';

export default function LegalFooter({ newTab = false }) {
  const options = newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <footer className="legal-footer">
      <nav aria-label="Legal information">
        <Link href="/terms" {...options}>
          Terms &amp; Conditions
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/privacy" {...options}>
          Privacy Policy
        </Link>
      </nav>
      <p>© 2026 CodeEmy Technologies. All rights reserved.</p>
    </footer>
  );
}
