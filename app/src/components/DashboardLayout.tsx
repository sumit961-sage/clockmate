import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams, Outlet, useLocation } from 'react-router-dom';
import { 
  Clock, Calendar, FileText, Briefcase, Users, MapPin, 
  BarChart3, Settings, LogOut, Menu, Bell, ChevronDown,
  Building2, User, Wallet
} from 'lucide-react';
import { useAuthStore, useOrgStore, useUIStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles?: string[];
}

// Employee nav items (all employees see these)
const employeeNavItems: NavItem[] = [
  { label: 'Clock', icon: <Clock className="size-5" />, path: 'clock' },
  { label: 'My Schedule', icon: <Calendar className="size-5" />, path: 'schedule' },
  { label: 'My Timesheets', icon: <FileText className="size-5" />, path: 'timesheets' },
  { label: 'My Leave', icon: <Briefcase className="size-5" />, path: 'leave' },
];

// Manager nav items
const managerNavItems: NavItem[] = [
  { label: 'My Team', icon: <Users className="size-5" />, path: 'team', roles: ['MANAGER', 'ADMIN', 'OWNER'] },
  { label: 'Analytics', icon: <BarChart3 className="size-5" />, path: 'analytics', roles: ['MANAGER', 'ADMIN', 'OWNER'] },
];

// Admin nav items
const adminNavItems: NavItem[] = [
  { label: 'All Employees', icon: <Users className="size-5" />, path: 'team', roles: ['ADMIN', 'OWNER'] },
  { label: 'Locations', icon: <MapPin className="size-5" />, path: 'locations', roles: ['ADMIN', 'OWNER'] },
  { label: 'Payslips', icon: <Wallet className="size-5" />, path: 'payslips', roles: ['ADMIN', 'OWNER', 'MANAGER'] },
  { label: 'Analytics', icon: <BarChart3 className="size-5" />, path: 'analytics', roles: ['ADMIN', 'OWNER'] },
  { label: 'Settings', icon: <Settings className="size-5" />, path: 'settings', roles: ['ADMIN', 'OWNER'] },
];

export default function DashboardLayout() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { currentOrg, orgs, setCurrentOrg } = useOrgStore();
  const { sidebarOpen, setSidebarOpen, isMobile, setIsMobile } = useUIStore();
  const [notifications, setNotifications] = useState(3);

  useEffect(() => {
    if (orgId && orgs.length > 0) {
      const org = orgs.find(o => o.id === orgId);
      if (org) setCurrentOrg(org);
    }
  }, [orgId, orgs, setCurrentOrg]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) setSidebarOpen(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setIsMobile, setSidebarOpen]);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  // Get nav items based on role
  const getNavItems = (): NavItem[] => {
    const role = user?.role || 'EMPLOYEE';
    
    if (role === 'OWNER' || role === 'ADMIN') {
      // Admin/Owner: employee items + admin items (replace "My Team" with "All Employees")
      return [
        ...employeeNavItems.filter(i => i.path !== 'team'),
        ...adminNavItems,
      ];
    }
    
    if (role === 'MANAGER') {
      // Manager: employee items + manager items
      return [
        ...employeeNavItems,
        ...managerNavItems.filter(item => !item.roles || item.roles.includes(role)),
      ];
    }
    
    // Employee: only employee items
    return employeeNavItems;
  };

  const navItems = getNavItems();
  const pathParts = location.pathname.split('/');
  const currentPath = pathParts[pathParts.length - 1];
  const isActivePath = (path: string) => currentPath === path;

  const pageTitle = navItems.find(item => isActivePath(item.path))?.label || 'Dashboard';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-slate-200/70">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm flex items-center justify-center">
            <Clock className="size-5 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight">ClockMate</span>
        </Link>
      </div>

      {/* Organization Selector */}
      <div className="p-4 border-b border-slate-200/70">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-slate-500" />
                <span className="truncate">{currentOrg?.name || 'Select Org'}</span>
              </div>
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {orgs.map(org => (
              <DropdownMenuItem key={org.id} onClick={() => navigate(`/dashboard/${org.id}/clock`)}>
                {org.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/register-org')}>
              + Create new organization
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Role Badge */}
      <div className="px-4 pt-3 pb-1">
        <span className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
          user?.role === 'OWNER' ? "bg-purple-100 text-purple-700" :
          user?.role === 'ADMIN' ? "bg-red-100 text-red-700" :
          user?.role === 'MANAGER' ? "bg-indigo-100 text-indigo-700" :
          "bg-slate-100 text-slate-700"
        )}>
          {user?.role}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-auto">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={`/dashboard/${orgId}/${item.path}`}
            onClick={() => isMobile && setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActivePath(item.path)
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-slate-200/70">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-3 px-2">
              <div className="size-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-medium">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
              <ChevronDown className="size-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => navigate(`/dashboard/${orgId}/profile`)}>
              <User className="size-4 mr-2" />Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/dashboard/${orgId}/settings`)}>
              <Settings className="size-4 mr-2" />Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="size-4 mr-2" />Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 fixed h-full transition-transform duration-300 z-20",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isMobile && sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className={cn("flex-1 transition-all duration-300 min-h-screen", sidebarOpen ? "lg:ml-64" : "lg:ml-0")}>
        {/* Top Header */}
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200/70 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:flex">
              <Menu className="size-5" />
            </Button>
            <h1 className="text-lg font-semibold text-slate-800">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative" onClick={() => setNotifications(0)}>
              <Bell className="size-5" />
              {notifications > 0 && (
                <span className="absolute top-1 right-1 size-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{notifications}</span>
              )}
            </Button>
          </div>
        </header>
        <div className="p-4 lg:p-6"><Outlet /></div>
      </main>
    </div>
  );
}
