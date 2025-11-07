import { useState, useEffect } from "react";
import { Search, Edit, Trash2, UserPlus, Crown, Shield, User, X, AlertCircle, CheckCircle } from "lucide-react";

const API_BASE_URL = "http://localhost:8000/api/v1";

interface TeamMember {
  user: string;
  user_email: string;
  user_name: string;
  role: string;
  joined_at: string;
}

interface Organization {
  org_id: number;
  name: string;
  subscription_plan: string;
  member_count: number;
  role?: string;
}

export default function TeamsPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganization();
  }, []);

  useEffect(() => {
    if (organization) {
      fetchTeamMembers();
    }
  }, [organization]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const fetchOrganization = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/profile/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to fetch profile");

      const data = await response.json();
      if (data.organizations && data.organizations.length > 0) {
        setOrganization(data.organizations[0]);
      }
    } catch (err) {
      setError("Failed to load organization data");
      console.error(err);
    }
  };

  const fetchTeamMembers = async () => {
    if (!organization) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem("token");
      
      const response = await fetch(
        `${API_BASE_URL}/organizations/${organization.org_id}/members/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "Failed to fetch team members");
      }

      const data = await response.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch members error:', err);
      setError(err instanceof Error ? err.message : "Failed to load team members");
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      setError("Please enter an email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    if (!organization) {
      setError("No organization selected");
      return;
    }

    setIsInviting(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE_URL}/organizations/${organization.org_id}/invite/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: inviteEmail.trim().toLowerCase(),
            role: inviteRole,
          }),
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || responseData.message || "Failed to send invitation");
      }

      setSuccess(responseData.message || "Invitation sent successfully!");
      setShowInviteModal(false);
      setInviteEmail("");
      setInviteRole("member");
      
      await fetchOrganization();
      await fetchTeamMembers();
    } catch (err) {
      console.error('Invite error:', err);
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this member from the team?")) return;

    if (!organization) return;

    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE_URL}/organizations/${organization.org_id}/members/${userId}/remove/`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to remove member");
      }

      setSuccess("Member removed successfully");
      await fetchOrganization();
      await fetchTeamMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    if (!organization) return;

    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE_URL}/organizations/${organization.org_id}/members/${userId}/`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: newRole }),
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to update role");
      }

      setSuccess("Role updated successfully");
      setShowEditModal(false);
      setEditingMember(null);
      fetchTeamMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getRoleBadge = (role: string) => {
    const badges: Record<string, { icon: any; color: string }> = {
      owner: {
        icon: Crown,
        color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      },
      admin: {
        icon: Shield,
        color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      },
      member: {
        icon: User,
        color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      },
      viewer: {
        icon: User,
        color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
      },
    };

    const badge = badges[role] || badges.member;
    const Icon = badge.icon;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}
      >
        <Icon className="w-3 h-3" />
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0][0] + parts[1][0];
    }
    return name.substring(0, 2);
  };

  const getTeamLimit = () => {
    if (!organization) return 1;
    const limits: Record<string, number> = {
      starter: 1,
      pro: 10,
      enterprise: 50
    };
    return limits[organization.subscription_plan] || 1;
  };

  const canInviteMore = () => {
    if (!organization) return false;
    return organization.member_count < getTeamLimit();
  };

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.user_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || member.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const canManageMembers = organization?.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Team Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Manage your team members and permissions</p>
        </div>

        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-green-800 dark:text-green-200 text-sm">{success}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        {organization && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                  {organization.name}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {organization.member_count} / {getTeamLimit()} members · {organization.subscription_plan} plan
                </p>
              </div>
              {canManageMembers && (
                <button
                  onClick={() => canInviteMore() ? setShowInviteModal(true) : setError(`Team limit reached (${getTeamLimit()} members). Upgrade your plan to add more.`)}
                  disabled={!canInviteMore()}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors ${
                    canInviteMore() 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  Invite Member {!canInviteMore() && '(Limit Reached)'}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-lg border border-gray-300 bg-transparent text-sm dark:border-gray-700 dark:text-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-11 rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                No members found
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {searchTerm || roleFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Invite members to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.02]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">
                      Member
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">
                      Joined
                    </th>
                    {canManageMembers && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {filteredMembers.map((member) => (
                    <tr
                      key={member.user}
                      className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold text-sm">
                            {getInitials(member.user_name)}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-800 dark:text-white">
                              {member.user_name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {member.user_email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">{getRoleBadge(member.role)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(member.joined_at)}
                      </td>
                      {canManageMembers && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingMember(member);
                                setShowEditModal(true);
                              }}
                              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors"
                              title="Edit role"
                            >
                              <Edit className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            </button>
                            <button
                              onClick={() => handleRemoveMember(member.user)}
                              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors"
                              title="Remove member"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-gray-900 p-6 shadow-xl">
            <button
              onClick={() => {
                setShowInviteModal(false);
                setInviteEmail("");
                setInviteRole("member");
              }}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Invite Team Member
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="member@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleInviteMember()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Role *
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="member">Member - Can create and manage surveys</option>
                  <option value="admin">Admin - Full access to manage team and settings</option>
                  <option value="viewer">Viewer - Can only view surveys and responses</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail("");
                    setInviteRole("member");
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInviteMember}
                  disabled={isInviting}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isInviting ? "Sending..." : "Send Invitation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingMember && showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-gray-900 p-6 shadow-xl">
            <button
              onClick={() => {
                setShowEditModal(false);
                setEditingMember(null);
              }}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Edit Member Role
            </h3>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Member: {editingMember.user_name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {editingMember.user_email}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Role
                </label>
                <select
                  defaultValue={editingMember.role}
                  onChange={(e) =>
                    handleChangeRole(editingMember.user, e.target.value)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}