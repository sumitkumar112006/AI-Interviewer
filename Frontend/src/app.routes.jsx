import React, { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import Login from "./features/Auth/pages/Login";
import Register from "./features/Auth/pages/Register";
import AuthCallback from "./features/Auth/pages/AuthCallback";
import Protected from "./features/Auth/components/Protected";
import Layout from "./features/Layout";
import LandingPage from "./features/Landing/pages/LandingPage";
import RootIndex from "./features/Landing/components/RootIndex";
import AdaptiveRoute from "./features/Landing/components/AdaptiveRoute";
import PageLoading from "./features/Shared/components/PageLoading";
import AdminProtected from "./features/Admin/components/AdminProtected";

// Lazy-loaded App Routes
const Home = lazy(() => import("./features/Interview/pages/Home"));
const Interview = lazy(() => import("./features/Interview/pages/Interview"));
const Profile = lazy(() => import("./features/Profile/Pages/Profile"));
const Resume = lazy(() => import("./features/Interview/pages/Resume"));
const CoverLetter = lazy(() => import("./features/Interview/pages/CoverLetter"));
const ComingSoon = lazy(() => import("./features/Interview/pages/ComingSoon"));
const AllReports = lazy(() => import("./features/Interview/pages/AllReports"));

// Lazy-loaded Footer & Informational Routes
const PrivacyPolicy = lazy(() => import("./features/Footer/pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./features/Footer/pages/TermsOfService"));
const ContactUs = lazy(() => import("./features/Footer/pages/ContactUs"));
const AboutUs = lazy(() => import("./features/Footer/pages/AboutUs"));
const HelpSupport = lazy(() => import("./features/HelpSupport/pages/HelpSupport"));

// Lazy-loaded Admin Portal Routes
const AdminDashboard = lazy(() => import("./features/Admin/pages/AdminDashboard"));
const AdminLogin = lazy(() => import("./features/Admin/pages/AdminLogin"));
const UserEvaluationPage = lazy(() => import("./features/Admin/pages/UserEvaluationPage"));

const withSuspense = (Component) => (
    <Suspense fallback={<PageLoading />}>
        <Component />
    </Suspense>
);

export const router = createBrowserRouter([
    // Core Landing & Auth Routes
    { path: "/", element: <RootIndex /> },
    { path: "/landing", element: <LandingPage /> },
    { path: "/login", element: <Login /> },
    { path: "/register", element: <Register /> },
    { path: "/auth/callback", element: <AuthCallback /> },
    { path: "/logout", element: <Login /> },
    { path: "/admin-login-secret", element: withSuspense(AdminLogin) },

    // Public / Adaptive Informational Routes
    { path: "/pricing", element: <RootIndex /> },
    { path: "/about-us", element: <AdaptiveRoute Component={AboutUs} /> },
    { path: "/contact-us", element: <AdaptiveRoute Component={ContactUs} /> },
    { path: "/help-support", element: <AdaptiveRoute Component={HelpSupport} /> },
    { path: "/privacy-policy", element: <AdaptiveRoute Component={PrivacyPolicy} /> },
    { path: "/terms-of-service", element: <AdaptiveRoute Component={TermsOfService} /> },

    // Admin Protected Portal
    {
        path: "/admin-portal-dashboard-root",
        element: (
            <AdminProtected>
                <Suspense fallback={<PageLoading title="Loading Admin Console..." subtitle="Synchronizing administrative privileges and workspace telemetry..." />}>
                    <AdminDashboard />
                </Suspense>
            </AdminProtected>
        )
    },
    {
        path: "/admin-portal-dashboard-root/user-evaluation/:userId",
        element: (
            <AdminProtected>
                <Suspense fallback={<PageLoading title="Loading User Evaluation..." />}>
                    <UserEvaluationPage />
                </Suspense>
            </AdminProtected>
        )
    },

    // User Protected App Shell Routes
    {
        path: "/",
        element: <Protected><Layout /></Protected>,
        children: [
            { path: "dashboard", element: withSuspense(Home) },
            { path: "profile", element: withSuspense(Profile) },
            { path: "interview/:interviewId", element: withSuspense(Interview) },
            { path: "resume/:interviewId", element: withSuspense(Resume) },
            { path: "cover-letter/:interviewId", element: withSuspense(CoverLetter) },
            { path: "coming-soon", element: withSuspense(ComingSoon) },
            { path: "reports", element: withSuspense(AllReports) }
        ]
    }
]);
