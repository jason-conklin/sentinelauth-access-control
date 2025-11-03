import { FormEvent, useCallback, useState } from "react";
import { apiClient } from "../api/client";

interface SignupProps {
  onAuthSuccess: (tokens: { access_token: string; refresh_token: string }) => void;
  onNavigateLogin: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

const Signup = ({ onAuthSuccess, onNavigateLogin }: SignupProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const resetError = useCallback(() => setError(null), []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetError();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await apiClient.post("/auth/register", {
        email: trimmedEmail,
        password,
      });

      const loginResponse = await apiClient.post("/auth/login", {
        email: trimmedEmail,
        password,
      });

      onAuthSuccess({
        access_token: loginResponse.data.access_token,
        refresh_token: loginResponse.data.refresh_token,
      });
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 422) {
        setError("Please enter a valid email and password.");
      } else if (status === 429) {
        setError("Too many attempts, please try again shortly.");
      } else if (status >= 400 && status < 500) {
        setError(err?.response?.data?.detail ?? "Registration failed. Check your details and try again.");
      } else {
        setError("Server error, please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-16 w-full max-w-lg rounded-lg border border-border-gold bg-white p-6 shadow-soft">
      <h2 className="mb-2 text-xl font-semibold text-text-ink">Create an account</h2>
      <p className="mb-6 text-sm text-text-ink/70">
        Register for SentinelAuth access. After signup you will be logged in automatically.
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="text-sm text-text-ink/80" htmlFor="signup-email">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              resetError();
            }}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-text-ink/80" htmlFor="signup-password">
            Password
          </label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              className="input pr-10"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                resetError();
              }}
              required
              minLength={MIN_PASSWORD_LENGTH}
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
          <p className="text-xs text-text-ink/60">Must be at least {MIN_PASSWORD_LENGTH} characters.</p>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-text-ink/80" htmlFor="signup-confirm">
            Confirm password
          </label>
          <div className="relative">
            <input
              id="signup-confirm"
              type={showConfirmPassword ? "text" : "password"}
              className="input pr-10"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                resetError();
              }}
              required
              minLength={MIN_PASSWORD_LENGTH}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              aria-pressed={showConfirmPassword}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-ink/70 transition-all duration-200 hover:scale-105 hover:text-text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              <span className="relative block h-5 w-5">
                <span
                  className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
                    showConfirmPassword ? "opacity-0 scale-75 rotate-45" : "opacity-100 scale-100 rotate-0"
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
                    showConfirmPassword ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-75 -rotate-45"
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
          {loading ? "Creating account..." : "Sign Up"}
        </button>
      </form>
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={onNavigateLogin}
          className="text-sm font-medium text-text-ink/70 underline-offset-4 transition hover:text-text-ink hover:underline"
        >
          Already have an account? Sign in
        </button>
      </div>
    </div>
  );
};

export default Signup;
