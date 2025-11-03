import { FormEvent, useState } from "react";

interface Props {
  onLogin: (email: string, password: string) => Promise<void>;
  status: string | null;
  allowSignup?: boolean;
  onNavigateSignup?: () => void;
}

const LoginForm = ({ onLogin, status, allowSignup = false, onNavigateSignup }: Props) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await onLogin(email, password);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-24 max-w-md rounded-lg border border-border-gold bg-white p-6 shadow-soft">
      <h2 className="mb-4 text-lg font-semibold text-text-ink">Admin Login</h2>
      {status && <p className="mb-4 text-sm text-red-600">{status}</p>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="text-sm text-text-ink/80">Email</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-text-ink/80">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              className="input pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-ink/70 transition-all duration-200 hover:scale-105 hover:text-text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              <span className="relative block h-5 w-5">
                <span
                  className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
                    showPassword ? "opacity-0 scale-75 rotate-45" : "opacity-100 scale-100 rotate-0"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                  >
                    <path d="M1.5 12s3.5-6 10.5-6 10.5 6 10.5 6-3.5 6-10.5 6S1.5 12 1.5 12Z" />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                </span>
                <span
                  className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
                    showPassword ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-75 -rotate-45"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                  >
                    <path d="M3 3l18 18" />
                    <path d="M9.53 9.53A3 3 0 0114.47 14.47" />
                    <path d="M6.13 6.13C3.92 7.71 2.5 10 2.5 10s3.5 6 10.5 6c1.4 0 2.65-.2 3.76-.54M12 6c3 0 5.5 1.5 7.5 3.5 1 1 2 2.5 2 2.5s-.7 1.21-1.98 2.55" />
                  </svg>
                </span>
              </span>
            </button>
          </div>
        </div>
        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
      {allowSignup && onNavigateSignup && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onNavigateSignup}
            className="text-sm font-medium text-text-ink/70 underline-offset-4 transition hover:text-text-ink hover:underline"
          >
            Create account
          </button>
        </div>
      )}
    </div>
  );
};

export default LoginForm;
