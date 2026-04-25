import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { startPasswordAuth } from "@/lib/api";
import { useAuthStore } from "@/store";
import { Eye, EyeOff, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Please enter a valid email address.");
    if (pwd.length < 6) return setErr("Password must be at least 6 characters.");

    setLoading(true);
    try {
      const res = await startPasswordAuth(email, pwd);
      localStorage.setItem("accessToken", res.accessToken);
      localStorage.setItem("user", JSON.stringify(res.user));
      
      // Update Zustand store
      setUser(res.user);
      
      toast.success("Signed in successfully!");
      navigate("/orgs");
    } catch (e: any) {
      setErr(e.message || "Sign in failed. Please try again.");
      toast.error(e.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] w-screen overflow-x-hidden bg-[linear-gradient(180deg,#f8fbff,white_40%,#f6f7fb)] text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm flex items-center justify-center">
              <Clock className="size-5 text-white" />
            </div>
            <span className="text-xl font-semibold tracking-tight">ClockMate</span>
          </Link>
          <div className="text-sm">
            New here?{" "}
            <Link to="/signup" className="text-blue-600 hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100dvh-80px)]">
          <div className="hidden lg:block">
            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-tr from-blue-100 via-indigo-100 to-white blur-2xl" />
              <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur p-8 shadow-xl">
                <h2 className="text-2xl font-bold">Welcome back</h2>
                <p className="mt-2 text-slate-600">
                  Sign in to manage timesheets, approve clock events, and export payroll.
                </p>
                <div className="mt-6 grid sm:grid-cols-2 gap-4">
                  <Metric label="Teams on-site" value="12" />
                  <Metric label="Late today" value="2" />
                  <Metric label="Overtime (wk)" value="4.1 h" />
                  <Metric label="Avg. distance" value="31 m" />
                </div>
                
                <div className="mt-6 p-4 bg-slate-50 rounded-xl">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Demo Accounts</p>
                  <div className="space-y-1 text-sm text-slate-600">
                    <p><span className="font-medium">Owner:</span> owner@clockmate.com</p>
                    <p><span className="font-medium">Admin:</span> admin@clockmate.com</p>
                    <p><span className="font-medium">Manager:</span> manager@clockmate.com</p>
                    <p><span className="font-medium">Employee:</span> employee@clockmate.com</p>
                    <p className="text-xs text-slate-400 mt-2">Password: password123</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-md w-full mx-auto lg:mx-0">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Sign in</h1>
            <p className="mt-2 text-slate-600">Use your email and password to continue.</p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              {err && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {err}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">Password</label>
                  <Link to="/forgot" className="text-sm text-blue-600 hover:underline">
                    Forgot?
                  </Link>
                </div>
                <div className="mt-1 relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700"
                  >
                    {showPwd ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-xl bg-blue-600 text-white px-4 py-3 font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Continue"
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-6 py-8 text-sm text-slate-500 flex flex-col md:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} ClockMate.</p>
        </div>
      </footer>
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
