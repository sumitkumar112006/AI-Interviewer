import { createBrowserRouter } from "react-router-dom";
import Login from "./features/Auth/pages/Login";
import Register from "./features/Auth/pages/Register";
import Home from "./features/Auth/pages/Home";
import Protected from "./features/Auth/components/Protected";


export const router = createBrowserRouter([

    { path: "/login", element: <Login /> },
    
    { path: "/register", element: <Register /> },

    { path: '/', element: <Protected> <Home /> </Protected>}
    
])