import React, { useState, useEffect } from 'react';
import { BarChart3, Users, FileText, TrendingUp, Send, Eye, MousePointerClick, Calendar, CheckCircle, FileBarChart, AlertCircle, ArrowUpRight } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000/api/v1';

const ProjectInsightDashboard = () => {
  const [surveys, setSurveys] = useState([]);
  const [contactStats, setContactStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData) {
      setError('Anda belum login. Silakan login terlebih dahulu.');
      setLoading(false);
      return;
    }

    try {
      const user = JSON.parse(userData);
      const orgId = user.organizations?.[0]?.org_id;

      if (!orgId) {
        setError('Tidak ada organisasi yang tersedia.');
        setLoading(false);
        return;
      }

      const surveysRes = await fetch(`${API_BASE_URL}/surveys/?organization=${orgId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (surveysRes.ok) {
        const surveysData = await surveysRes.json();
        setSurveys(Array.isArray(surveysData) ? surveysData : []);
      }

      try {
        const contactRes = await fetch(`${API_BASE_URL}/respondents/statistics/?organization=${orgId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (contactRes.ok) {
          const contactData = await contactRes.json();
          if (contactData.success) {
            setContactStats(contactData.data);
          }
        }
      } catch (err) {
        console.log('Contact stats tidak tersedia');
      }

      setLoading(false);

    } catch (err) {
      console.error('Error loading data:', err);
      setError(`Error: ${err.message}`);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-8 max-w-lg">
          <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400 mx-auto mb-4" />
          <h2 className="text-red-800 dark:text-red-300 font-bold text-xl mb-2 text-center">Error</h2>
          <p className="text-red-600 dark:text-red-400 text-center">{error}</p>
          <button 
            onClick={loadAllData}
            className="mt-4 w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const totalSurveys = surveys.length;
  const activeSurveys = surveys.filter(s => s.status === 'active').length;
  const draftSurveys = surveys.filter(s => s.status === 'draft').length;
  const closedSurveys = surveys.filter(s => s.status === 'closed').length;
  const totalResponses = surveys.reduce((sum, s) => sum + (s.response_count || 0), 0);
  
  const contacts = contactStats?.contacts || {};
  const campaigns = contactStats?.campaigns || {};
  const emailStats = campaigns?.email_stats || {};

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Dashboard Overview
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Monitor your survey performance and analytics
          </p>
        </div>

        {/* Survey Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            icon={FileText}
            title="Total Surveys"
            value={totalSurveys}
            subtitle="All surveys"
            trend="+12%"
            trendUp={true}
            color="blue"
          />
          <MetricCard
            icon={TrendingUp}
            title="Active Surveys"
            value={activeSurveys}
            subtitle="Currently running"
            trend="+8%"
            trendUp={true}
            color="green"
          />
          <MetricCard
            icon={CheckCircle}
            title="Total Responses"
            value={totalResponses}
            subtitle="All time"
            trend="+23%"
            trendUp={true}
            color="purple"
          />
          <MetricCard
            icon={FileBarChart}
            title="Draft Surveys"
            value={draftSurveys}
            subtitle="In progress"
            color="orange"
          />
        </div>

        {/* Contact & Campaign Metrics */}
        {contactStats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              icon={Users}
              title="Total Contacts"
              value={contacts.total || 0}
              subtitle={`${contacts.subscribed || 0} subscribed`}
              color="blue"
            />
            <MetricCard
              icon={Send}
              title="Email Campaigns"
              value={campaigns.sent || 0}
              subtitle={`of ${campaigns.total || 0} total`}
              color="green"
            />
            <MetricCard
              icon={Eye}
              title="Open Rate"
              value={`${emailStats.open_rate?.toFixed(1) || 0}%`}
              subtitle={`${emailStats.total_opened || 0} opens`}
              color="purple"
            />
            <MetricCard
              icon={MousePointerClick}
              title="Click Rate"
              value={`${emailStats.click_rate?.toFixed(1) || 0}%`}
              subtitle={`${emailStats.total_clicked || 0} clicks`}
              color="pink"
            />
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Survey Status */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Survey Status
              </h2>
              <div className="space-y-3">
                <StatusItem label="Draft" count={draftSurveys} color="yellow" />
                <StatusItem label="Active" count={activeSurveys} color="green" />
                <StatusItem label="Closed" count={closedSurveys} color="gray" />
              </div>
            </div>
          </div>

          {/* All Surveys List */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Recent Surveys
                </h2>
                <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                  View all <ArrowUpRight size={14} />
                </button>
              </div>
              
              {surveys.length > 0 ? (
                <div className="space-y-3">
                  {surveys.slice(0, 5).map((survey) => (
                    <SurveyCard key={survey.survey_id} survey={survey} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText size={48} className="text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-400 dark:text-gray-500 text-sm">No surveys yet</p>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Create your first survey to get started</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Imports */}
        {contactStats?.imports?.recent && contactStats.imports.recent.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Contact Imports
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contactStats.imports.recent.slice(0, 3).map((imp) => (
                <ImportCard key={imp.import_id} importData={imp} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MetricCard = ({ icon: Icon, title, value, subtitle, trend, trendUp, color }) => {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    green: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
    pink: "bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400"
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 hover:shadow-lg dark:hover:shadow-gray-800/50 transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon size={20} />
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trendUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
    </div>
  );
};

const StatusItem = ({ label, count, color }) => {
  const colors = {
    yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    gray: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${colors[color]}`}>
        {count}
      </span>
    </div>
  );
};

const SurveyCard = ({ survey }) => {
  const statusColors = {
    active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    draft: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    closed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
  };

  return (
    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-1">
          {survey.title}
        </h3>
        <span className={`px-2 py-1 text-xs rounded-full ${statusColors[survey.status]}`}>
          {survey.status}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <CheckCircle size={14} />
          <span>{survey.response_count || 0} responses</span>
        </div>
        {survey.completion_rate !== undefined && (
          <div className="flex items-center gap-1">
            <TrendingUp size={14} />
            <span>{survey.completion_rate}%</span>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
        {new Date(survey.created_at).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        })}
      </p>
    </div>
  );
};

const ImportCard = ({ importData }) => {
  const statusColors = {
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    partial: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
  };

  return (
    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-1">
          {importData.filename}
        </h3>
        <span className={`px-2 py-1 text-xs rounded-full ${statusColors[importData.status]}`}>
          {importData.status}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Success</span>
          <span className="text-green-600 dark:text-green-400 font-medium">{importData.successful_imports}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Failed</span>
          <span className="text-red-600 dark:text-red-400 font-medium">{importData.failed_imports}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Success Rate</span>
          <span className="text-blue-600 dark:text-blue-400 font-semibold">{importData.success_rate}%</span>
        </div>
      </div>
    </div>
  );
};

export default ProjectInsightDashboard;