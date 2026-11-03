import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="content">
      <div className="card empty">
        <h1>Page not found</h1>
        <p>Choose a workspace to continue.</p>
        <Link className="btn" href="/student/dashboard">
          Student workspace
        </Link>{' '}
        <Link className="btn" href="/mentor/dashboard">
          Mentor workspace
        </Link>{' '}
        <Link className="btn" href="/admin/dashboard">
          Admin workspace
        </Link>
      </div>
    </main>
  );
}
