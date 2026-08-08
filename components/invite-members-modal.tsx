"use client";

import { useState } from "react";

// ============================================================================
// INVITE MEMBERS MODAL
// ============================================================================
// Modal for inviting new members to the organization
// ============================================================================

interface InviteMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface InviteForm {
  email: string;
  role: string;
}

const ROLES = [
  {
    id: "admin",
    name: "Administrator",
    description: "Full access to all features and settings",
    permissions: ["All permissions"],
  },
  {
    id: "manager",
    name: "Manager",
    description: "Manage members, events, and finances",
    permissions: ["Members", "Events", "Finance", "Reports"],
  },
  {
    id: "leader",
    name: "Leader",
    description: "Manage groups and basic operations",
    permissions: ["Groups", "Attendance", "Basic member info"],
  },
  {
    id: "member",
    name: "Member",
    description: "Basic member access",
    permissions: ["View own info", "Register for events"],
  },
  {
    id: "viewer",
    name: "Viewer",
    description: "Read-only access",
    permissions: ["View only"],
  },
];

export default function InviteMembersModal({
  isOpen,
  onClose,
  onSuccess,
}: InviteMembersModalProps) {
  const [invites, setInvites] = useState<InviteForm[]>([
    { email: "", role: "member" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const addInvite = () => {
    setInvites((prev) => [...prev, { email: "", role: "member" }]);
  };

  const removeInvite = (index: number) => {
    setInvites((prev) => prev.filter((_, i) => i !== index));
  };

  const updateInvite = (index: number, partial: Partial<InviteForm>) => {
    setInvites((prev) =>
      prev.map((inv, i) => (i === index ? { ...inv, ...partial } : inv))
    );
  };

  const canSubmit = invites.some((inv) => inv.email.includes("@"));

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const validInvites = invites.filter((inv) => inv.email.includes("@"));

      // Send each invitation
      const results = await Promise.allSettled(
        validInvites.map((invite) =>
          fetch("/api/platform/invitations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(invite),
          }).then((res) => res.json())
        )
      );

      const failures = results.filter(
        (r) => r.status === "rejected" || (r.status === "fulfilled" && r.value.error)
      );

      if (failures.length === validInvites.length) {
        throw new Error("All invitations failed");
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitations");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative mx-4 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Invite Team Members
            </h2>
            <p className="text-sm text-gray-500">
              Send invitations to collaborate
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {success ? (
            <div className="flex flex-col items-center py-8">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Invitations Sent!
              </h3>
              <p className="mt-2 text-center text-sm text-gray-500">
                Team members will receive an email with instructions to join
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {invites.map((invite, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={invite.email}
                        onChange={(e) =>
                          updateInvite(index, { email: e.target.value })
                        }
                        placeholder="colleague@example.com"
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Role
                      </label>
                      <select
                        value={invite.role}
                        onChange={(e) =>
                          updateInvite(index, { role: e.target.value })
                        }
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                      >
                        {ROLES.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        {ROLES.find((r) => r.id === invite.role)?.description}
                      </p>
                    </div>
                  </div>
                  {invites.length > 1 && (
                    <button
                      onClick={() => removeInvite(index)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}

              {/* Add more button */}
              {invites.length < 10 && (
                <button
                  onClick={addInvite}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-600 hover:border-indigo-400 hover:text-indigo-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add another person
                </button>
              )}

              {/* Role permissions info */}
              <div className="rounded-lg bg-gray-50 p-4">
                <h4 className="mb-2 text-sm font-medium text-gray-900">
                  Role Permissions
                </h4>
                <div className="space-y-2">
                  {ROLES.map((role) => (
                    <div key={role.id} className="flex items-start gap-2">
                      <span className="text-xs font-medium text-gray-600 w-20">
                        {role.name}:
                      </span>
                      <span className="text-xs text-gray-500">
                        {role.permissions.join(", ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Sending..." : "Send Invitations"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
