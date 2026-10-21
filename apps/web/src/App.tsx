import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from '@/layouts/PublicLayout';
import { DashboardLayout, AdminGuard } from '@/layouts/DashboardLayout';
import LandingPage from '@/pages/LandingPage';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmailPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const QRListPage = lazy(() => import('@/pages/QRListPage'));
const QRCreatePage = lazy(() => import('@/pages/QRCreatePage'));
const QRDetailPage = lazy(() => import('@/pages/QRDetailPage'));
const QREditPage = lazy(() => import('@/pages/QREditPage'));
const QRStatsPage = lazy(() => import('@/pages/QRStatsPage'));
const TemplatesPage = lazy(() => import('@/pages/TemplatesPage'));
const ApiKeysPage = lazy(() => import('@/pages/ApiKeysPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const SessionsPage = lazy(() => import('@/pages/SessionsPage'));
const AdminDashboardPage = lazy(() => import('@/pages/AdminDashboardPage'));
const AdminCampaignsPage = lazy(() => import('@/pages/AdminCampaignsPage'));
const AdminCampaignDetailPage = lazy(() => import('@/pages/AdminCampaignDetailPage'));
const AdminTemplatesPage = lazy(() => import('@/pages/AdminTemplatesPage'));
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage'));
const AdminCampaignCreatePage = lazy(() => import('@/pages/AdminCampaignCreatePage'));
const AdminMetricsPage = lazy(() => import('@/pages/AdminMetricsPage'));
const FeaturesPage = lazy(() => import('@/pages/FeaturesPage'));
const PricingPage = lazy(() => import('@/pages/PricingPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const ForbiddenPage = lazy(() => import('@/pages/ForbiddenPage'));
const UnauthorizedPage = lazy(() => import('@/pages/UnauthorizedPage'));
const ServerErrorPage = lazy(() => import('@/pages/ServerErrorPage'));

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-label="Chargement de la page">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/legal/privacy" element={<PrivacyPage />} />
          <Route path="/legal/terms" element={<TermsPage />} />
        </Route>

        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="qr" element={<QRListPage />} />
          <Route path="qr/new" element={<QRCreatePage />} />
          <Route path="qr/:id" element={<QRDetailPage />} />
          <Route path="qr/:id/edit" element={<QREditPage />} />
          <Route path="qr/:id/stats" element={<QRStatsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="api-keys" element={<ApiKeysPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/sessions" element={<SessionsPage />} />
        </Route>

        <Route
          path="/admin"
          element={
            <AdminGuard>
              <DashboardLayout />
            </AdminGuard>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="campaigns" element={<AdminCampaignsPage />} />
          <Route path="campaigns/new" element={<AdminCampaignCreatePage />} />
          <Route path="campaigns/:id" element={<AdminCampaignDetailPage />} />
          <Route path="templates" element={<AdminTemplatesPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="metrics" element={<AdminMetricsPage />} />
        </Route>

        <Route path="/401" element={<PublicLayout><UnauthorizedPage /></PublicLayout>} />
        <Route path="/403" element={<PublicLayout><ForbiddenPage /></PublicLayout>} />
        <Route path="/500" element={<PublicLayout><ServerErrorPage /></PublicLayout>} />
        <Route path="/404" element={<PublicLayout><NotFoundPage /></PublicLayout>} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
}
