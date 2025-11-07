import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";

const API_BASE_URL = "http://localhost:8000/api/v1";
const getAuthToken = () => localStorage.getItem("token") || "";

interface Survey {
  survey_id: string;
  title: string;
  status: string;
  response_count: number;
}

interface ContactList {
  list_id: string;
  name: string;
  contact_count: number;
  active_contact_count: number;
}

interface EmailTemplate {
  template_id: string;
  name: string;
  template_type: string;
  subject_line: string;
  message_body: string;
}

export default function DistributionPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form state
  const [selectedSurvey, setSelectedSurvey] = useState("");
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [useTemplate, setUseTemplate] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchSurveys(),
        fetchContactLists(),
        fetchEmailTemplates()
      ]);
    } catch (err) {
      console.error("Error loading data:", err);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSurveys = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/surveys/?status=active`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch surveys");
      const data = await response.json();
      setSurveys(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching surveys:", err);
      setSurveys([]);
    }
  };

  const fetchContactLists = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/respondents/contact-lists/`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch contact lists");
      const data = await response.json();
      setContactLists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching contact lists:", err);
      setContactLists([]);
    }
  };

  const fetchEmailTemplates = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/respondents/email-templates/?is_active=true`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        console.log("No templates found, using empty array");
        setEmailTemplates([]);
        return;
      }
      const data = await response.json();
      setEmailTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching templates:", err);
      setEmailTemplates([]);
    }
  };

  const handleListToggle = (listId: string) => {
    setSelectedLists(prev => 
      prev.includes(listId) 
        ? prev.filter(id => id !== listId)
        : [...prev, listId]
    );
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = emailTemplates.find(t => t.template_id === templateId);
    if (template) {
      setCustomSubject(template.subject_line);
      setCustomMessage(template.message_body);
    }
  };

  const handleSendInvitations = async () => {
    // Validation
    if (!selectedSurvey) {
      toast.error("Please select a survey");
      return;
    }
    if (selectedLists.length === 0) {
      toast.error("Please select at least one contact list");
      return;
    }
    if (!customSubject || !customMessage) {
      toast.error("Please fill in subject and message");
      return;
    }
    if (!senderName || !senderEmail) {
      toast.error("Please fill in sender information");
      return;
    }

    setIsSending(true);
    const loadingToast = toast.loading("Sending invitations...");

    try {
      const payload: any = {
        survey_id: selectedSurvey,
        contact_list_ids: selectedLists,
        subject_line: customSubject,
        message_body: customMessage,
        sender_name: senderName,
        sender_email: senderEmail,
        send_immediately: true
      };

      // Add template if using one
      if (useTemplate && selectedTemplate) {
        payload.email_template_id = selectedTemplate;
      }

      const response = await fetch(`${API_BASE_URL}/respondents/invitations/send-bulk/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to send invitations");
      }

      if (result.success) {
        toast.success(
          `Successfully sent ${result.data?.invitations_created || 0} invitations!`,
          { id: loadingToast }
        );

        // Show errors if any
        if (result.data?.errors && result.data.errors.length > 0) {
          setTimeout(() => {
            toast.error(`${result.data.invitations_failed} failed. Check console for details.`);
            console.log("Failed invitations:", result.data.errors);
          }, 2000);
        }

        // Reset form
        setSelectedSurvey("");
        setSelectedLists([]);
        setSelectedTemplate("");
        setCustomSubject("");
        setCustomMessage("");
      } else {
        throw new Error(result.message || "Failed to send invitations");
      }
    } catch (err) {
      console.error("Send error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to send invitations",
        { id: loadingToast }
      );
    } finally {
      setIsSending(false);
    }
  };

  const getTotalRecipients = () => {
    return contactLists
      .filter(list => selectedLists.includes(list.list_id))
      .reduce((sum, list) => sum + list.active_contact_count, 0);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading distribution data...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              Survey Distribution
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Send survey invitations to your contacts via email
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Select Survey */}
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  1. Select Survey
                </h2>
                
                {surveys.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-500 dark:text-gray-400 mb-2">No active surveys available</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">Create and activate a survey first</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {surveys.map(survey => (
                      <label
                        key={survey.survey_id}
                        className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedSurvey === survey.survey_id
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="survey"
                            value={survey.survey_id}
                            checked={selectedSurvey === survey.survey_id}
                            onChange={(e) => setSelectedSurvey(e.target.value)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {survey.title}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {survey.response_count} responses
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                          {survey.status}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Select Recipients */}
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  2. Select Recipients
                </h2>

                {contactLists.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-gray-500 dark:text-gray-400 mb-2">No contact lists available</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">Create a contact list first</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {contactLists.map(list => (
                      <label
                        key={list.list_id}
                        className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedLists.includes(list.list_id)
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedLists.includes(list.list_id)}
                            onChange={() => handleListToggle(list.list_id)}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {list.name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {list.active_contact_count} active contacts
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Compose Message */}
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  3. Compose Message
                </h2>

                <div className="space-y-4">
                  {/* Template Toggle */}
                  {emailTemplates.length > 0 && (
                    <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => setUseTemplate(true)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          useTemplate
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        Use Template
                      </button>
                      <button
                        onClick={() => setUseTemplate(false)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          !useTemplate
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        Custom Message
                      </button>
                    </div>
                  )}

                  {useTemplate && emailTemplates.length > 0 ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Select Template
                      </label>
                      <select
                        value={selectedTemplate}
                        onChange={(e) => handleTemplateChange(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Choose a template...</option>
                        {emailTemplates.map(template => (
                          <option key={template.template_id} value={template.template_id}>
                            {template.name}
                          </option>
                        ))}
                      </select>

                      {selectedTemplate && customSubject && (
                        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Preview:
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                            <div><strong>Subject:</strong> {customSubject}</div>
                            <div className="whitespace-pre-wrap">{customMessage}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Subject Line *
                        </label>
                        <input
                          type="text"
                          value={customSubject}
                          onChange={(e) => setCustomSubject(e.target.value)}
                          placeholder="You're invited to participate in our survey"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Message Body *
                        </label>
                        <textarea
                          value={customMessage}
                          onChange={(e) => setCustomMessage(e.target.value)}
                          placeholder={`Hello {first_name},

You've been invited to participate in our survey: {survey_title}

Click here to start: {survey_url}

Thank you!`}
                          rows={8}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Available variables: {"{first_name}"}, {"{last_name}"}, {"{survey_title}"}, {"{survey_url}"}
                        </p>
                      </div>
                    </>
                  )}

                  {/* Sender Info */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Sender Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Sender Name *
                        </label>
                        <input
                          type="text"
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                          placeholder="Your Name"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Sender Email *
                        </label>
                        <input
                          type="email"
                          value={senderEmail}
                          onChange={(e) => setSenderEmail(e.target.value)}
                          placeholder="you@company.com"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 sticky top-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Summary
                </h2>

                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Survey</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {selectedSurvey 
                        ? surveys.find(s => s.survey_id === selectedSurvey)?.title 
                        : "Not selected"}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Contact Lists</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {selectedLists.length} selected
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Total Recipients</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {getTotalRecipients()}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={handleSendInvitations}
                      disabled={isSending || !selectedSurvey || selectedLists.length === 0 || !customSubject || !customMessage || !senderName || !senderEmail}
                      className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSending ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Sending...
                        </span>
                      ) : (
                        `Send to ${getTotalRecipients()} Recipients`
                      )}
                    </button>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      💡 <strong>Tip:</strong> Test with a small contact list first before sending to everyone
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}