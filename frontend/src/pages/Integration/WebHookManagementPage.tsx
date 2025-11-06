import { useState, useEffect } from "react";
import { Search, Plus, Trash2, Power, PowerOff, AlertCircle, CheckCircle, Copy, Activity, Clock, XCircle, CheckCircle2, Zap, X, Link as LinkIcon } from "lucide-react";

const API_BASE_URL = "http://localhost:8000/api/v1";
const getAuthToken = () => localStorage.getItem("token") || "";

interface Webhook {
  webhook_id: string;
  url: string;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  failure_count: number;
  created_at: string;
}

interface WebhookDelivery {
  delivery_id: number;
  event_type: string;
  status: string;
  status_code: number | null;
  created_at: string;
  delivered_at: string | null;
  retry_count: number;
  error_message: string;
}

interface Organization {
  org_id: number;
  name: string;
  subscription_plan: string;
  role?: string;
}

const AVAILABLE_EVENTS = [
  { value: 'response.new', label: 'New Survey Response', description: 'Triggered when a new response is submitted' },
  { value: 'survey.published', label: 'Survey Published', description: 'Triggered when a survey is published' },
  { value: 'survey.closed', label: 'Survey Closed', description: 'Triggered when a survey is closed' },
  { value: 'contact.created', label: 'Contact Created', description: 'Triggered when a new contact is added' },
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeliveriesModal, setShowDeliveriesModal] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [isLoadingDeliveries, setIsLoadingDeliveries] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>(['response.new']);

  useEffect(() => {
    fetchOrganization();
  }, []);

  useEffect(() => {
    if (organization) {
      fetchWebhooks();
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
      const token = getAuthToken();
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

  const fetchWebhooks = async () => {
    try {
      setIsLoading(true);
      const token = getAuthToken();
      
      const response = await fetch(`${API_BASE_URL}/webhooks/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch webhooks");
      }

      const data = await response.json();
      setWebhooks(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error('Fetch webhooks error:', err);
      setError(err instanceof Error ? err.message : "Failed to load webhooks");
      setWebhooks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDeliveries = async (webhookId: string) => {
    try {
      setIsLoadingDeliveries(true);
      const token = getAuthToken();
      
      const response = await fetch(
        `${API_BASE_URL}/webhooks/${webhookId}/deliveries/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch deliveries");

      const data = await response.json();
      setDeliveries(data.data || data || []);
    } catch (err) {
      console.error('Fetch deliveries error:', err);
      setError("Failed to load delivery history");
      setDeliveries([]);
    } finally {
      setIsLoadingDeliveries(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!formUrl.trim()) {
      setError("Please enter a webhook URL");
      return;
    }

    const urlRegex = /^https?:\/\/.+/;
    if (!urlRegex.test(formUrl.trim())) {
      setError("Please enter a valid URL (must start with http:// or https://)");
      return;
    }

    if (formEvents.length === 0) {
      setError("Please select at least one event");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/webhooks/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: formUrl.trim(),
          events: formEvents,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to create webhook");
      }

      setSuccess("Webhook created successfully!");
      setShowCreateModal(false);
      setFormUrl("");
      setFormEvents(['response.new']);
      fetchWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create webhook");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm("Are you sure you want to delete this webhook? This action cannot be undone.")) {
      return;
    }

    try {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/webhooks/${webhookId}/`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete webhook");
      }

      setSuccess("Webhook deleted successfully");
      fetchWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete webhook");
    }
  };

  const handleToggleWebhook = async (webhook: Webhook) => {
    try {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/webhooks/${webhook.webhook_id}/`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_active: !webhook.is_active,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update webhook");
      }

      setSuccess(`Webhook ${!webhook.is_active ? 'enabled' : 'disabled'} successfully`);
      fetchWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update webhook");
    }
  };

  const handleViewDeliveries = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setShowDeliveriesModal(true);
    fetchDeliveries(webhook.webhook_id);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess("Copied to clipboard!");
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { icon: any; color: string; label: string }> = {
      success: {
        icon: CheckCircle2,
        color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        label: "Success"
      },
      failed: {
        icon: XCircle,
        color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        label: "Failed"
      },
      pending: {
        icon: Clock,
        color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        label: "Pending"
      },
    };

    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  const toggleEvent = (event: string) => {
    setFormEvents(prev => 
      prev.includes(event) 
        ? prev.filter(e => e !== event)
        : [...prev, event]
    );
  };

  const filteredWebhooks = webhooks.filter((webhook) => {
    return webhook.url.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const hasWebhookAccess = organization?.subscription_plan !== 'starter';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Webhooks</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Receive real-time notifications for survey events
            </p>
          </div>
          {hasWebhookAccess && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Webhook
            </button>
          )}
        </div>

        {/* Success/Error Messages */}
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

        {/* Upgrade Notice */}
        {!hasWebhookAccess && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex-shrink-0">
                <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Upgrade to Pro for Webhooks
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Webhooks allow you to receive real-time notifications when events occur in your surveys. 
                  Integrate with your existing tools and automate your workflows.
                </p>
                <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  Upgrade to Pro
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        {hasWebhookAccess && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Webhooks</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{webhooks.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <Power className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {webhooks.filter(w => w.is_active).length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">With Failures</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {webhooks.filter(w => w.failure_count > 0).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        {hasWebhookAccess && webhooks.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search webhooks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-lg border border-gray-300 bg-transparent text-sm dark:border-gray-700 dark:text-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Webhooks List */}
        {hasWebhookAccess && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredWebhooks.length === 0 ? (
              <div className="text-center py-12">
                <Zap className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                  {searchTerm ? "No webhooks found" : "No webhooks yet"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {searchTerm 
                    ? "Try adjusting your search"
                    : "Create your first webhook to start receiving real-time notifications"}
                </p>
                {!searchTerm && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Webhook
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredWebhooks.map((webhook) => (
                  <div key={webhook.webhook_id} className="p-6 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${
                            webhook.is_active 
                              ? 'bg-green-100 dark:bg-green-900/30' 
                              : 'bg-gray-100 dark:bg-gray-800'
                          }`}>
                            {webhook.is_active ? (
                              <Power className="w-4 h-4 text-green-600 dark:text-green-400" />
                            ) : (
                              <PowerOff className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-medium text-gray-900 dark:text-white truncate">
                                {webhook.url}
                              </h3>
                              <button
                                onClick={() => copyToClipboard(webhook.url)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                                title="Copy URL"
                              >
                                <Copy className="w-3.5 h-3.5 text-gray-400" />
                              </button>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {webhook.events.length} event{webhook.events.length !== 1 ? 's' : ''}
                              </span>
                              {webhook.failure_count > 0 && (
                                <span className="text-xs text-red-600 dark:text-red-400">
                                  {webhook.failure_count} failure{webhook.failure_count !== 1 ? 's' : ''}
                                </span>
                              )}
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Last triggered: {formatDate(webhook.last_triggered_at)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-3">
                          {webhook.events.map((event) => (
                            <span
                              key={event}
                              className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded"
                            >
                              {event}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleViewDeliveries(webhook)}
                          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          title="View deliveries"
                        >
                          <Activity className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </button>
                        <button
                          onClick={() => handleToggleWebhook(webhook)}
                          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          title={webhook.is_active ? "Disable" : "Enable"}
                        >
                          {webhook.is_active ? (
                            <PowerOff className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          ) : (
                            <Power className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteWebhook(webhook.webhook_id)}
                          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-gray-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowCreateModal(false);
                setFormUrl("");
                setFormEvents(['response.new']);
              }}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Create Webhook
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Receive real-time notifications for survey events
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payload URL *
                </label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="url"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    placeholder="https://your-domain.com/webhooks/project-insight"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  We'll send a POST request to this URL when selected events occur
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Events *
                </label>
                <div className="space-y-3">
                  {AVAILABLE_EVENTS.map((event) => (
                    <label
                      key={event.value}
                      className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formEvents.includes(event.value)}
                        onChange={() => toggleEvent(event.value)}
                        className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {event.label}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {event.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                      Webhook Security
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      All webhook requests are signed with HMAC-SHA256. Check the <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/50 rounded text-blue-800 dark:text-blue-200">X-Insight-Signature</code> header to verify authenticity.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormUrl("");
                    setFormEvents(['response.new']);
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateWebhook}
                  disabled={isCreating}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreating ? "Creating..." : "Create Webhook"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deliveries Modal */}
      {showDeliveriesModal && selectedWebhook && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="relative w-full max-w-5xl rounded-3xl bg-white dark:bg-gray-900 p-6 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
            <button
              onClick={() => {
                setShowDeliveriesModal(false);
                setSelectedWebhook(null);
                setDeliveries([]);
              }}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Delivery History
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {selectedWebhook.url}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoadingDeliveries ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : deliveries.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                    No deliveries yet
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This webhook hasn't been triggered yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {deliveries.map((delivery) => (
                    <div
                      key={delivery.delivery_id}
                      className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {delivery.event_type}
                            </span>
                            {getStatusBadge(delivery.status)}
                            {delivery.status_code && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                HTTP {delivery.status_code}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span>Created: {formatDate(delivery.created_at)}</span>
                            {delivery.delivered_at && (
                              <span>Delivered: {formatDate(delivery.delivered_at)}</span>
                            )}
                            {delivery.retry_count > 0 && (
                              <span className="text-yellow-600 dark:text-yellow-400">
                                Retries: {delivery.retry_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {delivery.error_message && (
                        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                          <p className="text-xs font-medium text-red-800 dark:text-red-200 mb-1">
                            Error Message
                          </p>
                          <p className="text-xs text-red-700 dark:text-red-300 font-mono">
                            {delivery.error_message}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}