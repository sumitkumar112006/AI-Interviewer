import { createBrowserRouter } from "react-router-dom";
import Login from "./features/Auth/pages/Login";
import Register from "./features/Auth/pages/Register";
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

export const router = createBrowserRouter([

    { path: "/login", element: <Login /> },
    { path: "/admin-login-secret", element: <AdminLogin /> },

    { path: "/register", element: <Register /> },
    {
        path: '/logout', element: <Login />
    },
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

    {   path: '/',
        element: <Protected> <Layout /> </Protected>,
        children: [
            { index: true, element: <Home /> },
            { path: "pricing", element: <PricingPage /> },
            { path: "profile", element: <Profile /> },
            { path: "interview/:interviewId", element: <Interview /> },
            { path: "resume/:interviewId", element: <Resume /> },
            { path: "cover-letter/:interviewId", element: <CoverLetter /> },
            { path: "coming-soon", element: <ComingSoon /> },
            { path: "reports", element: <AllReports /> },
            { path: "privacy-policy", element: <PrivacyPolicy /> },
            { path: "terms-of-service", element: <TermsOfService /> },
            { path: "contact-us", element: <ContactUs /> },
            { path: "about-us", element: <AboutUs /> }
        ] 
    },
    

])
