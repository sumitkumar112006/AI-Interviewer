import { User } from "lucide-react";
import {useAuth} from "./Auth/hooks/useAuth";
import Home from "./Interview/pages/Home";
import { Outlet, useNavigate, Link } from "react-router-dom";
import "./layout.scss";

const Layout = () => {

  const { user, handleLogout } = useAuth();
  const navigate = useNavigate();

  const onlogout = async () => {
      await handleLogout();
      navigate("/login");
};  




  return (
    
    <div className="app-shell pb-5">
      <header className="app-header"> 
        <div className="app-header__bar" >
          <Link className="app-header__profile" to="/profile">{user?.username || "Profile"}</Link>
          <div className="app-header__actions">
            <Link className="app-header__link" to="/">Home</Link>
            <button onClick={onlogout} className='button logout-btn app-header__logout'>Logout</button>
          </div>
        </div>
      </header>


      <main >
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
