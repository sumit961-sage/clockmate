// ClockMate Pro - Main App Component
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Store
import { useAuthStore } from '@/store';

// Pages
import Landing from './pages/Landing';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Orgs from './pages/Orgs';
import RegisterOrg from './pages/RegisterOrg';

// Dashboard Pages
import DashboardLayout from './components/DashboardLayout';
import ClockPage from './pages/dashboard/Clock';
import SchedulePage from './pages/dashboard/Schedule';
import TimesheetsPage from './pages/dashboard/Timesheets';
import LeavePage from './pages/dashboard/Leave';
import TeamPage from './pages/dashboard/Team';
import LocationsPage from './pages/dashboard/Locations';
import AnalyticsPage from './pages/dashboard/Analytics';
import SettingsPage from './pages/dashboard/Settings';
import ProfilePage from './pages/dashboard/Profile';
import PayslipsPage from './pages/dashboard/Payslips';

// Create Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

// AuthInitializer component to sync localStorage with store
function AuthInitializer() {
  const initFromStorage = useAuthStore((state) => state.initFromStorage);
  
  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);
  
  return null;
}

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  
  // Show nothing while checking auth state
  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="size-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthInitializer />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          
          {/* Protected Routes */}
          <Route path="/orgs" element={
            <ProtectedRoute>
              <Orgs />
            </ProtectedRoute>
          } />
          <Route path="/register-org" element={
            <ProtectedRoute>
              <RegisterOrg />
            </ProtectedRoute>
          } />
          
          {/* Dashboard Routes */}
          <Route path="/dashboard/:orgId" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="clock" replace />} />
            <Route path="clock" element={<ClockPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="timesheets" element={<TimesheetsPage />} />
            <Route path="leave" element={<LeavePage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="locations" element={<LocationsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="payslips" element={<PayslipsPage />} />
          </Route>
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      
      <Toaster 
        position="top-right" 
        richColors 
        closeButton
        toastOptions={{
          style: {
            fontFamily: 'inherit',
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
