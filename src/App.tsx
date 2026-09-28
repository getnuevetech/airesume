import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { SiteContentProvider } from "./content/siteContent";
import { AppProvider } from "./context/AppContext";
import { AdminPage } from "./pages/Admin";
import { BlogPage, BlogPostPage } from "./pages/Blog";
import { ContactPage } from "./pages/Contact";
import { AccountShell } from "./account/Shell";
import { ApplicationsPage, InsightsPage, InterviewPage, JobsPage, OverviewPage, PlanPage, ProfilePage, ResumePage, SettingsPage, TemplatesPage } from "./account/pages";
import { DashboardPage } from "./pages/Dashboard";
import { FeaturesPage } from "./pages/Features";
import { ForgotPasswordPage } from "./pages/ForgotPassword";
import { GetStartedPage } from "./pages/GetStarted";
import { HomePage } from "./pages/Home";
import { HowItWorksPage } from "./pages/HowItWorks";
import { LegalPage, NotFoundPage } from "./pages/Legal";
import { PricingPage } from "./pages/Pricing";
import { PublicResumePage } from "./pages/PublicResume";
import { ResetPasswordPage } from "./pages/ResetPassword";
import { SignInPage } from "./pages/SignIn";
import { StoriesPage } from "./pages/Stories";

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <SiteContentProvider>
        <Routes>
          <Route path="admin" element={<AdminPage />} />
          <Route path="resume/:slug" element={<PublicResumePage />} />
          <Route path="account" element={<AccountShell />}>
            <Route index element={<OverviewPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="resume" element={<ResumePage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="insights" element={<InsightsPage />} />
            <Route path="interview" element={<InterviewPage />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="plan" element={<PlanPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="how-it-works" element={<HowItWorksPage />} />
            <Route path="features" element={<FeaturesPage />} />
            <Route path="stories" element={<StoriesPage />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="blog" element={<BlogPage />} />
            <Route path="blog/:slug" element={<BlogPostPage />} />
            <Route path="signin" element={<SignInPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="get-started" element={<GetStartedPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="privacy" element={<LegalPage kind="privacy" />} />
            <Route path="terms" element={<LegalPage kind="terms" />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
        </SiteContentProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
