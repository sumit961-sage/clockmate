import { useEffect, useState } from "react";
import { getOrgs } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, ArrowRight, Loader2, Clock, Mail, UserPlus, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore, useOrgStore } from "@/store";
import { toast } from "sonner";
import type { Organization } from "@/types";

export default function Orgs() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const { setCurrentOrg } = useOrgStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadOrgs();
  }, []);

  async function loadOrgs() {
    try {
      setLoading(true);
      const data = await getOrgs();
      setOrgs(data);
      
      // Auto-redirect if only 1 org
      if (data.length === 1) {
        setCurrentOrg(data[0]);
        navigate(`/dashboard/${data[0].id}/clock`);
      }
    } catch (error: any) {
      toast.error("Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }

  const handleEnterDashboard = (org: Organization) => {
    setCurrentOrg(org);
    navigate(`/dashboard/${org.id}/clock`);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-[#f8fbff] to-[#f6f7fb] flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // User has no organization
  if (orgs.length === 0) {
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
            <div className="text-sm">Signed in as <span className="font-medium">{user?.email}</span></div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-6 py-16">
          {/* Welcome Section */}
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Welcome, {user?.firstName}!
            </h1>
            <p className="mt-3 text-lg text-slate-600">
              You're not part of any organization yet.
            </p>
          </div>

          {/* Two Options */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Option 1: Wait for invite */}
            <Card className="border-slate-200 hover:shadow-lg transition-shadow">
              <CardContent className="pt-8 pb-6 text-center">
                <div className="size-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                  <Mail className="size-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Wait for an Invite</h2>
                <p className="text-slate-600 mb-6">
                  Your employer can invite you to their organization using your email address. 
                  You'll receive an invitation at <strong>{user?.email}</strong>.
                </p>
                <div className="bg-slate-50 rounded-lg p-4 text-left">
                  <p className="text-sm font-medium text-slate-700 mb-2">What happens next:</p>
                  <ul className="text-sm text-slate-600 space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="size-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                      Your employer sends you an invite
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="size-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                      Log in to ClockMate with your account
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="size-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                      You'll be automatically added to their organization
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Option 2: Create new org */}
            <Card className="border-blue-200 hover:shadow-lg transition-shadow bg-blue-50/30">
              <CardContent className="pt-8 pb-6 text-center">
                <div className="size-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                  <Globe className="size-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Create Your Own Organization</h2>
                <p className="text-slate-600 mb-6">
                  Set up your own organization and start managing your team's time tracking, 
                  scheduling, and leave.
                </p>
                <Button 
                  onClick={() => navigate("/register-org")}
                  className="w-full"
                  size="lg"
                >
                  <Plus className="size-4 mr-2" />
                  Create Organization
                </Button>
                <p className="text-xs text-slate-500 mt-3">
                  Free for up to 5 employees. No credit card required.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Refresh Button */}
          <div className="text-center mt-8">
            <Button variant="outline" onClick={loadOrgs}>
              <Loader2 className="size-4 mr-2" />
              Check for Invites
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // User has organizations
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
          <div className="text-sm">Signed in as <span className="font-medium">{user?.email}</span></div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight">Your Organizations</h1>
          <button 
            onClick={() => navigate("/register-org")} 
            className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 transition-colors"
          >
            <Plus className="size-4" />
            Create New
          </button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs.map(org => (
            <div key={org.id} className="rounded-xl border bg-white p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">{org.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    org.role === "OWNER" ? "bg-purple-100 text-purple-700" :
                    org.role === "ADMIN" ? "bg-blue-100 text-blue-700" :
                    "bg-slate-100 text-slate-700"
                  }`}>
                    {org.role}
                  </span>
                </div>
                {org.plan && <p className="text-xs text-slate-600">{org.plan} Plan</p>}
                {org.location && <p className="text-xs text-slate-500">{org.location}</p>}
              </div>
              <button
                onClick={() => handleEnterDashboard(org)}
                className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white px-3 py-2 text-sm hover:bg-blue-700 transition-colors"
              >
                Enter Dashboard
                <ArrowRight className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
