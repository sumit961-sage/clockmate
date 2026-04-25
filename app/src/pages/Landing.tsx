import { Link } from 'react-router-dom';
import { Sparkles, Check, Target, FileSpreadsheet, Shield, Zap, Mail, BarChart3, Clock, MapPin, Users, Calendar } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-[100dvh] w-screen overflow-x-hidden flex flex-col bg-[linear-gradient(180deg,#f8fbff,white_40%,#f6f7fb)] text-slate-800">
      {/* Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm flex items-center justify-center">
              <Clock className="size-5 text-white" />
            </div>
            <span className="text-xl font-semibold tracking-tight">ClockMate</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm">
            <Link className="hover:text-blue-700 transition-colors" to="#features">Features</Link>
            <Link className="hover:text-blue-700 transition-colors" to="#how">How it works</Link>
            <Link className="hover:text-blue-700 transition-colors" to="#pricing">Pricing</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors">
              Sign in
            </Link>
            <Link to="/signup" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="w-full min-h-[100dvh] flex items-center mx-auto max-w-7xl px-6 py-16 md:py-24 grid md:grid-cols-2 gap-12">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
            <Sparkles className="size-3.5 text-yellow-500" /> 
            New: GPS-Verified Clocking & PDF Payslips
          </div>
          <h1 className="mt-4 text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
            Time tracking that's{" "}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              accurate, fast, effortless
            </span>.
          </h1>
          <p className="mt-5 text-lg text-slate-600">
            ClockMate combines GPS geofencing, smart approvals, and instant exports so managers save hours
            and teams clock in without friction.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link to="/signup" className="px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow transition-colors text-center">
              Start free
            </Link>
            <Link to="#features" className="px-6 py-3 rounded-xl border border-slate-300 hover:bg-slate-50 transition-colors text-center">
              Explore features
            </Link>
          </div>
          <p className="mt-3 text-sm text-slate-500">No credit card • Set up in minutes • Web & mobile</p>

          <div className="mt-10 flex flex-wrap items-center gap-6 text-slate-500">
            <TrustLogo label="Aus SMEs" />
            <DotSep />
            <TrustLogo label="Secure by design" />
            <DotSep />
            <TrustLogo label="99.9% uptime" />
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-tr from-blue-100 via-indigo-100 to-white blur-2xl" />
          <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Today • Sydney HQ</p>
                <p className="text-lg font-semibold">Live Attendance</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 text-xs">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" /> Live
              </span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Metric label="On-site now" value="18" />
              <Metric label="Late arrivals" value="2" />
              <Metric label="Avg. distance" value="27 m" />
              <Metric label="Overtime" value="1.3 h" />
              <div className="sm:col-span-2 rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Recent Events</p>
                <ul className="mt-2 space-y-2 text-sm">
                  <li className="flex items-center gap-2"><Check className="size-4 text-emerald-600" /> 09:02 • Manish • Clock In (23 m)</li>
                  <li className="flex items-center gap-2"><Check className="size-4 text-emerald-600" /> 12:31 • Sara • Break Start</li>
                  <li className="flex items-center gap-2"><Check className="size-4 text-emerald-600" /> 13:00 • Sara • Break End</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-16">
        <Header title="Built for busy teams" subtitle="Everything you need, nothing you don't." />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <Feature icon={<Target className="size-5" />} title="GPS geofence" desc="Only allow clock-ins inside your site boundary. Stop buddy punching." />
          <Feature icon={<FileSpreadsheet className="size-5" />} title="Timesheets & exports" desc="One-click CSV/XLS. Notes and approvals included." />
          <Feature icon={<Shield className="size-5" />} title="RBAC & security" desc="Admin, Manager, Employee. Principle of least privilege." />
          <Feature icon={<Zap className="size-5" />} title="Fast & reliable" desc="Snappy UI with real-time updates and 99.9% uptime." />
          <Feature icon={<Mail className="size-5" />} title="PDF payslips" desc="Automated calculations with email delivery." />
          <Feature icon={<BarChart3 className="size-5" />} title="Analytics" desc="Trends, lateness, overtime—see issues before they grow." />
        </div>
        
        {/* Additional Features */}
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <MiniFeature icon={<Clock className="size-4" />} title="Real-time Tracking" desc="Live clock-in/out with duration counter" />
          <MiniFeature icon={<MapPin className="size-4" />} title="Multi-location" desc="Manage multiple sites with separate geofences" />
          <MiniFeature icon={<Users className="size-4" />} title="Team Management" desc="Organize by departments and managers" />
          <MiniFeature icon={<Calendar className="size-4" />} title="Shift Scheduling" desc="Create and assign shifts with ease" />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-7xl px-6 py-16">
        <Header title="Three simple steps" subtitle="From setup to insights in under 10 minutes." />
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          <Step num="1" title="Create locations" desc="Drop a pin and radius (e.g., 100 m)." />
          <Step num="2" title="Invite staff" desc="Add employees, set roles, and share the link." />
          <Step num="3" title="Clock & approve" desc="Employees clock in on site; you approve and export." />
        </ol>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-16">
        <Header title="Simple pricing" subtitle="Start free. Upgrade when you grow." />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <Plan name="Starter" price="$0" note="up to 5 employees" features={["GPS geofencing", "Basic timesheets", "Email support"]} cta="Start free" />
          <Plan name="Team" price="$39" note="up to 25 employees" features={["Everything in Starter", "Shift scheduling", "Leave management", "Priority support"]} cta="Choose Team" highlight />
          <Plan name="Business" price="$99" note="up to 100 employees" features={["Everything in Team", "Advanced analytics", "API access", "Dedicated support"]} cta="Contact sales" />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600">
        <div className="mx-auto max-w-7xl px-6 py-14 text-center text-white">
          <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight">Ready to save hours every week?</h3>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/signup" className="px-6 py-3 rounded-xl bg-white text-blue-700 hover:bg-blue-50 transition-colors">
              Get Started
            </Link>
            <Link to="/login" className="px-6 py-3 rounded-xl border border-white/70 text-white hover:bg-white/10 transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-6 py-8 text-sm text-slate-500 flex flex-col md:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} ClockMate.</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-slate-700">Privacy</Link>
            <Link to="/terms" className="hover:text-slate-700">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-2 text-slate-600">{subtitle}</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md hover:-translate-y-1">
      <div className="mb-3 inline-flex items-center justify-center rounded-xl bg-blue-50 p-3 text-blue-700 group-hover:bg-blue-100 transition-colors">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-slate-600">{desc}</p>
    </div>
  );
}

function MiniFeature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50">
      <div className="shrink-0 text-blue-600">{icon}</div>
      <div>
        <h4 className="font-medium text-sm">{title}</h4>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function Step({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="size-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">{num}</div>
      <h4 className="mt-3 font-semibold">{title}</h4>
      <p className="text-slate-600">{desc}</p>
    </li>
  );
}

function Plan({ name, price, note, features, cta, highlight }: { name: string; price: string; note: string; features: string[]; cta: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-6 shadow-sm transition hover:shadow-md ${highlight ? "ring-2 ring-blue-600 border-blue-600" : "border-slate-200"}`}>
      <h3 className="text-lg font-semibold">{name}</h3>
      <div className="mt-2 text-3xl font-extrabold">
        {price}<span className="text-base font-medium text-slate-500">/mo</span>
      </div>
      <p className="mt-1 text-slate-600">{note}</p>
      <ul className="mt-4 space-y-2">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
            <Check className="size-4 text-emerald-500" />
            {feature}
          </li>
        ))}
      </ul>
      <Link to="/signup" className={`mt-6 inline-block w-full text-center px-4 py-2 rounded-lg transition-colors ${highlight ? "bg-blue-600 text-white hover:bg-blue-700" : "border hover:bg-slate-50"}`}>
        {cta}
      </Link>
    </div>
  );
}

function TrustLogo({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <div className="size-4 rounded-md bg-slate-300" />
      <span className="text-xs">{label}</span>
    </div>
  );
}

function DotSep() {
  return <span className="mx-1 inline-block size-1 rounded-full bg-slate-300 align-middle" />;
}
