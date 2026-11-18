import { useEffect } from 'react';
import { ShieldOff } from 'lucide-react';
import { AppProvider, useApp } from '@/lib/context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { parseAuthActionParams } from '@/lib/authConfig';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

import HomePage from '@/pages/HomePage';
import ServicesPage from '@/pages/ServicesPage';
import HowItWorksPage from '@/pages/HowItWorksPage';
import AboutPage from '@/pages/AboutPage';
import ContactPage from '@/pages/ContactPage';

import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import VerifyEmailPage from '@/pages/VerifyEmailPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import AuthActionPage from '@/pages/AuthActionPage';

import BookAmbulancePage from '@/pages/BookAmbulancePage';
import UserDashboard from '@/pages/UserDashboard';
import MyBookingsPage from '@/pages/MyBookingsPage';
import BookingDetailsPage from '@/pages/BookingDetailsPage';
import TrackAmbulancePage from '@/pages/TrackAmbulancePage';
import NotificationsPage from '@/pages/NotificationsPage';
import ProfilePage from '@/pages/ProfilePage';
import EditProfilePage from '@/pages/EditProfilePage';
import ManageAddressPage from '@/pages/ManageAddressPage';
import PaymentPage from '@/pages/PaymentPage';
import PaymentConfirmationPage from '@/pages/PaymentConfirmationPage';
import FeedbackPage from '@/pages/FeedbackPage';
import DriverVerifyPage from '@/pages/DriverVerifyPage';

import AdminDashboard from '@/pages/AdminDashboard';
import AdminBookings from '@/pages/AdminBookings';
import AdminAmbulances from '@/pages/AdminAmbulances';
import AdminDrivers from '@/pages/AdminDrivers';
import AdminUsers from '@/pages/AdminUsers';
import AdminHospitals from '@/pages/AdminHospitals';
import AdminPayments from '@/pages/AdminPayments';
import AdminReports from '@/pages/AdminReports';
import AdminNotifications from '@/pages/AdminNotifications';
import AdminSettings from '@/pages/AdminSettings';

const protectedRoutes = [
  '/dashboard',
  '/book',
  '/bookings',
  '/booking-details',
  '/track',
  '/notifications',
  '/profile',
  '/edit-profile',
  '/address',
  '/payment',
  '/payment-confirmation',
  '/feedback',
  '/driver',
];

function Router() {
  const { route, navigate } = useApp();
  const { user, loading } = useAuth();
  const path = route.split('?')[0];

  // Intercept Firebase email action links on mount (e.g. ?mode=verifyEmail&oobCode=...#/)
  useEffect(() => {
    const { mode, oobCode } = parseAuthActionParams();
    if (mode && oobCode) {
      if (mode === 'resetPassword') {
        navigate(`/reset-password?oobCode=${encodeURIComponent(oobCode)}`);
      } else {
        navigate(`/auth/action?mode=${encodeURIComponent(mode)}&oobCode=${encodeURIComponent(oobCode)}`);
      }
    }
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Auth pages (public)
  if (path === '/login') return <LoginPage />;
  if (path === '/signup') return <SignupPage />;
  if (path === '/forgot-password') return <ForgotPasswordPage />;
  if (path === '/reset-password') return <ResetPasswordPage />;
  if (path === '/auth/action') return <AuthActionPage />;
  if (path === '/verify-email') return <VerifyEmailPage />;

  const adminPages: Record<string, React.ReactNode> = {
    '/admin': <AdminDashboard />,
    '/admin/bookings': <AdminBookings />,
    '/admin/ambulances': <AdminAmbulances />,
    '/admin/drivers': <AdminDrivers />,
    '/admin/users': <AdminUsers />,
    '/admin/hospitals': <AdminHospitals />,
    '/admin/payments': <AdminPayments />,
    '/admin/reports': <AdminReports />,
    '/admin/notifications': <AdminNotifications />,
    '/admin/settings': <AdminSettings />,
  };

  // Admin routes protection
  if (path.startsWith('/admin')) {
    if (!user) return <LoginPage />;
    const isAdmin = user.user_metadata?.role === 'admin' || user.email === 'admin@lifecare.com';
    if (!isAdmin) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-sm px-6">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <ShieldOff className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-sm text-gray-500 mb-5">
              You don't have permission to access the admin panel. Please log in with an admin account.
            </p>
            <button onClick={() => navigate('/dashboard')} className="btn-primary text-sm">
              Go to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return <>{adminPages[path] || <AdminDashboard />}</>;
  }

  const isProtected = protectedRoutes.includes(path);
  const isAdmin = user?.user_metadata?.role === 'admin' || user?.email === 'admin@lifecare.com';

  // 1. Not signed in: redirect to login
  if (isProtected && !user) {
    navigate(path);
    return <LoginPage />;
  }

  // 2. Signed in but unverified (admin exempt): redirect to verify email
  if (isProtected && user && !isAdmin && !user.emailVerified) {
    return <VerifyEmailPage />;
  }

  const userPages: Record<string, React.ReactNode> = {
    '/dashboard': <UserDashboard />,
    '/book': <BookAmbulancePage />,
    '/bookings': <MyBookingsPage />,
    '/booking-details': <BookingDetailsPage />,
    '/track': <TrackAmbulancePage />,
    '/notifications': <NotificationsPage />,
    '/profile': <ProfilePage />,
    '/edit-profile': <EditProfilePage />,
    '/address': <ManageAddressPage />,
    '/payment': <PaymentPage />,
    '/payment-confirmation': <PaymentConfirmationPage />,
    '/feedback': <FeedbackPage />,
    '/driver': <DriverVerifyPage />,
  };

  const publicPages: Record<string, React.ReactNode> = {
    '/': <HomePage />,
    '/services': <ServicesPage />,
    '/how-it-works': <HowItWorksPage />,
    '/about': <AboutPage />,
    '/contact': <ContactPage />,
  };

  const page = userPages[path] || publicPages[path] || <HomePage />;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1">{page}</div>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <Router />
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
