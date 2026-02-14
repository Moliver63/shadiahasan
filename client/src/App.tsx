import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import WhatsAppButton from "./components/WhatsAppButton";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import AdminDashboard from "./pages/AdminDashboard";
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
import Messages from "./pages/Messages";
import EditProfile from "./pages/EditProfile";
import MySubscription from "./pages/MySubscription";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/pricing"} component={Pricing} />
      <Route path={"/courses"} component={Courses} />
      <Route path={"/courses/:slug"} component={CourseDetail} />
      <Route path={"/lesson/:id"} component={LessonView} />
      <Route path={"/my-courses"} component={MyCourses} />
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/admin/courses"} component={AdminCourses} />
      <Route path={"/admin/plans"} component={AdminPlans} />
      <Route path={"/admin/courses/:id/lessons"} component={AdminCourseLessons} />
      <Route path={"/admin/settings"} component={AdminSettings} />
      <Route path={"/admin/lessons"} component={AdminLessons} />
      <Route path={"/admin/students"} component={AdminStudents} />
      <Route path={"/ebooks"} component={Ebooks} />
      <Route path={"/ebook/:id"} component={EbookReader} />
      <Route path={"/certificates"} component={MyCertificates} />
      <Route path={"/about"} component={About} />
      <Route path={"/contact"} component={Contact} />
      <Route path={"/faq"} component={FAQ} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/community/explore"} component={CommunityExplore} />
      <Route path={"/community/connections"} component={CommunityConnections} />
      <Route path={"/admin/moderation"} component={AdminModeration} />
      <Route path={"/messages"} component={Messages} />
      <Route path={"/edit-profile"} component={EditProfile} />
      <Route path={"/my-subscription"} component={MySubscription} />
      <Route path={"/login"} component={Login} />
      <Route path={"/signup"} component={Signup} />
      <Route path={"/verify-email"} component={VerifyEmail} />
      <Route path={"/forgot-password"} component={ForgotPassword} />
      <Route path={"/reset-password"} component={ResetPassword} />
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
          <WhatsAppButton />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
