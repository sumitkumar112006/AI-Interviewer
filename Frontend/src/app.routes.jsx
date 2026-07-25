import { createBrowserRouter } from "react-router-dom";
import Login from "./features/Auth/pages/Login";
import Register from "./features/Auth/pages/Register";
import Protected from "./features/Auth/components/Protected";
import Home from "./features/Interview/pages/Home";
import Interview from "./features/Interview/pages/Interview";
import Profile from "./features/Profile/Pages/Profile";
import Resume from "./features/Interview/pages/Resume";
import ComingSoon from "./features/Interview/pages/ComingSoon";
import Layout from "./features/Layout";


export const router = createBrowserRouter([

    { path: "/login", element: <Login /> },

    { path: "/register", element: <Register /> },
    {
        path: '/logout', element: <Login />
    },

    {   path: '/',
        element: <Protected> <Layout /> </Protected>,
        children: [
            { index: true, element: <Home /> },
            { path: "profile", element: <Profile /> },
            { path: "interview/:interviewId", element: <Interview /> },
            { path: "resume/:interviewId", element: <Resume /> },
            { path: "coming-soon", element: <ComingSoon /> }
        ] 
    },
    

])
