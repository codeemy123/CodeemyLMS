'use client';
export default function ErrorPage({ reset }) {
  return (
    <main className="content">
      <div className="card empty">
        <h1>Unable to load this page</h1>
        <p>Please try again.</p>
        <button className="btn" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
