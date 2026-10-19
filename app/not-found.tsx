import Link from "next/link";
export default function NotFound() {
  return (
    <main className="auth-wrap">
      <div className="panel auth-panel">
        <h1>Connection not found.</h1>
        <p>This page may have moved.</p>
        <Link className="btn btn-primary" href="/">
          Back to GridDesk
        </Link>
      </div>
    </main>
  );
}
