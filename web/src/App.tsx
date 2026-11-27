import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import Landing from './pages/Landing';
import { ForgotPassword, Login, ResetPassword, Signup } from './pages/Auth';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Farms = lazy(() => import('./pages/Farms'));
const ZoneMap = lazy(() => import('./pages/ZoneMap'));
const Soil = lazy(() => import('./pages/Soil'));
const Robot = lazy(() => import('./pages/Robot'));
const ManualEntry = lazy(() => import('./pages/ManualEntry'));
const Disease = lazy(() => import('./pages/Disease'));
const Nutrients = lazy(() => import('./pages/Nutrients'));
const Fertilizer = lazy(() => import('./pages/Fertilizer'));
const Crops = lazy(() => import('./pages/Crops'));
const Weather = lazy(() => import('./pages/Weather'));
const Irrigation = lazy(() => import('./pages/Irrigation'));
const BioPod = lazy(() => import('./pages/BioPod'));
const Finance = lazy(() => import('./pages/Finance'));
const Prices = lazy(() => import('./pages/Prices'));
const Decisions = lazy(() => import('./pages/Decisions'));
const Reports = lazy(() => import('./pages/Reports'));
const Profile = lazy(() => import('./pages/Profile'));
const SettingsPage = lazy(() => import('./pages/Settings'));

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Navigate to="/app" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/app" element={<Protected><Layout /></Protected>}>
          <Route index element={<Dashboard />} />
          <Route path="farms" element={<Farms />} />
          <Route path="map" element={<ZoneMap />} />
          <Route path="soil" element={<Soil />} />
          <Route path="robot" element={<Robot />} />
          <Route path="manual" element={<ManualEntry />} />
          <Route path="disease" element={<Disease />} />
          <Route path="nutrients" element={<Nutrients />} />
          <Route path="fertilizer" element={<Fertilizer />} />
          <Route path="crops" element={<Crops />} />
          <Route path="weather" element={<Weather />} />
          <Route path="irrigation" element={<Irrigation />} />
          <Route path="biopod" element={<BioPod />} />
          <Route path="finance" element={<Finance />} />
          <Route path="prices" element={<Prices />} />
          <Route path="decisions" element={<Decisions />} />
          <Route path="reports" element={<Reports />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
