import { useEffect, useMemo, useState } from "react";
import { apiClient, setAuthToken } from "./api/client";
import Dashboard from "./pages/Dashboard";
import UsersPage from "./pages/Users";
import SessionsPage from "./pages/Sessions";
import AuditPage from "./pages/Audit";
import LoginForm from "./components/LoginForm";
import Header from "./components/Header";

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

  const navItems = useMemo(
    () => [
      { key: "dashboard" as NavItem, label: "Dashboard" },
      { key: "users" as NavItem, label: "Users" },
      { key: "sessions" as NavItem, label: "Sessions" },
      { key: "audit" as NavItem, label: "Audit" },
    ],
    []
  );

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

  const roleLabel =
    Array.isArray(currentUser?.roles) && currentUser.roles.length > 0
      ? currentUser.roles[0]?.charAt(0).toUpperCase() + currentUser.roles[0]?.slice(1)
      : null;

  return (
    <div className="min-h-full bg-bg-base text-text-ink flex flex-col">
      <Header
        roleLabel={roleLabel}
        currentUserEmail={currentUser?.email ?? null}
        navItems={navItems}
        activeNav={view}
        onNavSelect={(key) => setView(key as NavItem)}
        onLogout={handleLogout}
        isAuthenticated={Boolean(tokens)}
      />
      <main className="flex-1 w-full px-6 py-6">
        <div className="mx-auto max-w-6xl">{renderView()}</div>
      </main>
    </div>
  );
};

export default App;
