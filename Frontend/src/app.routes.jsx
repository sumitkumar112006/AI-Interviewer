import { createBrowserRouter } from "react-router-dom";
import Login from "./features/Auth/pages/Login";
import Register from "./features/Auth/pages/Register";
import Home from "./features/Auth/pages/Home";


export const router = createBrowserRouter([

    { path: "/login", element: <Login /> },
    
    { path: "/register", element: <Register /> },

    { path:'/', element:<Home />}
    
])