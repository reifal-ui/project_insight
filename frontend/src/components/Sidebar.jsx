import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Mail,
  Settings,
  LogOut 
} from 'lucide-react';
import { clearAuthData } from '../utils/auth';

export default function Sidebar() {
  const location = useLocation();
  
  const handleLogout = () => {
    clearAuthData();
    window.location.href = '/login';
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: FileText, label: 'Surveys', path: '/surveys' },
    { icon: Users, label: 'Contacts', path: '/contacts' },
    { icon: Mail, label: 'Campaigns', path: '/campaigns' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Project Insight</h1>
        <p className="text-sm text-gray-500 mt-1">Survey Platform</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 px-4 py-3 rounded-lg w-full text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}