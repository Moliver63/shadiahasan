import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ShadiaAssistantChat } from "./components/ShadiaAssistantChat";
import CookieConsent from "./components/CookieConsent";
import { ThemeProvider } from "./contexts/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminAppointments from "./pages/AdminAppointments";
import AdminFinanceiro from "./pages/AdminFinanceiro";
import AdminPrograms from "./pages/AdminPrograms";
import AdminCourses from "./pages/AdminCourses";
import AdminPlans from "./pages/AdminPlans";
import AdminCourseLessons from "./pages/AdminCourseLessons";
import AdminSettings from "./pages/AdminSettings";
import AdminLessons from "./pages/AdminLessons";
import AdminStudents from "./pages/AdminStudents";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import LessonView from "./pages/LessonView";
import MyCourses from "./pages/MyCourses";
import Pricing from "./pages/Pricing";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import Ebooks from "./pages/Ebooks";
import EbookReader from "./pages/EbookReader";
import MyCertificates from "./pages/MyCertificates";
import About from "./pages/About";
import Contact from "./pages/Contact";
import FAQ from "./pages/FAQ";
import Profile from "./pages/Profile";
import CommunityExplore from "./pages/CommunityExplore";
import CommunityConnections from "./pages/CommunityConnections";
import AdminModeration from "./pages/AdminModeration";
import AdminManageAdmins from "./pages/AdminManageAdmins";
import AdminAccountSettings from "./pages/AdminAccountSettings";
import AdminManageSubscriptions from "./pages/AdminManageSubscriptions";
import Messages from "./pages/Messages";
import EditProfile from "./pages/EditProfile";
import MySubscription from "./pages/MySubscription";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import UserReferrals from "./pages/UserReferrals";
import AdminCashbackRequests from "./pages/AdminCashbackRequests";
import AdminManagement from "./pages/admin/AdminManagement";
import AcceptAdminInvite from "./pages/AcceptAdminInvite";

// Temporary stub to prevent runtime crash if Admin page/component is missing or not imported.
// Replace with a real import when the page exists.
const Admin = () => (
  <div className="p-6">
    <h1 className="text-2xl font-semibold">Admin</h1>
    <p className="mt-2 opacity-80">Página em construção.</p>
  </div>
);


// Temporary stub to prevent runtime crash if Certificates page/component is missing or not imported.
// Replace this with a real import when the Certificates page exists.
const Certificates = () => (
  <div className="p-6">
    <h1 className="text-2xl font-semibold">Certificates</h1>
    <p className="mt-2 opacity-80">Página em construção.</p>
  </div>
);


// Temporary stub to prevent runtime crash if Explore page/component is missing or not imported.
// Replace this with a real import when the Explore page exists.
const Explore = () => (
  <div className="p-6">
    <h1 className="text-2xl font-semibold">Explore</h1>
    <p className="mt-2 opacity-80">Página em construção.</p>
  </div>
);


function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/pricing"} component={Pricing} />
      <Route path={"/checkout/success"} component={CheckoutSuccess} />
      <Route path={"/courses"} component={Courses} />
      <Route path={"/courses/:slug"} component={CourseDetail} />
      <ProtectedRoute path={"/lesson/:id"} component={LessonView} />
      <ProtectedRoute path={"/my-courses"} component={MyCourses} />
      <ProtectedRoute path={"/dashboard"} component={AdminDashboard} requireAdmin />
      <ProtectedRoute path={"/admin"} component={AdminDashboard} requireAdmin />
      <ProtectedRoute path={"/admin/users"} component={AdminUsers} requireAdmin />
      <ProtectedRoute path={"/admin/appointments"} component={AdminAppointments} requireAdmin />
      <ProtectedRoute path={"/admin/financeiro"} component={AdminFinanceiro} requireAdmin />
      <ProtectedRoute path={"/admin/programs"} component={AdminPrograms} requireAdmin />
      <ProtectedRoute path={"/admin/courses"} component={AdminCourses} requireAdmin />
      <ProtectedRoute path={"/admin/plans"} component={AdminPlans} requireAdmin />
      <ProtectedRoute path={"/admin/courses/:id/lessons"} component={AdminCourseLessons} requireAdmin />
      <ProtectedRoute path={"/admin/settings"} component={AdminSettings} requireAdmin />
      <ProtectedRoute path={"/admin/lessons"} component={AdminLessons} requireAdmin />
      <ProtectedRoute path={"/admin/students"} component={AdminStudents} requireAdmin />
      <Route path={"/ebooks"} component={Ebooks} />
      <ProtectedRoute path={"/ebook/:id"} component={EbookReader} />
      <ProtectedRoute path={"/certificates"} component={MyCertificates} />
      <Route path={"/about"} component={About} />
      <Route path={"/contact"} component={Contact} />
      <Route path={"/faq"} component={FAQ} />
      <ProtectedRoute path={"/profile"} component={Profile} />
      <ProtectedRoute path={"/community/explore"} component={CommunityExplore} />
      <ProtectedRoute path={"/community/connections"} component={CommunityConnections} />
      <ProtectedRoute path={"/admin/moderation"} component={AdminModeration} requireAdmin />
      <ProtectedRoute path={"/admin/manage-admins"} component={AdminManageAdmins} requireAdmin />
      <ProtectedRoute path={"/admin/account-settings"} component={AdminAccountSettings} requireAdmin />
      <ProtectedRoute path={"/admin/manage-subscriptions"} component={AdminManageSubscriptions} requireAdmin />
      <ProtectedRoute path={"/messages"} component={Messages} />
      <ProtectedRoute path={"/edit-profile"} component={EditProfile} />
      <ProtectedRoute path={"/my-subscription"} component={MySubscription} />
      <ProtectedRoute path={"/dashboard/referrals"} component={UserReferrals} />
      <ProtectedRoute path={"/admin/cashback-requests"} component={AdminCashbackRequests} requireAdmin />
      <ProtectedRoute path={"/admin/management"} component={AdminManagement} requireAdmin />
      <Route path={"/admin/accept-invite"} component={AcceptAdminInvite} />
      <Route path={"/login"} component={Login} />
      <Route path={"/signup"} component={Signup} />
      <Route path={"/verify-email"} component={VerifyEmail} />
      <Route path={"/forgot-password"} component={ForgotPassword} />
      <Route path={"/reset-password"} component={ResetPassword} />
      <Route path={"/terms"} component={Terms} />
      <Route path={"/privacy"} component={Privacy} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      

<Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
          <ShadiaAssistantChat />
          <CookieConsent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
