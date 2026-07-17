import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "../styles/Navbar.css";

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");

  const currentUser = JSON.parse(
    localStorage.getItem("currentUser")
  );

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/");
  };

  const openAdminModal = () => {
    setAdminError("");
    setAdminPassword("");
    setIsAdminModalOpen(true);
  };

  const closeAdminModal = () => {
    setAdminError("");
    setAdminPassword("");
    setIsAdminModalOpen(false);
  };

  const handleAdminSubmit = (event) => {
    event.preventDefault();
    const trimmed = adminPassword.trim();
    if (!trimmed) {
      setAdminError("אנא הזן סיסמה");
      return;
    }
    if (trimmed !== "segel") {
      setAdminError("הסיסמה שגויה");
      return;
    }
    localStorage.setItem("adminAuth", "true");
    closeAdminModal();
    navigate("/admin");
  };

  return (
    <>
      <nav className="navbar">

        <div className="navbar-logo">
          🚑 MDA Adumim
        </div>

        <div className="navbar-links">

          <Link
            className={
              location.pathname === "/home"
                ? "active-link"
                : ""
            }
            to="/home"
          >
            בית
          </Link>

          <Link
            className={
              location.pathname === "/availability"
                ? "active-link"
                : ""
            }
            to="/availability"
          >
            שיבוץ
          </Link>

          <Link
            className={
              location.pathname === "/schedule"
                ? "active-link"
                : ""
            }
            to="/schedule"
          >
            משמרות
          </Link>

          <button
            className="admin-open-btn"
            onClick={openAdminModal}
          >
            אחראי שיבוץ
          </button>

          {currentUser?.role === "אחראי שיבוץ" && (
            <Link
              className={
                location.pathname === "/admin"
                  ? "active-link"
                  : ""
              }
              to="/admin"
            >
              ניהול
            </Link>
          )}

        </div>

        <button
          className="logout-btn"
          onClick={handleLogout}
        >
          התנתק
        </button>

      </nav>

      {isAdminModalOpen && (
        <div
          className="admin-modal-backdrop"
          onClick={closeAdminModal}
        >
          <div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="admin-modal-close"
              onClick={closeAdminModal}
            >
              ✕
            </button>
            <h2>כניסת אחראי שיבוץ</h2>
            <p>הזן את סיסמת אחראי השיבוץ כדי להמשיך.</p>
            <form
              onSubmit={handleAdminSubmit}
              className="admin-modal-form"
            >
              <input
                type="password"
                placeholder="סיסמה"
                dir="auto"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
              />
              {adminError && (
                <p className="admin-modal-error">
                  {adminError}
                </p>
              )}
              <button
                type="submit"
                className="admin-modal-submit"
              >
                היכנס
              </button>
            </form>
          
          </div>
        </div>
      )}
    </>
  );
}

export default Navbar;