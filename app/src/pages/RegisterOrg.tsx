import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createOrg } from "@/lib/api";
import { Building2, Check, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { PlanType } from "@/types";

const plans = [
  { name: "Starter", price: "$0/mo", limit: 5, value: "STARTER" as PlanType, cta: "Start free" },
  { name: "Team", price: "$39/mo", limit: 25, value: "TEAM" as PlanType, cta: "Choose Team", popular: true },
  { name: "Business", price: "$99/mo", limit: 100, value: "BUSINESS" as PlanType, cta: "Contact sales" },
];

const orgTypes = ["Retail", "Construction", "Hospitality", "Healthcare", "Education", "Other"];
const industries = ["Food & Beverage", "Manufacturing", "IT Services", "Logistics", "Real Estate", "Other"];

export default function RegisterOrg() {
  const [name, setName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("STARTER");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const [industry, setIndustry] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) return setErr("Company name is required");

    setLoading(true);
    try {
      const org = await createOrg({
        name: name.trim(),
        plan: selectedPlan,
        location: location.trim() || undefined,
        type: type || undefined,
        industry: industry || undefined,
      });

      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const updatedUser = { ...user, currentOrg: org, role: org.role || 'OWNER' };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      // Dispatch storage event to trigger auth store update
      window.dispatchEvent(new StorageEvent('storage', { key: 'user' }));
      // Also update auth store directly
      window.location.href = `/dashboard/${org.id}/clock`;

      toast.success("Organization created successfully! Redirecting...");
      // Hard redirect to ensure auth store picks up new OWNER role
      window.location.href = `/dashboard/${org.id}/clock`;
    } catch (e: any) {
      setErr(e.message || "Failed to create organization");
      toast.error(e.message || "Failed to create organization");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-[#f8fbff] to-[#f6f7fb] text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm flex items-center justify-center">
              <Clock className="size-5 text-white" />
            </div>
            <span className="text-xl font-semibold tracking-tight">ClockMate</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="text-center mb-10">
          <div className="size-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <Building2 className="size-8 text-blue-600" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Register your company</h1>
          <p className="mt-2 text-slate-600">Tell us about your business and choose a plan.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-8">
          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Company name <span className="text-red-600">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Pty Ltd"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-blue-100 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Location (optional)</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Sydney, Australia"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-blue-100 transition-all"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700">Business type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-blue-100 transition-all"
              >
                <option value="">Select type</option>
                {orgTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Industry</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-blue-100 transition-all"
              >
                <option value="">Select industry</option>
                {industries.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-4">Choose your plan</label>
            <div className="grid md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <label
                  key={plan.name}
                  className={`relative rounded-2xl border-2 p-6 cursor-pointer transition-all ${
                    selectedPlan === plan.value
                      ? "border-blue-600 shadow-lg"
                      : "border-slate-200 hover:border-slate-300"
                  } ${plan.popular ? "ring-2 ring-blue-100" : ""}`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs text-white">
                      Most popular
                    </span>
                  )}
                  <input
                    type="radio"
                    name="plan"
                    value={plan.value}
                    checked={selectedPlan === plan.value}
                    onChange={(e) => setSelectedPlan(e.target.value as PlanType)}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <p className="mt-1 text-2xl font-bold">{plan.price}</p>
                    <p className="text-sm text-slate-600">up to {plan.limit} employees</p>
                    <div className={`mt-4 w-full rounded-lg px-4 py-2 text-sm font-medium ${
                      selectedPlan === plan.value
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}>
                      {selectedPlan === plan.value && <Check className="size-4 inline mr-1" />}
                      {plan.cta}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 text-white px-4 py-3 font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating organization…
              </>
            ) : (
              "Create organization"
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
