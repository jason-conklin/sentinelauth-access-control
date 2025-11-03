import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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

const ChangePasswordModal = ({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (newPassword.length < 10) {
      setError("New password must be at least 10 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/auth/password/change", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ??
        err?.response?.data?.message ??
        err?.response?.data ??
        err?.message ??
        "Failed to change password.";
      setError(typeof detail === "string" ? detail : JSON.stringify(detail));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-border-gold/70 bg-white p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-text-ink">Change Password</h3>
        <p className="mt-1 text-sm text-text-ink/70">
          Enter your current password and choose a new one. Passwords must be at least 10 characters.
        </p>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-text-ink/70">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="input"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-text-ink/70">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="input"
              autoComplete="new-password"
              required
              minLength={10}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-text-ink/70">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="input"
              autoComplete="new-password"
              required
              minLength={10}
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-md border border-border-gold bg-white px-3 py-1.5 text-xs font-medium text-text-ink transition hover:bg-brand-200/60"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center rounded-md border border-border-gold bg-brand-300 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Updating…" : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

const Profile = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  useEffect(() => {
    if (!toast) return;
    const handle = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(handle);
  }, [toast]);

  const roles = useMemo(
    () =>
      Array.isArray(profile?.roles) && profile?.roles.length
        ? profile!.roles.join(", ")
        : PLACEHOLDER,
    [profile?.roles]
  );

  if (loading) {
    return <p className="text-sm text-text-ink/70">Loading profile…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!profile) {
    return <p className="text-sm text-text-ink/70">No profile data available.</p>;
  }

  const maskedPassword = "**********";
    "inline-flex items-center rounded-md border border-border-gold bg-brand-300 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60";
    "inline-flex items-center rounded-md border border-border-gold bg-white px-3 py-1.5 text-xs font-medium text-text-ink transition hover:bg-brand-200/60";

  const handleDeleteAccount = async () => {
    if (deleteBusy) return;
    const confirmed = window.confirm(
      "Are you sure you want to delete your account? This action is irreversible."
    );
    if (!confirmed) return;
    setDeleteBusy(true);
    try {
      await apiClient.delete("/auth/me");
      setToast("Account deleted. You will be logged out.");
      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ??
        err?.response?.data ??
        err?.message ??
        "Failed to delete account.";
      setToast(typeof detail === "string" ? detail : JSON.stringify(detail));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-ink">Profile</h2>
        <p className="text-sm text-text-ink/70">Manage your account details.</p>
      </div>
      {toast && (
        <div className="rounded-md border border-border-gold/60 bg-brand-200/40 px-4 py-2 text-sm text-text-ink">
          {toast}
        </div>
      )}
      <div className="rounded-lg border border-border-gold/60 bg-white p-6 shadow-soft">
        <dl className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <dt className="text-xs uppercase text-text-ink/60">Email</dt>
              <dd className="mt-1 break-words text-sm text-text-ink">{profile.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-text-ink/60">Password</dt>
              <dd className="mt-1 flex items-center gap-2 text-sm text-text-ink">
                {maskedPassword}
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(true)}
                  aria-label="Change password"
                  className="inline-flex items-center rounded-full border border-border-gold bg-brand-300/90 p-1 text-text-ink transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path d="M15.58 2.59a1.5 1.5 0 0 1 2.12 2.12l-.83.83-2.12-2.12.83-.83Zm-2.54 2.54-9.01 9.01a2 2 0 0 0-.52.94l-.47 2.35a.5.5 0 0 0 .58.58l2.35-.47a2 2 0 0 0 .94-.52l9.01-9.01-2.12-2.12Z" />
                  </svg>
                </button>
              </dd>
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
        <div className="mt-6 border-t border-border-gold/40 pt-4">
          <button
            type="button"
            onClick={handleDeleteAccount}
            className="inline-flex items-center rounded-md border border-red-400 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={deleteBusy}
          >
            {deleteBusy ? "Deleting…" : "Delete Account"}
          </button>
        </div>
      </div>
      <ChangePasswordModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onSuccess={() => setToast("Password updated successfully.")}
      />
    </div>
  );
};

export default Profile;

