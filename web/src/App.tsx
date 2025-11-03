import { useEffect, useState } from "react";
import { apiClient, setAuthToken } from "./api/client";
import Dashboard from "./pages/Dashboard";
import UsersPage from "./pages/Users";
import SessionsPage from "./pages/Sessions";
import AuditPage from "./pages/Audit";
import LoginForm from "./components/LoginForm";

type NavItem = "dashboard" | "users" | "sessions" | "audit";

interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

const App = () => {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [view, setView] = useState<NavItem>("dashboard");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (tokens?.access_token) {
      setAuthToken(tokens.access_token);
      fetchMe();
    } else {
      setAuthToken(null);
      setCurrentUser(null);
    }
  }, [tokens?.access_token]);

  const fetchMe = async () => {
    try {
      const res = await apiClient.get("/auth/me");
      setCurrentUser(res.data);
    } catch (err) {
      setStatus("Session expired, please login again.");
      setTokens(null);
    }
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const res = await apiClient.post("/auth/login", { email, password });
      setTokens({
        access_token: res.data.access_token,
        refresh_token: res.data.refresh_token,
      });
      setStatus(null);
      setView("dashboard");
    } catch (err: any) {
      const statusCode = err?.response?.status;
      let message = err?.response?.data?.detail ?? "Login failed";
      if (statusCode === 401) {
        message = "Invalid email or password.";
      } else if (statusCode === 422) {
        message = "Please enter a valid email and password.";
      } else if (statusCode === 429) {
        message = "Too many attempts; please wait and try again.";
      } else if (statusCode >= 500) {
        message = "Server error; try again.";
      }
      setStatus(message);
    }
  };

  const handleLogout = async () => {
    if (!tokens?.refresh_token) {
      setTokens(null);
      return;
    }
    try {
      await apiClient.post("/auth/logout", { refresh_token: tokens.refresh_token });
    } catch (err) {
      // ignore
    } finally {
      setTokens(null);
    }
  };

  const renderView = () => {
    if (!tokens) {
      return <LoginForm onLogin={handleLogin} status={status} />;
    }
    switch (view) {
      case "users":
        return <UsersPage />;
      case "sessions":
        return <SessionsPage />;
      case "audit":
        return <AuditPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold">SentinelAuth Admin</h1>
          {currentUser && <p className="text-sm text-slate-400">Signed in as {currentUser.email}</p>}
        </div>
        {tokens && (
          <nav className="flex gap-4 text-sm">
            <button className={`nav-btn ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}>
              Dashboard
            </button>
            <button className={`nav-btn ${view === "users" ? "active" : ""}`} onClick={() => setView("users")}>
              Users
            </button>
            <button className={`nav-btn ${view === "sessions" ? "active" : ""}`} onClick={() => setView("sessions")}>
              Sessions
            </button>
            <button className={`nav-btn ${view === "audit" ? "active" : ""}`} onClick={() => setView("audit")}>
              Audit
            </button>
            <button className="nav-btn danger" onClick={handleLogout}>
              Logout
            </button>
          </nav>
        )}
      </header>
      <main className="p-6">{renderView()}</main>
    </div>
  );
};

export default App;
