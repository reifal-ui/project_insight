import { useState, useEffect } from "react";
import { Search, Plus, Download, Upload, Mail, Edit, Trash2, Users, X, CheckCircle, FileText } from "lucide-react";
import axios from "axios";

const API_BASE_URL = "http://localhost:8000/api/v1";

interface Contact {
  contact_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  company: string;
  job_title: string;
  status: string;
  is_active: boolean;
  display_name: string;
  created_at: string;
  last_contacted: string;
  contact_lists: ContactList[];
}

interface ContactList {
  list_id: string;
  name: string;
  description: string;
  contact_count: number;
  active_contact_count: number;
  is_active: boolean;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

interface SurveyInvitation {
  invitation_id: string;
  contact_email: string;
  contact_name: string;
  survey_title: string;
  status: string;
  sent_at: string;
  opened_at: string;
  clicked_at: string;
  responded_at: string;
}

interface Statistics {
  total_contacts: number;
  active_contacts: number;
  subscribed_contacts: number;
  contact_lists_count: number;
}

const RespondentsPage = () => {
  const [activeTab, setActiveTab] = useState<"contacts" | "lists" | "invitations">("contacts");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [invitations, setInvitations] = useState<SurveyInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showAddListModal, setShowAddListModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditContactModal, setShowEditContactModal] = useState(false);
  const [showEditListModal, setShowEditListModal] = useState(false);
  const [showListDetailsModal, setShowListDetailsModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editingList, setEditingList] = useState<ContactList | null>(null);
  const [selectedListDetails, setSelectedListDetails] = useState<ContactList | null>(null);
  const [listContacts, setListContacts] = useState<Contact[]>([]);
  const [newContact, setNewContact] = useState({
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
    company: "",
    job_title: "",
    contact_list_ids: [] as string[]
  });
  const [newList, setNewList] = useState({
    name: "",
    description: "",
    is_active: true
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [selectedListForImport, setSelectedListForImport] = useState("");
  const [updateExisting, setUpdateExisting] = useState(false);

  useEffect(() => {
    fetchStatistics();
    fetchContactLists();
    if (activeTab === "contacts") fetchContacts();
    else if (activeTab === "lists") fetchContactLists();
    else if (activeTab === "invitations") fetchInvitations();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "contacts") fetchContacts();
  }, [statusFilter, searchTerm]);

  const fetchStatistics = async () => {
    try {
      const token = localStorage.getItem("token");
      const orgId = localStorage.getItem("selectedOrganization");
      const response = await axios.get(`${API_BASE_URL}/respondents/statistics/`, {
        params: { organization: orgId },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) setStatistics(response.data.data);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const fetchContacts = async () => {
    setContactsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const orgId = localStorage.getItem("selectedOrganization");
      const params: any = { organization: orgId };
      if (statusFilter !== "all") params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      const response = await axios.get(`${API_BASE_URL}/respondents/contacts/`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data.results || response.data.data || response.data;
      setContacts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error:", error);
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  };

  const fetchContactLists = async () => {
    setListsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const orgId = localStorage.getItem("selectedOrganization");
      const response = await axios.get(`${API_BASE_URL}/respondents/contact-lists/`, {
        params: { organization: orgId },
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data.results || response.data.data || response.data;
      setContactLists(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error:", error);
      setContactLists([]);
    } finally {
      setListsLoading(false);
    }
  };

  const fetchInvitations = async () => {
    setInvitationsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/respondents/invitations/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data.results || response.data.data || response.data;
      setInvitations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error:", error);
      setInvitations([]);
    } finally {
      setInvitationsLoading(false);
    }
  };

  const handleAddContact = async () => {
    try {
      const token = localStorage.getItem("token");
      const orgId = localStorage.getItem("selectedOrganization");
      if (!newContact.email) {
        alert("Email is required");
        return;
      }
      await axios.post(`${API_BASE_URL}/respondents/contacts/`, 
        { ...newContact, organization_id: orgId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowAddContactModal(false);
      setNewContact({ email: "", first_name: "", last_name: "", phone: "", company: "", job_title: "", contact_list_ids: [] });
      fetchContacts();
      fetchStatistics();
      alert("Contact added successfully!");
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to add contact");
    }
  };

  const handleEditContact = async () => {
    if (!editingContact) return;
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API_BASE_URL}/respondents/contacts/${editingContact.contact_id}/`,
        newContact,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowEditContactModal(false);
      setEditingContact(null);
      fetchContacts();
      alert("Contact updated!");
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to update contact");
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm("Delete this contact?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/respondents/contacts/${contactId}/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchContacts();
      fetchStatistics();
      alert("Contact deleted!");
    } catch (error: any) {
      alert("Failed to delete contact");
    }
  };

  const handleAddList = async () => {
    try {
      const token = localStorage.getItem("token");
      const orgId = localStorage.getItem("selectedOrganization");
      if (!newList.name) {
        alert("List name is required");
        return;
      }
      await axios.post(`${API_BASE_URL}/respondents/contact-lists/`,
        { ...newList, organization_id: orgId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowAddListModal(false);
      setNewList({ name: "", description: "", is_active: true });
      fetchContactLists();
      fetchStatistics();
      alert("Contact list created!");
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to create list");
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!confirm("Delete this list?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/respondents/contact-lists/${listId}/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchContactLists();
      fetchStatistics();
      alert("List deleted!");
    } catch (error: any) {
      alert("Failed to delete list");
    }
  };

  const handleEditList = async () => {
    if (!editingList) return;
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API_BASE_URL}/respondents/contact-lists/${editingList.list_id}/`,
        newList,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowEditListModal(false);
      setEditingList(null);
      setNewList({ name: "", description: "", is_active: true });
      fetchContactLists();
      alert("List updated!");
    } catch (error: any) {
      alert("Failed to update list");
    }
  };

  const handleImportContacts = async () => {
    if (!importFile || !selectedListForImport) {
      alert("Please select file and list");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const orgId = localStorage.getItem("selectedOrganization");
      const formData = new FormData();
      formData.append("csv_file", importFile);
      formData.append("contact_list_id", selectedListForImport);
      formData.append("update_existing", updateExisting.toString());
      formData.append("organization_id", orgId || "");
      const response = await axios.post(`${API_BASE_URL}/respondents/contacts/import/`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" } }
      );
      if (response.data.success) {
        setShowImportModal(false);
        setImportFile(null);
        setSelectedListForImport("");
        fetchContacts();
        fetchStatistics();
        alert(`Import successful! ${response.data.data.successful_imports} contacts imported.`);
      }
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to import");
    }
  };

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setNewContact({
      email: contact.email,
      first_name: contact.first_name,
      last_name: contact.last_name,
      phone: contact.phone,
      company: contact.company,
      job_title: contact.job_title,
      contact_list_ids: contact.contact_lists.map(l => l.list_id)
    });
    setShowEditContactModal(true);
  };

  const openListDetails = async (list: ContactList) => {
    setSelectedListDetails(list);
    setShowListDetailsModal(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/respondents/contacts/`, {
        params: { contact_list: list.list_id },
        headers: { Authorization: `Bearer ${token}` }
      });
      setListContacts(response.data.results || response.data);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const openEditListModal = (list: ContactList) => {
    setEditingList(list);
    setNewList({ name: list.name, description: list.description, is_active: list.is_active });
    setShowEditListModal(true);
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.company && contact.company.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "all" || contact.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const badges: any = {
      subscribed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      unsubscribed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
      bounced: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      complained: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      pending: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      sent: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
      delivered: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
      opened: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      clicked: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
      responded: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    };
    return badges[status] || badges.subscribed;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">Respondents</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage contacts, lists, and invitations</p>
      </div>

      {statistics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Contacts</p>
                <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{statistics.total_contacts}</p>
              </div>
              <div className="rounded-lg bg-brand-50 p-3 dark:bg-brand-900/20">
                <Mail className="w-6 h-6 text-brand-500" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
                <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{statistics.active_contacts}</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Subscribed</p>
                <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{statistics.subscribed_contacts}</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Lists</p>
                <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{statistics.contact_lists_count}</p>
              </div>
              <div className="rounded-lg bg-purple-50 p-3 dark:bg-purple-900/20">
                <FileText className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex space-x-8">
          <button onClick={() => setActiveTab("contacts")} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === "contacts" ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
            Contacts
          </button>
          <button onClick={() => setActiveTab("lists")} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === "lists" ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
            Contact Lists
          </button>
          <button onClick={() => setActiveTab("invitations")} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === "invitations" ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
            Invitations
          </button>
        </nav>
      </div>

      {activeTab === "contacts" && (
        <div className="space-y-4">
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              <Upload className="w-4 h-4" />Import
            </button>
            <button onClick={() => setShowAddContactModal(true)} className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600">
              <Plus className="w-4 h-4" />Add Contact
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full h-11 pl-10 pr-4 rounded-lg border border-gray-300 bg-transparent text-sm dark:border-gray-700 dark:text-white/90" />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-11 rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:text-white/90">
                  <option value="all">All Status</option>
                  <option value="subscribed">Subscribed</option>
                  <option value="unsubscribed">Unsubscribed</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.02]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {contactsLoading ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                  ) : filteredContacts.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No contacts</td></tr>
                  ) : (
                    filteredContacts.map((c) => (
                      <tr key={c.contact_id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-800 dark:text-white/90">{c.display_name}</div>
                            <div className="text-sm text-gray-500">{c.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-800 dark:text-white/90">{c.company || '-'}</div>
                          <div className="text-sm text-gray-500">{c.job_title || '-'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(c.status)}`}>{c.status}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => openEditModal(c)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/[0.05]">
                            <Edit className="w-4 h-4 text-gray-500" />
                          </button>
                          <button onClick={() => handleDeleteContact(c.contact_id)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/[0.05]">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "lists" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAddListModal(true)} className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600">
              <Plus className="w-4 h-4" />Create List
            </button>
          </div>
          {listsLoading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
              <p className="text-gray-500">Loading...</p>
            </div>
          ) : contactLists.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
              <p className="text-gray-500">No lists</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {contactLists.map((list) => (
                <div key={list.list_id} className="rounded-xl border border-gray-200 bg-white hover:shadow-lg transition dark:border-gray-800 dark:bg-white/[0.03]">
                  <div className="p-6">
                    <div className="flex justify-between mb-3">
                      <div className="rounded-lg bg-brand-50 p-2.5 dark:bg-brand-900/20">
                        <Users className="w-5 h-5 text-brand-500" />
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEditListModal(list)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/[0.05]">
                          <Edit className="w-4 h-4 text-gray-500" />
                        </button>
                        <button onClick={() => handleDeleteList(list.list_id)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/[0.05]">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                    <button onClick={() => openListDetails(list)} className="w-full text-left">
                      <h3 className="font-semibold text-gray-800 dark:text-white/90 mb-2">{list.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{list.description || 'No description'}</p>
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                          <p className="mt-1 text-lg font-semibold text-gray-800 dark:text-white/90">{list.contact_count}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
                          <p className="mt-1 text-lg font-semibold text-green-600 dark:text-green-400">{list.active_contact_count}</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "invitations" && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <table className="w-full">
            <thead className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.02]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Survey</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {invitationsLoading ? (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : invitations.length === 0 ? (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No invitations</td></tr>
              ) : (
                invitations.map((inv) => (
                  <tr key={inv.invitation_id}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-800 dark:text-white/90">{inv.contact_name}</div>
                      <div className="text-sm text-gray-500">{inv.contact_email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800 dark:text-white/90">{inv.survey_title}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(inv.status)}`}>{inv.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAddContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">Add Contact</h2>
              <button onClick={() => setShowAddContactModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/[0.05] rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">First Name</label>
                  <input type="text" value={newContact.first_name} onChange={(e) => setNewContact({...newContact, first_name: e.target.value})} className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-transparent dark:text-white/90" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Last Name</label>
                  <input type="text" value={newContact.last_name} onChange={(e) => setNewContact({...newContact, last_name: e.target.value})} className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-transparent dark:text-white/90" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Email *</label>
                <input type="email" required value={newContact.email} onChange={(e) => setNewContact({...newContact, email: e.target.value})} className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-transparent dark:text-white/90" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Phone</label>
                <input type="text" value={newContact.phone} onChange={(e) => setNewContact({...newContact, phone: e.target.value})} className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-transparent dark:text-white/90" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Company</label>
                  <input type="text" value={newContact.company} onChange={(e) => setNewContact({...newContact, company: e.target.value})} className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-transparent dark:text-white/90" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Job Title</label>
                  <input type="text" value={newContact.job_title} onChange={(e) => setNewContact({...newContact, job_title: e.target.value})} className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-transparent dark:text-white/90" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
              <button onClick={() => setShowAddContactModal(false)} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400">Cancel</button>
              <button onClick={handleAddContact} className="px-4 py-2.5 rounded-lg bg-brand-500 text-sm font-medium text-white hover:bg-brand-600">Add Contact</button>
            </div>
          </div>
        </div>
      )}

      {showEditContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">Edit Contact</h2>
              <button onClick={() => setShowEditContactModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/[0.05] rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">First Name</label>
                  <input type="text" value={newContact.first_name} onChange={(e) => setNewContact({...newContact, first_name: e.target.value})} className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-transparent dark:text-white/90" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Last Name</label>
                  <input type="text" value={newContact.last_name} onChange={(e) => setNewContact({...newContact, last_name: e.target.value})} className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-transparent dark:text-white/90" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Email</label>
                <input type="email" value={newContact.email} onChange={(e) => setNewContact({...newContact, email: e.target.value})} className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-transparent dark:text-white/90" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Phone</label>
                <input type="text" value={newContact.phone} onChange={(e) => setNewContact({...newContact, phone: e.target.value})} className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-transparent dark:text-white/90" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Company</label>
                  <input type="text" value={newContact.company} onChange={(e) => setNewContact({...newContact, company: e.target.value})} className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-transparent dark:text-white/90" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Job Title</label>
                  <input type="text" value={newContact.job_title} onChange={(e) => setNewContact({...newContact, job_title: e.target.value})} className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-transparent dark:text-white/90" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
              <button onClick={() => setShowEditContactModal(false)} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400">Cancel</button>
              <button onClick={handleEditContact} className="px-4 py-2.5 rounded-lg bg-brand-500 text-sm font-medium text-white hover:bg-brand-600">Update</button>
            </div>
          </div>
        </div>
      )}

      {showAddListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">Create List</h2>
              <button onClick={() => setShowAddListModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/[0.05] rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">List Name *</label>
                <input type="text" required value={newList.name} onChange={(e) => setNewList({...newList, name: e.target.value})} className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-transparent dark:text-white/90" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Description</label>
                <textarea rows={3} value={newList.description} onChange={(e) => setNewList({...newList, description: e.target.value})} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-transparent dark:text-white/90" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_active" checked={newList.is_active} onChange={(e) => setNewList({...newList, is_active: e.target.checked})} className="w-4 h-4 rounded border-gray-300 text-brand-500" />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-400">Active</label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
              <button onClick={() => setShowAddListModal(false)} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400">Cancel</button>
              <button onClick={handleAddList} className="px-4 py-2.5 rounded-lg bg-brand-500 text-sm font-medium text-white hover:bg-brand-600">Create</button>
            </div>
          </div>
        </div>
      )}

      {showEditListModal && editingList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">Edit List</h2>
              <button onClick={() => setShowEditListModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/[0.05] rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">List Name *</label>
                <input type="text" required value={newList.name} onChange={(e) => setNewList({...newList, name: e.target.value})} className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-transparent dark:text-white/90" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Description</label>
                <textarea rows={3} value={newList.description} onChange={(e) => setNewList({...newList, description: e.target.value})} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-transparent dark:text-white/90" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="edit_is_active" checked={newList.is_active} onChange={(e) => setNewList({...newList, is_active: e.target.checked})} className="w-4 h-4 rounded border-gray-300 text-brand-500" />
                <label htmlFor="edit_is_active" className="text-sm font-medium text-gray-700 dark:text-gray-400">Active</label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
              <button onClick={() => setShowEditListModal(false)} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400">Cancel</button>
              <button onClick={handleEditList} className="px-4 py-2.5 rounded-lg bg-brand-500 text-sm font-medium text-white hover:bg-brand-600">Update</button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">Import Contacts</h2>
              <button onClick={() => setShowImportModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/[0.05] rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Select List *</label>
                <select value={selectedListForImport} onChange={(e) => setSelectedListForImport(e.target.value)} className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-transparent dark:text-white/90">
                  <option value="">Choose a list</option>
                  {contactLists.map((list) => (
                    <option key={list.list_id} value={list.list_id}>{list.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">CSV File *</label>
                <input type="file" accept=".csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white/90" />
                <p className="mt-1 text-xs text-gray-500">CSV must include 'email' column</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="update_existing" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-brand-500" />
                <label htmlFor="update_existing" className="text-sm font-medium text-gray-700 dark:text-gray-400">Update existing</label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
              <button onClick={() => setShowImportModal(false)} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400">Cancel</button>
              <button onClick={handleImportContacts} className="px-4 py-2.5 rounded-lg bg-brand-500 text-sm font-medium text-white hover:bg-brand-600">Import</button>
            </div>
          </div>
        </div>
      )}

      {showListDetailsModal && selectedListDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">{selectedListDetails.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{selectedListDetails.description || 'No description'}</p>
              </div>
              <button onClick={() => setShowListDetailsModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/[0.05] rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-400 mb-4">Contacts ({listContacts.length})</h3>
              {listContacts.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No contacts</p>
              ) : (
                <div className="space-y-2">
                  {listContacts.map((c) => (
                    <div key={c.contact_id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.02]">
                      <div>
                        <div className="text-sm font-medium text-gray-800 dark:text-white/90">{c.display_name}</div>
                        <div className="text-sm text-gray-500">{c.email}</div>
                      </div>
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(c.status)}`}>{c.status}</span>
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
};

export default RespondentsPage;