import React, { useState, useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { ArrowRight, Sun, Moon, Sparkles } from 'lucide-react';
import Footer from '../../Footer/components/Footer';
import '../landing.scss';

const PublicLayout = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('kivi_theme') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('kivi_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className={`landing-page-wrapper ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}>
      {/* Top Navbar */}
      <header className="landing-navbar">
        <div className="nav-container">
          <Link to="/" className="nav-brand">
            <img src="/Logo.png" alt="KIVI-AI Logo" className="brand-logo-img" />
            <span className="brand-name">KIVI-AI</span>
            <span className="brand-badge">Interview Intelligence</span>
          </Link>

          <nav>
            <ul className="nav-links">
              <li><Link to="/#features">Features</Link></li>
              <li><Link to="/#workflow">How It Works</Link></li>
              <li><Link to="/pricing">Pricing</Link></li>
              <li><Link to="/about-us">About Us</Link></li>
              <li><Link to="/contact-us">Contact</Link></li>
            </ul>
          </nav>

          <div className="nav-actions">
            <button 
              type="button" 
              className="theme-toggle-btn" 
              onClick={toggleTheme} 
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <Link to="/login" className="btn-nav-login">
              Sign In
            </Link>

            <Link to="/register" className="btn-nav-cta">
              <span>Get Started</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ minHeight: 'calc(100vh - 72px)', paddingTop: '90px', paddingBottom: '40px', paddingLeft: '1.5rem', paddingRight: '1.5rem', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {children || <Outlet />}
      </main>

      {/* Rich Footer */}
      <Footer theme={theme} />
    </div>
  );
};

export default PublicLayout;
