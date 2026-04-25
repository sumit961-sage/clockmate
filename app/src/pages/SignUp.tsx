import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "@/lib/api";
import { Eye, EyeOff, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SignUp() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!firstName.trim()) return setErr("Please enter your first name.");
    if (!lastName.trim()) return setErr("Please enter your last name.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Please enter a valid email.");
    if (pwd.length < 6) return setErr("Password must be at least 6 characters.");
    if (pwd !== confirm) return setErr("Passwords do not match.");
    if (!agree) return setErr("You must accept the Terms and Privacy Policy.");

    setLoading(true);
    try {
      const res = await registerUser(`${firstName.trim()} ${lastName.trim()}`, email.trim(), pwd);
      localStorage.setItem("accessToken", res.accessToken);
      localStorage.setItem("user", JSON.stringify(res.user));
      toast.success("Account created successfully!");
      navigate("/orgs");
    } catch (e: any) {
      setErr(e.message || "Sign-up failed. Please try again.");
      toast.error(e.message || "Sign-up failed");
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
            Already have an account?{" "}
            <Link to="/login" className="text-blue-600 hover:underline">Sign in</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100dvh-80px)]">
          <div className="hidden lg:block">
            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-tr from-blue-100 via-indigo-100 to-white blur-2xl" />
              <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur p-8 shadow-xl">
                <h2 className="text-2xl font-bold">Create your ClockMate account</h2>
                <p className="mt-2 text-slate-600">Join your team or create your own organization.</p>
                <div className="mt-6 grid sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Setup time</p><p className="mt-1 text-2xl font-bold">&lt; 5 min</p></div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Exports</p><p className="mt-1 text-2xl font-bold">CSV / XLSX</p></div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Roles</p><p className="mt-1 text-2xl font-bold">Admin / Manager / Emp</p></div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Geofence</p><p className="mt-1 text-2xl font-bold">GPS verified</p></div>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-md w-full mx-auto lg:mx-0">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Create account</h1>
            <p className="mt-2 text-slate-600">No work email required. Join or create your org after sign-up.</p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              {err && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">First Name *</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-blue-100 transition-all" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Last Name *</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-blue-100 transition-all" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-blue-100 transition-all" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Password *</label>
                <div className="mt-1 relative">
                  <input type={showPwd ? "text" : "password"} value={pwd} onChange={(e) => setPwd(e.target.value)}
                    placeholder="At least 6 characters" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 outline-none focus:ring-4 focus:ring-blue-100 transition-all" minLength={6} required />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700">
                    {showPwd ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Confirm Password *</label>
                <input type={showPwd ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-blue-100 transition-all" minLength={6} required />
              </div>

              <label className="flex items-start gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 rounded border-slate-300" />
                <span>I agree to the <Link className="text-blue-600 hover:underline" to="/terms">Terms</Link> and <Link className="text-blue-600 hover:underline" to="/privacy">Privacy Policy</Link>.</span>
              </label>

              <button type="submit" disabled={loading}
                className="mt-2 w-full rounded-xl bg-blue-600 text-white px-4 py-3 font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="size-4 animate-spin" />Creating account...</> : "Create account"}
              </button>
            </form>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-6 py-8 text-sm text-slate-500 flex flex-col md:flex-row items-center justify-between gap-3">
          <p>&copy; {new Date().getFullYear()} ClockMate.</p>
        </div>
      </footer>
    </div>
  );
}
