import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { Modal } from "../../components/ui/modal";

const API_BASE_URL = "http://localhost:8000/api/v1";
const getAuthToken = () => localStorage.getItem("token") || "";

interface Webhook {
  webhook_id: string;
  name: string;
  url: string;
  event_types: string[];
  is_active: boolean;
  created_at: string;
  last_triggered: string | null;
}

const EVENT_TYPES = [
  { value: "response.submitted", label: "Response Submitted" },
  { value: "response.updated", label: "Response Updated" },
  { value: "survey.published", label: "Survey Published" },
  { value: "survey.closed", label: "Survey Closed" },
];

export default function WebhookManagementPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    event_types: [] as string[],
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/integrations/webhooks/`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to fetch webhooks");

      const data = await response.json();
      setWebhooks(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load webhooks");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (webhook?: Webhook) => {
    if (webhook) {
      setEditingWebhook(webhook);
      setFormData({
        name: webhook.name,
        url: webhook.url,
        event_types: webhook.event_types,
      });
    } else {
      setEditingWebhook(null);
      setFormData({
        name: "",
        url: "",
        event_types: [],
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveWebhook = async () => {
    if (!formData.name.trim() || !formData.url.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.event_types.length === 0) {
      toast.error("Please select at least one event type");
      return;
    }

    setIsSaving(true);
    const loadingToast = toast.loading(editingWebhook ? "Updating webhook..." : "Creating webhook...");

    try {
      const url = editingWebhook
        ? `${API_BASE_URL}/integrations/webhooks/${editingWebhook.webhook_id}/`
        : `${API_BASE_URL}/integrations/webhooks/`;

      const method = editingWebhook ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save webhook");
      }

      toast.success(
        editingWebhook ? "Webhook updated successfully!" : "Webhook created successfully!",
        { id: loadingToast }
      );
      setIsModalOpen(false);
      fetchWebhooks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save webhook", { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!window.confirm("Are you sure you want to delete this webhook?")) {
      return;
    }

    const loadingToast = toast.loading("Deleting webhook...");

    try {
      const response = await fetch(`${API_BASE_URL}/integrations/webhooks/${webhookId}/`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to delete webhook");

      toast.success("Webhook deleted successfully!", { id: loadingToast });
      fetchWebhooks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete webhook", { id: loadingToast });
    }
  };

  const handleToggleStatus = async (webhookId: string, isActive: boolean) => {
    const loadingToast = toast.loading(`${isActive ? "Disabling" : "Enabling"} webhook...`);

    try {
      const response = await fetch(`${API_BASE_URL}/integrations/webhooks/${webhookId}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_active: !isActive }),
      });

      if (!response.ok) throw new Error("Failed to update webhook status");

      toast.success(`Webhook ${isActive ? "disabled" : "enabled"} successfully!`, { id: loadingToast });
      fetchWebhooks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update webhook status", { id: loadingToast });
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    const loadingToast = toast.loading("Testing webhook...");

    try {
      const response = await fetch(`${API_BASE_URL}/integrations/webhooks/${webhookId}/test/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Webhook test failed");

      toast.success("Webhook test successful!", { id: loadingToast });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Webhook test failed", { id: loadingToast });
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

  const handleEventTypeToggle = (eventType: string) => {
    setFormData((prev) => ({
      ...prev,
      event_types: prev.event_types.includes(eventType)
        ? prev.event_types.filter((e) => e !== eventType)
        : [...prev.event_types, eventType],
    }));
  };

  return (
    <>
      <Toaster position="top-right" />
      <PageMeta title="Webhook Management" description="Manage your webhooks" />
      <PageBreadcrumb pageTitle="Webhook Management" />

      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                Webhooks
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Receive real-time notifications when events occur
              </p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Create Webhook
            </button>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            How Webhooks Work
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Webhooks send HTTP POST requests to your specified URL when events occur. Your endpoint should:
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
            <li>Accept POST requests</li>
            <li>Respond with a 2xx status code</li>
            <li>Process requests quickly (within 5 seconds)</li>
            <li>Verify the webhook signature for security</li>
          </ul>
        </div>

        {/* Webhooks List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : webhooks.length === 0 ? (
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
                d="M13 16H12V12H11M12 8H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              No webhooks yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Create your first webhook to receive real-time notifications
            </p>
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Create Webhook
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {webhooks.map((webhook) => (
              <div
                key={webhook.webhook_id}
                className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {webhook.name}
                      </h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          webhook.is_active
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {webhook.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <code className="text-sm text-gray-600 dark:text-gray-400 block mb-3">
                      {webhook.url}
                    </code>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {webhook.event_types.map((event) => (
                        <span
                          key={event}
                          className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded"
                        >
                          {EVENT_TYPES.find((e) => e.value === event)?.label || event}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      <p>Created: {formatDate(webhook.created_at)}</p>
                      {webhook.last_triggered && (
                        <p>Last triggered: {formatDate(webhook.last_triggered)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTestWebhook(webhook.webhook_id)}
                      className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                    >
                      Test
                    </button>
                    <button
                      onClick={() => handleOpenModal(webhook)}
                      className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleStatus(webhook.webhook_id, webhook.is_active)}
                      className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                    >
                      {webhook.is_active ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => handleDeleteWebhook(webhook.webhook_id)}
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

      {/* Create/Edit Webhook Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="max-w-[600px] m-4"
      >
        <div className="relative w-full max-w-[600px] rounded-3xl bg-white p-6 dark:bg-gray-900 lg:p-8">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {editingWebhook ? "Edit Webhook" : "Create New Webhook"}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Response Notifications"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Webhook URL *
              </label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://your-domain.com/webhook"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Event Types *
              </label>
              <div className="space-y-2">
                {EVENT_TYPES.map((event) => (
                  <label
                    key={event.value}
                    className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <input
                      type="checkbox"
                      checked={formData.event_types.includes(event.value)}
                      onChange={() => handleEventTypeToggle(event.value)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {event.label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {event.value}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveWebhook}
                disabled={isSaving}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : editingWebhook ? "Update Webhook" : "Create Webhook"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}