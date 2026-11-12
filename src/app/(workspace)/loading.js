export default function LoadingWorkspace() {
  return (
    <section className="workspace-page-loading" role="status" aria-label="Loading workspace page">
      <div className="workspace-loading-line" />
      <p>Opening your workspace…</p>
      <div className="workspace-loading-cards">
        <div />
        <div />
        <div />
      </div>
    </section>
  );
}
