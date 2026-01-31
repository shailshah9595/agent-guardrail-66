import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import ProjectsPage from "./pages/ProjectsPage";
import EnvironmentsPage from "./pages/EnvironmentsPage";
import PoliciesPage from "./pages/PoliciesPage";
import ExecutionsPage from "./pages/ExecutionsPage";
import SDKPage from "./pages/SDKPage";
import QuickstartPage from "./pages/QuickstartPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/quickstart" element={<QuickstartPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/environments" element={<EnvironmentsPage />} />
            <Route path="/policies" element={<PoliciesPage />} />
            <Route path="/executions" element={<ExecutionsPage />} />
            <Route path="/executions/:sessionId" element={<ExecutionsPage />} />
            <Route path="/sdk" element={<SDKPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
