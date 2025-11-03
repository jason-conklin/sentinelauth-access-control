import { useEffect, useState } from "react";
import { apiClient } from "../api/client";

interface ProfileData {
  email: string;
  roles: string[];
  created_at?: string;
  last_login_at?: string;
}

const PLACEHOLDER = "\u2014";

const formatDate = (value?: string) => {
  if (!value) return PLACEHOLDER;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleString();
};

const Profile = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get("/auth/me");
        if (!cancelled) {
          setProfile(response.data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.detail ?? "Failed to load profile.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-text-ink/70">Loading profile…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!profile) {
    return <p className="text-sm text-text-ink/70">No profile data available.</p>;
  }

  const roles =
    Array.isArray(profile.roles) && profile.roles.length > 0
      ? profile.roles.join(", ")
      : PLACEHOLDER;
  const maskedPassword = "**********";

  const actionButtonClasses =
    "inline-flex items-center rounded-md border border-border-gold bg-white px-2.5 py-1 text-xs font-medium text-text-ink transition hover:bg-brand-200/60";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-ink">Profile</h2>
        <p className="text-sm text-text-ink/70">Manage your account details.</p>
      </div>
      <div className="rounded-lg border border-border-gold/60 bg-white p-6 shadow-soft">
        <dl className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <dt className="text-xs uppercase text-text-ink/60">Email</dt>
                <button type="button" className={actionButtonClasses}>
                  Edit
                </button>
              </div>
              <dd className="mt-1 text-sm text-text-ink break-words">{profile.email}</dd>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <dt className="text-xs uppercase text-text-ink/60">Password</dt>
                <button type="button" className={actionButtonClasses}>
                  Edit
                </button>
              </div>
              <dd className="mt-1 text-sm text-text-ink">{maskedPassword}</dd>
            </div>
          </div>
          <div>
            <dt className="text-xs uppercase text-text-ink/60">Roles</dt>
            <dd className="mt-1 text-sm text-text-ink">{roles}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-text-ink/60">Created</dt>
            <dd className="mt-1 text-sm text-text-ink">{formatDate(profile.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-text-ink/60">Last Login</dt>
            <dd className="mt-1 text-sm text-text-ink">{formatDate(profile.last_login_at)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
};

export default Profile;

