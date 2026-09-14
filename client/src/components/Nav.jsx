import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link to="/" className="font-display text-lg font-semibold text-forest">
          PERTAPIS Volunteer Connect
        </Link>

        <nav className="flex items-center gap-6 text-sm">
          <Link to="/opportunities" className="hover:text-forest">
            Opportunities
          </Link>

          {user?.role === "volunteer" && (
            <>
              <Link to="/dashboard" className="hover:text-forest">
                My dashboard
              </Link>
              <Link to="/profile" className="hover:text-forest">
                My profile
              </Link>
            </>
          )}
          {user?.role === "coordinator" && (
            <Link to="/coordinator" className="hover:text-forest">
              Coordinator dashboard
            </Link>
          )}

          {user ? (
            <button
              onClick={() => {
                logout();
                navigate("/");
              }}
              className="rounded border border-line px-3 py-1.5 hover:border-forest hover:text-forest"
            >
              Log out
            </button>
          ) : (
            <>
              <Link to="/login" className="hover:text-forest">
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded bg-forest px-3 py-1.5 text-white hover:bg-forest-dark"
              >
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
