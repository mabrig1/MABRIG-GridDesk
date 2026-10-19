import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Zap,
  ShieldCheck,
  Wifi,
  Users,
  Activity,
} from "lucide-react";
import { Brand } from "@/components/shared";
export default function Home() {
  return (
    <>
      <header className="landing-nav">
        <Brand />
        <nav>
          <Link href="/demo/">Explore demo</Link>
          <Link className="btn btn-outline" href="/login/">
            Sign in <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div>
            <div className="eyebrow">
              <span className="dot" /> BUILT FOR NIGERIAN MINI-GRIDS
            </div>
            <h1>
              More clarity.
              <br />
              More power
              <br />
              <span>to your community.</span>
            </h1>
            <p>
              Bring customer credit, collections and energy records into one
              simple workspace. Spend less time in spreadsheets and more time
              keeping businesses moving.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/signup/">
                Create your workspace <ArrowRight size={18} />
              </Link>
              <Link className="btn btn-outline" href="/demo/">
                View sample dashboard
              </Link>
            </div>
            <div className="trust">
              <ShieldCheck size={16} /> Isolated operator data <span>·</span>
              <Wifi size={16} /> Built for lighter browsing
            </div>
          </div>
          <div className="hero-visual">
            <div className="visual-top">
              <span>
                <span className="dot" /> A CONNECTED COMMUNITY
              </span>
              <Zap size={20} />
            </div>
            <div className="grid-art">
              <div className="sun">☀</div>
              <div className="grid-line" />
              <div className="solar-panels">
                ▰ ▰ ▰<br />▰ ▰ ▰
              </div>
              <div className="energy-path" />
              <div className="buildings">
                <span>▥</span>
                <span>▤</span>
                <span>▥</span>
              </div>
            </div>
            <div className="visual-bottom">
              <span>
                From every connection,
                <br />
                <strong>new possibilities.</strong>
              </span>
              <span className="tag">NGN + kWh</span>
            </div>
          </div>
        </section>
        <section className="features">
          <article>
            <Users />
            <h2>Know every connection</h2>
            <p>
              Manage households and businesses, meter IDs, active status and
              prepaid naira credit.
            </p>
          </article>
          <article>
            <ShieldCheck />
            <h2>Keep collections clear</h2>
            <p>
              Separate real revenue from demo simulations. Trace every recorded
              payment by reference.
            </p>
          </article>
          <article>
            <Activity />
            <h2>See productive use</h2>
            <p>
              Log energy use and understand activity across welders, cold
              stores, tailors and households.
            </p>
          </article>
        </section>
        <section className="honest">
          <h2>Lightweight by design. Honest about connectivity.</h2>
          <p>
            Cloudflare delivers the frontend at the edge. Signing in, saving
            records and confirming payments still require a connection to
            Supabase. This MVP does not process real money or control physical
            meters.
          </p>
        </section>
      </main>
      <footer>
        <Brand />
        <span>Mini-grid operations, made clearer.</span>
        <Link href="/signup/">Start your workspace →</Link>
      </footer>
    </>
  );
}
