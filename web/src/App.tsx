import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient, setAuthToken } from "./api/client";
import Dashboard from "./pages/Dashboard";
import UsersPage from "./pages/Users";
import SessionsPage from "./pages/Sessions";
import AuditPage from "./pages/Audit";
import LoginForm from "./components/LoginForm";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Signup from "./pages/Signup";
import { allowSelfSignup } from "./lib/flags";
import Profile from "./pages/Profile";
import MySessions from "./pages/MySessions";
import Forbidden from "./pages/Forbidden";

interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

const App = () => {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [route, setRoute] = useState<string>(() => window.location.pathname || "/");

  const allowSignup = allowSelfSignup;

  const navigate = useCallback((path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
    setRoute(path);
  }, []);

  useEffect(() => {
    const handlePopState = () => setRoute(window.location.pathname || "/");
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!allowSignup && route === "/signup") {
      navigate("/login");
    }
  }, [allowSignup, route, navigate]);

  useEffect(() => {
    if (!tokens && route !== "/login" && !(allowSignup && route === "/signup")) {
      navigate("/login");
    }
  }, [tokens, route, allowSignup, navigate]);

  useEffect(() => {
    if (tokens && (route === "/login" || route === "/signup")) {
      navigate("/");
    }
  }, [tokens, route, navigate]);

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

  const handleAuthSuccess = (authTokens: AuthTokens) => {
    setTokens(authTokens);
    setStatus(null);
    navigate("/");
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const res = await apiClient.post("/auth/login", { email, password });
      handleAuthSuccess({
        access_token: res.data.access_token,
        refresh_token: res.data.refresh_token,
      });
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
      navigate("/login");
      return;
    }
    try {
      await apiClient.post("/auth/logout", { refresh_token: tokens.refresh_token });
    } catch (err) {
      // ignore
    } finally {
      setTokens(null);
      navigate("/login");
    }
  };

  const roles: string[] = Array.isArray(currentUser?.roles) ? currentUser.roles : [];
  const isPrivileged = roles.some((role) => role === "admin" || role === "moderator");

  const navItems = useMemo(() => {
    const items = [{ key: "/", label: "Dashboard" }];
    if (isPrivileged) {
      items.push(
        { key: "/users", label: "Users" },
        { key: "/sessions", label: "Sessions" },
        { key: "/audit", label: "Audit" }
      );
    }
    items.push({ key: "/profile", label: "Profile" }, { key: "/my-sessions", label: "My Sessions" });
    return items;
  }, [isPrivileged]);

  const renderView = () => {
    if (!tokens) {
      if (allowSignup && route === "/signup") {
        return (
          <Signup
            onAuthSuccess={handleAuthSuccess}
            onNavigateLogin={() => navigate("/login")}
          />
        );
      }
      return (
        <LoginForm
          onLogin={handleLogin}
          status={status}
          allowSignup={allowSignup}
          onNavigateSignup={allowSignup ? () => navigate("/signup") : undefined}
        />
      );
    }

    const normalizedRoute = route === "/dashboard" ? "/" : route;
    const adminRoutes = ["/users", "/sessions", "/audit"];

    if (!isPrivileged && adminRoutes.includes(normalizedRoute)) {
      return <Forbidden onNavigateProfile={() => navigate("/profile")} />;
    }

    switch (normalizedRoute) {
      case "/":
        return <Dashboard />;
      case "/users":
        return <UsersPage currentUser={currentUser} />;
      case "/sessions":
        return <SessionsPage />;
      case "/audit":
        return <AuditPage />;
      case "/profile":
        return <Profile />;
      case "/my-sessions":
        return <MySessions />;
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
        activeNav={route === "/dashboard" ? "/" : route}
        onNavSelect={(key) => navigate(key)}
        onLogout={handleLogout}
        isAuthenticated={Boolean(tokens)}
      />
      <main className="flex-1 w-full px-6 py-6">
        <div className="mx-auto max-w-6xl">{renderView()}</div>
      </main>
      <Footer />
    </div>
  );
};

export default App;

