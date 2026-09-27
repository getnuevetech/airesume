import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AppProvider } from "./context/AppContext";
import { BlogPage, BlogPostPage } from "./pages/Blog";
import { ContactPage } from "./pages/Contact";
import { DashboardPage } from "./pages/Dashboard";
import { FeaturesPage } from "./pages/Features";
import { GetStartedPage } from "./pages/GetStarted";
import { HomePage } from "./pages/Home";
import { HowItWorksPage } from "./pages/HowItWorks";
import { LegalPage, NotFoundPage } from "./pages/Legal";
import { PricingPage } from "./pages/Pricing";
import { SignInPage } from "./pages/SignIn";
import { StoriesPage } from "./pages/Stories";

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="how-it-works" element={<HowItWorksPage />} />
            <Route path="features" element={<FeaturesPage />} />
            <Route path="stories" element={<StoriesPage />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="blog" element={<BlogPage />} />
            <Route path="blog/:slug" element={<BlogPostPage />} />
            <Route path="signin" element={<SignInPage />} />
            <Route path="get-started" element={<GetStartedPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="privacy" element={<LegalPage kind="privacy" />} />
            <Route path="terms" element={<LegalPage kind="terms" />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}
