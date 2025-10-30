import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";

interface Organization {
  org_id: string;
  name: string;
  role: string;
  subscription_plan: string;
}

interface Survey {
  survey_id: string;
  title: string;
  status: "draft" | "active" | "closed";
  is_public: boolean;
  response_count: number;
  completion_rate: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  share_token?: string;
}

interface ComponentCardProps {
  title?: string;
  desc?: string;
  children: React.ReactNode;
}

const API_BASE_URL = "http://localhost:8000/api/v1";

const getAuthToken = () => localStorage.getItem("token") || "";

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getStatusColor = (status: string) => {
  const colors = {
    active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    closed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return colors[status as keyof typeof colors] || colors.draft;
};

function ComponentCard({ title, desc, children }: ComponentCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
      {(title || desc) && (
        <div className="mb-6">
          {title && <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>}
          {desc && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{desc}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

function CreateSurveyModal({ 
  isOpen, 
  onClose, 
  organizations, 
  onSuccess 
}: {
  isOpen: boolean;
  onClose: () => void;
  organizations: Organization[];
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setOrganizationId("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Survey title is required");
      return;
    }

    if (!organizationId) {
      setError("Organization is required");
      return;
    }

    const loadingToast = toast.loading("Creating survey...");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/surveys/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          organization_id: organizationId,
          status: "draft",
          is_public: false,
          allow_anonymous: true,
          collect_email: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.detail || "Failed to create survey");
      }

      const data = await response.json();
      
      toast.success("Survey created successfully!", { id: loadingToast });
      
      resetForm();
      onClose();
      onSuccess();
      
      if (data.survey_id) {
        setTimeout(() => {
          navigate(`/TailAdmin/surveys/${data.survey_id}`);
        }, 500);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(errorMessage, { id: loadingToast });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Create New Survey
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Survey Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter survey title"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter survey description (optional)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Organization *
            </label>
            <select
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSubmitting}
            >
              <option value="">Select Organization</option>
              {organizations.map((org) => (
                <option key={org.org_id} value={org.org_id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ActionMenu({ 
  surveyId, 
  status,
  isPublic,
  shareToken,
  onDelete, 
  onPublish, 
  onClose,
  onDuplicate,
  onTogglePublic
}: {
  surveyId: string;
  status: string;
  isPublic: boolean;
  shareToken?: string;
  onDelete: (id: string) => void;
  onPublish: (id: string) => void;
  onClose: (id: string) => void;
  onDuplicate: (id: string) => void;
  onTogglePublic: (id: string, currentValue: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setIsOpen(false);
    if (isOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [isOpen]);

  const copyShareLink = () => {
    if (shareToken) {
      const link = `${window.location.origin}/TailAdmin/survey/${shareToken}`;
      navigator.clipboard.writeText(link);
      toast.success("Survey link copied to clipboard!");
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="5" r="2" fill="currentColor"/>
          <circle cx="12" cy="12" r="2" fill="currentColor"/>
          <circle cx="12" cy="19" r="2" fill="currentColor"/>
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
          {status === "active" && shareToken && isPublic && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyShareLink();
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg"
            >
              📋 Copy Link
            </button>
          )}
          
          {status === "active" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePublic(surveyId, isPublic);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {isPublic ? "🔒 Make Private" : "🌐 Make Public"}
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(surveyId);
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Duplicate
          </button>
          
          {status === "draft" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPublish(surveyId);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
            >
              📢 Publish
            </button>
          )}
          
          {status === "active" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(surveyId);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Close Survey
            </button>
          )}

          {status === "closed" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPublish(surveyId);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
            >
              🔄 Re-activate
            </button>
          )}
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(surveyId);
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-lg"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function SurveyListPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterOrg, setFilterOrg] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const navigate = useNavigate();

  const fetchOrganizations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/profile/`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.organizations && Array.isArray(data.organizations)) {
          setOrganizations(data.organizations);
        }
      }
    } catch (err) {
      console.error("Error fetching organizations:", err);
    }
  };

  const fetchSurveys = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (filterOrg !== "all") params.append("organization", filterOrg);
      if (searchQuery.trim()) params.append("search", searchQuery);

      const response = await fetch(`${API_BASE_URL}/surveys/?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch surveys");
      }

      const data = await response.json();
      setSurveys(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (surveyId: string) => {
    if (!window.confirm("Are you sure you want to delete this survey? This action cannot be undone.")) return;

    const loadingToast = toast.loading("Deleting survey...");

    try {
      const response = await fetch(`${API_BASE_URL}/surveys/${surveyId}/`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.detail || "Failed to delete survey");
      }

      toast.success("Survey deleted successfully!", { id: loadingToast });
      fetchSurveys();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete survey";
      toast.error(errorMessage, { id: loadingToast });
    }
  };

  const handlePublish = async (surveyId: string) => {
    const loadingToast = toast.loading("Publishing survey...");

    try {
      const response = await fetch(`${API_BASE_URL}/surveys/${surveyId}/publish/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.detail || "Failed to publish survey");
      }

      toast.success("Survey published successfully!", { id: loadingToast });
      fetchSurveys();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to publish survey";
      toast.error(errorMessage, { id: loadingToast });
    }
  };

  const handleCloseSurvey = async (surveyId: string) => {
    if (!window.confirm("Are you sure you want to close this survey? No more responses will be accepted.")) return;

    const loadingToast = toast.loading("Closing survey...");

    try {
      const response = await fetch(`${API_BASE_URL}/surveys/${surveyId}/close/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.detail || "Failed to close survey");
      }

      toast.success("Survey closed successfully!", { id: loadingToast });
      fetchSurveys();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to close survey";
      toast.error(errorMessage, { id: loadingToast });
    }
  };

  const handleDuplicate = async (surveyId: string) => {
    const newTitle = prompt("Enter name for duplicated survey:");
    if (!newTitle || !newTitle.trim()) return;

    const loadingToast = toast.loading("Duplicating survey...");

    try {
      const response = await fetch(`${API_BASE_URL}/surveys/${surveyId}/duplicate/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          include_responses: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.detail || "Failed to duplicate survey");
      }

      toast.success("Survey duplicated successfully!", { id: loadingToast });
      fetchSurveys();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to duplicate survey";
      toast.error(errorMessage, { id: loadingToast });
    }
  };

  const handleTogglePublic = async (surveyId: string, currentValue: boolean) => {
    const loadingToast = toast.loading(currentValue ? "Making private..." : "Making public...");

    try {
      const response = await fetch(`${API_BASE_URL}/surveys/${surveyId}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_public: !currentValue,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.detail || "Failed to update survey");
      }

      toast.success(currentValue ? "Survey is now private!" : "Survey is now public!", { id: loadingToast });
      fetchSurveys();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update survey";
      toast.error(errorMessage, { id: loadingToast });
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    fetchSurveys();
  }, [filterStatus, filterOrg, searchQuery]);

  if (isLoading && surveys.length === 0) {
    return (
      <>
        <Toaster position="top-right" />
        <ComponentCard title="Surveys">
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-gray-500 dark:text-gray-400">Loading surveys...</div>
            </div>
          </div>
        </ComponentCard>
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <div className="space-y-6">
        <ComponentCard 
          title="Surveys" 
          desc="Manage and view all your surveys"
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 whitespace-nowrap"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M9 3.75V14.25M3.75 9H14.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Create Survey
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setFilterStatus("all")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                    filterStatus === "all"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterStatus("active")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                    filterStatus === "active"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setFilterStatus("draft")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                    filterStatus === "draft"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                  }`}
                >
                  Draft
                </button>
                <button
                  onClick={() => setFilterStatus("closed")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                    filterStatus === "closed"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                  }`}
                >
                  Closed
                </button>
              </div>

              {organizations.length > 0 && (
                <select
                  value={filterOrg}
                  onChange={(e) => setFilterOrg(e.target.value)}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Organizations</option>
                  {organizations.map((org) => (
                    <option key={org.org_id} value={org.org_id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </ComponentCard>

        {error && (
          <ComponentCard>
            <div className="p-4 bg-red-100 text-red-700 rounded-lg dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          </ComponentCard>
        )}

        {surveys.length === 0 ? (
          <ComponentCard>
            <div className="flex flex-col items-center justify-center py-12">
              <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-gray-100 dark:bg-gray-800">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-gray-400 dark:text-gray-600"
                >
                  <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5M12 12H15M12 16H15M9 12H9.01M9 16H9.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
                No surveys found
              </h3>
              <p className="mb-4 text-sm text-center text-gray-500 dark:text-gray-400">
                {filterStatus === "all" 
                  ? "Get started by creating your first survey" 
                  : `No ${filterStatus} surveys available`}
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg bg-blue-600 hover:bg-blue-700"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 3.75V14.25M3.75 9H14.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Create Survey
              </button>
            </div>
          </ComponentCard>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {surveys.map((survey) => (
              <ComponentCard key={survey.survey_id}>
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                    <button
                      onClick={() => navigate(`/TailAdmin/surveys/${survey.survey_id}`)}
                      className="block mb-2 text-lg font-semibold text-left text-gray-800 truncate dark:text-white/90 hover:text-blue-600 dark:hover:text-blue-400 transition"
                    >
                      {survey.title}
                    </button>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(survey.status)}`}>
                          {survey.status.charAt(0).toUpperCase() + survey.status.slice(1)}
                        </span>
                        {survey.is_public && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            Public
                          </span>
                        )}
                      </div>
                    </div>
                    <ActionMenu
                      surveyId={survey.survey_id}
                      status={survey.status}
                      isPublic={survey.is_public}
                      shareToken={survey.share_token}
                      onDelete={handleDelete}
                      onPublish={handlePublish}
                      onClose={handleCloseSurvey}
                      onDuplicate={handleDuplicate}
                      onTogglePublic={handleTogglePublic}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <div>
                      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Responses</p>
                      <p className="text-2xl font-semibold text-gray-800 dark:text-white/90">
                        {survey.response_count}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Completion</p>
                      <p className="text-2xl font-semibold text-gray-800 dark:text-white/90">
                        {survey.completion_rate}%
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 space-y-2 text-xs border-t border-gray-200 text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                        <path d="M7 7C8.38071 7 9.5 5.88071 9.5 4.5C9.5 3.11929 8.38071 2 7 2C5.61929 2 4.5 3.11929 4.5 4.5C4.5 5.88071 5.61929 7 7 7Z" stroke="currentColor" strokeWidth="1.3"/>
                        <path d="M12 12C12 10.067 9.76142 8.5 7 8.5C4.23858 8.5 2 10.067 2 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                      <span>{survey.created_by_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                        <path d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z" stroke="currentColor" strokeWidth="1.3"/>
                        <path d="M7 4V7L9 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>{formatDate(survey.updated_at)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={() => navigate(`/TailAdmin/surveys/${survey.survey_id}`)}
                      className="flex items-center justify-center flex-1 gap-2 px-3 py-2 text-sm font-medium text-gray-700 transition bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-800/80"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 8C2 8 4 3 8 3C12 3 14 8 14 8C14 8 12 13 8 13C4 13 2 8 2 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={() => navigate(`/TailAdmin/surveys/${survey.survey_id}/responses`)}
                      className="flex items-center justify-center flex-1 gap-2 px-3 py-2 text-sm font-medium text-white transition rounded-lg bg-blue-600 hover:bg-blue-700"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 11V5C14 3.89543 13.1046 3 12 3H4C2.89543 3 2 3.89543 2 5V11C2 12.1046 2.89543 13 4 13H12C13.1046 13 14 12.1046 14 11Z" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M2 6H14" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                      Responses
                    </button>
                  </div>
                </div>
              </ComponentCard>
            ))}
          </div>
        )}

        <CreateSurveyModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          organizations={organizations}
          onSuccess={fetchSurveys}
        />
      </div>
    </>
  );
}