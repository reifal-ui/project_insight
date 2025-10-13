export default function Stats({ label, value, change, trend = 'up' }) {
  const trendColor = trend === 'up' ? 'text-green-600' : 'text-red-600';
  
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <div className="mt-2 flex items-baseline space-x-2">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {change && (
          <span className={`text-sm font-medium ${trendColor}`}>
            {trend === 'up' ? '↑' : '↓'} {change}
          </span>
        )}
      </div>
    </div>
  );
}