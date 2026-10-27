import { Toaster } from "@/components/ui/sonner";
import RetomarCompraTeste from "./components/RetomarCompraTeste";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ShadiaAssistantChat } from "./components/ShadiaAssistantChat";
import CookieConsent from "./components/CookieConsent";
import Analytics from "./components/Analytics";
import { ThemeProvider } from "./contexts/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminAppointments = lazy(() => import("./pages/AdminAppointments"));
const AdminFinanceiro = lazy(() => import("./pages/AdminFinanceiro"));
const AdminPrograms = lazy(() => import("./pages/AdminPrograms"));
const AdminCourses = lazy(() => import("./pages/AdminCourses"));
const AdminPlans = lazy(() => import("./pages/AdminPlans"));
const AdminTestimonials = lazy(() => import("./pages/AdminTestimonials"));
const AdminCourseLessons = lazy(() => import("./pages/AdminCourseLessons"));
const AdminLessonMaterials = lazy(() => import("./pages/AdminLessonMaterials"));
const AdminCourseGroups = lazy(() => import("./pages/AdminCourseGroups"));
const AdminCollections = lazy(() => import("./pages/AdminCollections"));
const CollectionDetail = lazy(() => import("./pages/CollectionDetail"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const AdminLessons = lazy(() => import("./pages/AdminLessons"));
const AdminStudents = lazy(() => import("./pages/AdminStudents"));
const Courses = lazy(() => import("./pages/Courses"));
const CourseDetail = lazy(() => import("./pages/CourseDetail"));
const LessonView = lazy(() => import("./pages/LessonView"));
const MyCourses = lazy(() => import("./pages/MyCourses"));
const Pricing = lazy(() => import("./pages/Pricing"));
const CheckoutSuccess = lazy(() => import("./pages/CheckoutSuccess"));
const CompraAguardando = lazy(() => import("./pages/CompraAguardando"));
const Ebooks = lazy(() => import("./pages/Ebooks"));
const EbookReader = lazy(() => import("./pages/EbookReader"));
const MyCertificates = lazy(() => import("./pages/MyCertificates"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Profile = lazy(() => import("./pages/Profile"));
const CommunityExplore = lazy(() => import("./pages/CommunityExplore"));
const CommunityConnections = lazy(() => import("./pages/CommunityConnections"));
const AdminModeration = lazy(() => import("./pages/AdminModeration"));
const AdminManageAdmins = lazy(() => import("./pages/AdminManageAdmins"));
const AdminAccountSettings = lazy(() => import("./pages/AdminAccountSettings"));
const AdminManageSubscriptions = lazy(() => import("./pages/AdminManageSubscriptions"));
const Messages = lazy(() => import("./pages/Messages"));
const EditProfile = lazy(() => import("./pages/EditProfile"));
const MySubscription = lazy(() => import("./pages/MySubscription"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const UserReferrals = lazy(() => import("./pages/UserReferrals"));
const AdminCashbackRequests = lazy(() => import("./pages/AdminCashbackRequests"));
const AdminManagement = lazy(() => import("./pages/admin/AdminManagement"));
const AcceptAdminInvite = lazy(() => import("./pages/AcceptAdminInvite"));

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


/**
 * Tela neutra enquanto o pedaco de codigo da rota chega.
 *
 * De proposito sem texto, logo ou cor nova: a identidade visual nao muda, e
 * uma mensagem de "carregando" piscando entre paginas seria uma regressao
 * visual. Fundo herdado do tema, so pra nao haver salto de cor.
 */
function RotaCarregando() {
  return <div className="min-h-screen bg-background" aria-busy="true" />;
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  //
  // Paginas carregadas sob demanda (24/10). Eram 52 importadas de uma vez,
  // incluindo ~20 telas de admin, entao quem chegava pelo anuncio baixava o
  // painel administrativo inteiro antes de ver a home. `Home` e `NotFound`
  // ficam no pedaco inicial: a primeira e o destino do anuncio, a segunda e o
  // fallback e nao pode depender de outro download.
  return (
    <Suspense fallback={<RotaCarregando />}>
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/pricing"} component={Pricing} />
      <Route path={"/checkout/success"} component={CheckoutSuccess} />
      <Route path={"/compra/aguardando"} component={CompraAguardando} />
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
      <ProtectedRoute path={"/admin/testimonials"} component={AdminTestimonials} requireAdmin />
      <ProtectedRoute path={"/admin/courses/:id/lessons"} component={AdminCourseLessons} requireAdmin />
      <ProtectedRoute path={"/admin/analytics"} component={AdminAnalytics} requireAdmin />
      <ProtectedRoute path={"/admin/settings"} component={AdminSettings} requireAdmin />
      <ProtectedRoute path={"/admin/lessons"} component={AdminLessons} requireAdmin />
      <ProtectedRoute path={"/admin/lessons/:id/materials"} component={AdminLessonMaterials} requireAdmin />
      <ProtectedRoute path={"/admin/courses/:id/groups"} component={AdminCourseGroups} requireAdmin />
      <ProtectedRoute path={"/admin/collections"} component={AdminCollections} requireAdmin />
      <Route path="/collections/:id" component={CollectionDetail} />
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
    </Suspense>
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
        switchable
      >
        <TooltipProvider>
          <Analytics />
          <Toaster />
          <Router />
          <RetomarCompraTeste />
          <ShadiaAssistantChat />
          <CookieConsent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
