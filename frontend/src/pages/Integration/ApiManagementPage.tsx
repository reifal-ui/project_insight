import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { Modal } from "../../components/ui/modal";

const API_BASE_URL = "http://localhost:8000/api/v1";
const getAuthToken = () => localStorage.getItem("token") || "";

interface ApiKey {
  key_id: string;
  name: string;
  key_preview: string;
  created_at: string;
  last_used: string | null;
  is_active: boolean;
}

export default function ApiManagementPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState("");

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/integrations/api-keys/`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to fetch API keys");

      const data = await response.json();
      setApiKeys(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!keyName.trim()) {
      toast.error("Please enter a name for the API key");
      return;
    }

    setIsCreating(true);
    const loadingToast = toast.loading("Creating API key...");

    try {
      const response = await fetch(`${API_BASE_URL}/integrations/api-keys/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: keyName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create API key");
      }

      const data = await response.json();
      setNewKeyValue(data.api_key);
      toast.success("API key created successfully!", { id: loadingToast });
      fetchApiKeys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create API key", { id: loadingToast });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!window.confirm("Are you sure you want to delete this API key? This action cannot be undone.")) {
      return;
    }

    const loadingToast = toast.loading("Deleting API key...");

    try {
      const response = await fetch(`${API_BASE_URL}/integrations/api-keys/${keyId}/`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to delete API key");

      toast.success("API key deleted successfully!", { id: loadingToast });
      fetchApiKeys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete API key", { id: loadingToast });
    }
  };

  const handleToggleStatus = async (keyId: string, isActive: boolean) => {
    const loadingToast = toast.loading(`${isActive ? "Disabling" : "Enabling"} API key...`);

    try {
      const response = await fetch(`${API_BASE_URL}/integrations/api-keys/${keyId}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_active: !isActive }),
      });

      if (!response.ok) throw new Error("Failed to update API key status");

      toast.success(`API key ${isActive ? "disabled" : "enabled"} successfully!`, { id: loadingToast });
      fetchApiKeys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update API key status", { id: loadingToast });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  return (
    <>
      <Toaster position="top-right" />
      <PageMeta title="API Management" description="Manage your API keys" />
      <PageBreadcrumb pageTitle="API Management" />

      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                API Keys
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage API keys for programmatic access to your surveys
              </p>
            </div>
            <button
              onClick={() => {
                setIsModalOpen(true);
                setKeyName("");
                setNewKeyValue("");
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Create New Key
            </button>
          </div>
        </div>

        {/* API Documentation */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            API Documentation
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Use these endpoints to interact with your surveys programmatically:
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded font-mono text-xs">
                GET
              </span>
              <code className="text-gray-800 dark:text-gray-200">/api/v1/surveys/</code>
              <span className="text-gray-600 dark:text-gray-400">- List all surveys</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded font-mono text-xs">
                POST
              </span>
              <code className="text-gray-800 dark:text-gray-200">/api/v1/surveys/</code>
              <span className="text-gray-600 dark:text-gray-400">- Create new survey</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded font-mono text-xs">
                GET
              </span>
              <code className="text-gray-800 dark:text-gray-200">/api/v1/surveys/&#123;id&#125;/responses/</code>
              <span className="text-gray-600 dark:text-gray-400">- Get responses</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            Include your API key in the Authorization header: <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded">Authorization: Bearer YOUR_API_KEY</code>
          </p>
        </div>

        {/* API Keys List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-12 text-center">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="mx-auto mb-4 text-gray-400"
            >
              <path
                d="M12 15V17M6 21H18C19.1046 21 20 20.1046 20 19V13C20 11.8954 19.1046 11 18 11H6C4.89543 11 4 11.8954 4 13V19C4 20.1046 4.89543 21 6 21ZM16 11V7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7V11H16Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              No API keys yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Create your first API key to start using our API
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Create API Key
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {apiKeys.map((key) => (
              <div
                key={key.key_id}
                className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {key.name}
                      </h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          key.is_active
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {key.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <code className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded">
                        {key.key_preview}
                      </code>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      <p>Created: {formatDate(key.created_at)}</p>
                      {key.last_used && <p>Last used: {formatDate(key.last_used)}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleStatus(key.key_id, key.is_active)}
                      className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                    >
                      {key.is_active ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => handleDeleteKey(key.key_id)}
                      className="px-3 py-1 text-sm font-medium text-red-600 bg-white border border-red-300 rounded hover:bg-red-50 dark:bg-gray-800 dark:border-red-900"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create API Key Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setKeyName("");
          setNewKeyValue("");
        }}
        className="max-w-[500px] m-4"
      >
        <div className="relative w-full max-w-[500px] rounded-3xl bg-white p-6 dark:bg-gray-900 lg:p-8">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {newKeyValue ? "API Key Created" : "Create New API Key"}
          </h3>

          {newKeyValue ? (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-400 font-medium mb-1">
                  ⚠️ Important: Save this key now!
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-500">
                  You won't be able to see this key again. Make sure to copy it to a safe place.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your API Key
                </label>
                <div className="flex gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded text-sm break-all">
                    {newKeyValue}
                  </code>
                  <button
                    onClick={() => copyToClipboard(newKeyValue)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setKeyName("");
                  setNewKeyValue("");
                }}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Key Name
                </label>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g., Production API Key"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateKey}
                  disabled={isCreating}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isCreating ? "Creating..." : "Create Key"}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}