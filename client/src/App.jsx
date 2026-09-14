import { Routes, Route } from "react-router-dom";
import Nav from "./components/Nav";
import RequireRole from "./components/RequireRole";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Opportunities from "./pages/Opportunities";
import OpportunityDetail from "./pages/OpportunityDetail";
import VolunteerDashboard from "./pages/VolunteerDashboard";
import VolunteerProfile from "./pages/VolunteerProfile";
import CoordinatorDashboard from "./pages/CoordinatorDashboard";
import CreateOpportunity from "./pages/CreateOpportunity";

export default function App() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <Nav />
      <main>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/opportunities" element={<Opportunities />} />
            <Route path="/opportunities/:id" element={<OpportunityDetail />} />
            <Route
              path="/dashboard"
              element={
                <RequireRole role="volunteer">
                  <VolunteerDashboard />
                </RequireRole>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireRole role="volunteer">
                  <VolunteerProfile />
                </RequireRole>
              }
            />
            <Route
              path="/coordinator"
              element={
                <RequireRole role="coordinator">
                  <CoordinatorDashboard />
                </RequireRole>
              }
            />
            <Route
              path="/coordinator/new"
              element={
                <RequireRole role="coordinator">
                  <CreateOpportunity />
                </RequireRole>
              }
            />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}
