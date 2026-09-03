import { createBrowserRouter } from "react-router-dom";
import Login from "./features/Auth/pages/Login";
import Register from "./features/Auth/pages/Register";
import AuthCallback from "./features/Auth/pages/AuthCallback";
import Protected from "./features/Auth/components/Protected";
import Home from "./features/Interview/pages/Home";
import Interview from "./features/Interview/pages/Interview";
import Profile from "./features/Profile/Pages/Profile";
import Resume from "./features/Interview/pages/Resume";
import CoverLetter from "./features/Interview/pages/CoverLetter";
import ComingSoon from "./features/Interview/pages/ComingSoon";
import AllReports from "./features/Interview/pages/AllReports";
import Layout from "./features/Layout";
import PrivacyPolicy from "./features/Footer/pages/PrivacyPolicy";
import TermsOfService from "./features/Footer/pages/TermsOfService";
import ContactUs from "./features/Footer/pages/ContactUs";
import AboutUs from "./features/Footer/pages/AboutUs";
import AdminProtected from "./features/Admin/components/AdminProtected";
import AdminDashboard from "./features/Admin/pages/AdminDashboard";
import AdminLogin from "./features/Admin/pages/AdminLogin";
import UserEvaluationPage from "./features/Admin/pages/UserEvaluationPage";
import PricingPage from "./features/Subscription/pages/PricingPage";
import LandingPage from "./features/Landing/pages/LandingPage";
import RootIndex from "./features/Landing/components/RootIndex";
import AdaptiveRoute from "./features/Landing/components/AdaptiveRoute";

export const router = createBrowserRouter([
    // Core Landing & Auth Routes
    { path: "/", element: <RootIndex /> },
    { path: "/landing", element: <LandingPage /> },
    { path: "/login", element: <Login /> },
    { path: "/register", element: <Register /> },
    { path: "/auth/callback", element: <AuthCallback /> },
    { path: "/logout", element: <Login /> },
    { path: "/admin-login-secret", element: <AdminLogin /> },

    // Public / Adaptive Informational & Pricing Routes
    { path: "/pricing", element: <AdaptiveRoute Component={PricingPage} /> },
    { path: "/about-us", element: <AdaptiveRoute Component={AboutUs} /> },
    { path: "/contact-us", element: <AdaptiveRoute Component={ContactUs} /> },
    { path: "/privacy-policy", element: <AdaptiveRoute Component={PrivacyPolicy} /> },
    { path: "/terms-of-service", element: <AdaptiveRoute Component={TermsOfService} /> },

    // Admin Protected Portal
    {
        path: "/admin-portal-dashboard-root",
        element: (
            <Protected>
                <AdminProtected>
                    <AdminDashboard />
                </AdminProtected>
            </Protected>
        )
    },
    {
        path: "/admin-portal-dashboard-root/user-evaluation/:userId",
        element: (
            <Protected>
                <AdminProtected>
                    <UserEvaluationPage />
                </AdminProtected>
            </Protected>
        )
    },

    // User Protected App Shell Routes
    {
        path: "/",
        element: <Protected><Layout /></Protected>,
        children: [
            { path: "dashboard", element: <Home /> },
            { path: "profile", element: <Profile /> },
            { path: "interview/:interviewId", element: <Interview /> },
            { path: "resume/:interviewId", element: <Resume /> },
            { path: "cover-letter/:interviewId", element: <CoverLetter /> },
            { path: "coming-soon", element: <ComingSoon /> },
            { path: "reports", element: <AllReports /> }
        ]
    }
]);
