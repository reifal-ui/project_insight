import { Bell, Search } from 'lucide-react';
import { getUser } from '../utils/auth';

export default function Navbar() {
  const user = getUser();

  return (
    <div className="bg-white border-b border-gray-200 h-16 fixed top-0 right-0 left-64 z-10 flex items-center justify-between px-8">
      <div className="flex-1 max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search surveys, contacts..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
      </div>

      {/* User Info */}
      <div className="flex items-center space-x-4">
        <button className="p-2 hover:bg-gray-100 rounded-lg relative">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        <div className="flex items-center space-x-3 pl-4 border-l border-gray-200">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center">
            <span className="text-white font-medium">
              {user?.first_name?.charAt(0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}