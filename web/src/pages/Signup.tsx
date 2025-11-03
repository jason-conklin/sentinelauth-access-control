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
          <input
            id="signup-password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              resetError();
            }}
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
          <p className="text-xs text-text-ink/60">Must be at least {MIN_PASSWORD_LENGTH} characters.</p>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-text-ink/80" htmlFor="signup-confirm">
            Confirm password
          </label>
          <input
            id="signup-confirm"
            type="password"
            className="input"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              resetError();
            }}
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
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
