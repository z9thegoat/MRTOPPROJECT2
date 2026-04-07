import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import "./Navbar.css";
import axios from "axios";
import { useEffect } from "react";

const NAV_LINKS = [
  { to: "/home", label: "Home" },
  { to: "/dashboard", label: "Users" },
  { to: "/pdashboard", label: "Packets" },
  { to: "/History", label: "History" },

];

function LogoutIcon() {
  return (
    <svg
      className="navbar__logout-icon"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M10.5 11L13.5 8l-3-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 8H6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isLogin = localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const goToLogin = () => navigate("/login");
  const goToReg = () => navigate("/register");

  return (
    <nav className="navbar">
      <div className="navbar__logo">
        <Link to="/home">
          <span className="navbar__logo-dot" />
        </Link>
      </div>

      <ul className="navbar__links">
        {NAV_LINKS.map(({ to, label }) => (
          <li key={to}>
            <Link to={to} className={location.pathname === to ? "active" : ""}>
              {label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="navbar__right">
        {!isLogin ? (
          <>
            <button className="navbar__logout" onClick={goToLogin}>
              Login
            </button>
            <button className="navbar__logout" onClick={goToReg}>
              Register
            </button>
          </>
        ) : (
          <button className="navbar__logout" onClick={handleLogout}>
            <LogoutIcon />
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}

export default NavBar;
