import { Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from '@/layouts/PublicLayout';
import { DashboardLayout, AdminGuard } from '@/layouts/DashboardLayout';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import VerifyEmailPage from '@/pages/VerifyEmailPage';
import DashboardPage from '@/pages/DashboardPage';
import QRListPage from '@/pages/QRListPage';
import QRCreatePage from '@/pages/QRCreatePage';
import QRDetailPage from '@/pages/QRDetailPage';
import QREditPage from '@/pages/QREditPage';
import QRStatsPage from '@/pages/QRStatsPage';
import TemplatesPage from '@/pages/TemplatesPage';
import ApiKeysPage from '@/pages/ApiKeysPage';
import SettingsPage from '@/pages/SettingsPage';
import SessionsPage from '@/pages/SessionsPage';
import AdminDashboardPage from '@/pages/AdminDashboardPage';
import AdminCampaignsPage from '@/pages/AdminCampaignsPage';
import AdminCampaignDetailPage from '@/pages/AdminCampaignDetailPage';
import AdminTemplatesPage from '@/pages/AdminTemplatesPage';
import AdminUsersPage from '@/pages/AdminUsersPage';
import AdminCampaignCreatePage from '@/pages/AdminCampaignCreatePage';
import AdminMetricsPage from '@/pages/AdminMetricsPage';
import FeaturesPage from '@/pages/FeaturesPage';
import PricingPage from '@/pages/PricingPage';
import PrivacyPage from '@/pages/PrivacyPage';
import TermsPage from '@/pages/TermsPage';
import NotFoundPage from '@/pages/NotFoundPage';
import ForbiddenPage from '@/pages/ForbiddenPage';
import UnauthorizedPage from '@/pages/UnauthorizedPage';
import ServerErrorPage from '@/pages/ServerErrorPage';

export default function App() {
  return (
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
  );
}
