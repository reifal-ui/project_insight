import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, TrendingUp, Users, FileText, Mail } from 'lucide-react';
import Layout from '../components/Layout';
import Stats from '../components/Stats';
import Card from '../components/Card';
import Button from '../components/Button';
import { surveyAPI } from '../services/api';

export default function Dashboard() {
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSurveys: 0,
    activeSurveys: 0,
    totalResponses: 0,
    avgCompletionRate: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const data = await surveyAPI.getAll();
      setSurveys(data);
      
      // Calculate stats
      const total = data.length;
      const active = data.filter(s => s.status === 'active').length;
      const totalResp = data.reduce((sum, s) => sum + (s.response_count || 0), 0);
      const avgRate = data.length > 0
        ? data.reduce((sum, s) => sum + (s.completion_rate || 0), 0) / data.length
        : 0;

      setStats({
        totalSurveys: total,
        activeSurveys: active,
        totalResponses: totalResp,
        avgCompletionRate: avgRate.toFixed(1)
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      closed: 'bg-red-100 text-red-800'
    };
    return colors[status] || colors.draft;
  };

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's your overview.</p>
        </div>
        <Link to="/surveys/new">
          <Button>
            <div className="flex items-center space-x-2">
              <Plus size={20} />
              <span>Create Survey</span>
            </div>
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Stats
          label="Total Surveys"
          value={stats.totalSurveys}
          change="+12%"
          trend="up"
        />
        <Stats
          label="Active Surveys"
          value={stats.activeSurveys}
          change="+5%"
          trend="up"
        />
        <Stats
          label="Total Responses"
          value={stats.totalResponses}
          change="+23%"
          trend="up"
        />
        <Stats
          label="Avg Completion"
          value={`${stats.avgCompletionRate}%`}
          change="+3%"
          trend="up"
        />
      </div>

      {/* Recent Surveys */}
      <Card
        title="Recent Surveys"
        subtitle="Your latest survey projects"
        action={
          <Link to="/surveys" className="text-sm text-gray-600 hover:text-gray-900">
            View all →
          </Link>
        }
      >
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : surveys.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">No surveys yet</p>
            <Link to="/surveys/new">
              <Button variant="secondary">Create Your First Survey</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {surveys.slice(0, 5).map((survey) => (
              <Link
                key={survey.survey_id}
                to={`/surveys/${survey.survey_id}`}
                className="block p-4 border border-gray-200 rounded-lg hover:border-gray-900 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-semibold text-gray-900">{survey.title}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(survey.status)}`}>
                        {survey.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {survey.response_count || 0} responses • {survey.completion_rate || 0}% completion
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {new Date(survey.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <Link to="/surveys/new">
          <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-900 hover:shadow-md transition-all cursor-pointer">
            <FileText size={32} className="text-gray-900 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-1">Create Survey</h3>
            <p className="text-sm text-gray-500">Build a new survey from scratch</p>
          </div>
        </Link>

        <Link to="/contacts">
          <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-900 hover:shadow-md transition-all cursor-pointer">
            <Users size={32} className="text-gray-900 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-1">Manage Contacts</h3>
            <p className="text-sm text-gray-500">Import and organize contacts</p>
          </div>
        </Link>

        <Link to="/campaigns">
          <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-900 hover:shadow-md transition-all cursor-pointer">
            <Mail size={32} className="text-gray-900 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-1">Email Campaign</h3>
            <p className="text-sm text-gray-500">Send surveys to your audience</p>
          </div>
        </Link>
      </div>
    </Layout>
  );
}