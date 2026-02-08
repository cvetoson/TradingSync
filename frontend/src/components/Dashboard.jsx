import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import AccountCard from './AccountCard';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

export default function Dashboard({ portfolioData, onUploadClick, onRefresh, onViewAccountDetails }) {
  if (!portfolioData || !portfolioData.pieData || portfolioData.pieData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-xl p-8 text-center">
        <div className="mb-6">
          <svg className="mx-auto h-24 w-24 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">No Portfolio Data Yet</h2>
        <p className="text-gray-500 mb-6">Upload screenshots from your trading platforms to get started</p>
        <button
          onClick={onUploadClick}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Upload First Screenshot
        </button>
      </div>
    );
  }

  const totalValue = portfolioData.totalValue;
  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: portfolioData.currency || 'EUR',
    minimumFractionDigits: 2
  }).format(totalValue);

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Total Portfolio Value</h2>
            <p className="text-sm text-gray-500">Last updated: {new Date(portfolioData.lastUpdated).toLocaleString()}</p>
          </div>
          <button
            onClick={onUploadClick}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Upload New
          </button>
        </div>
        <div className="text-4xl font-bold text-blue-600">{formattedTotal}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-white rounded-lg shadow-xl p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Portfolio Distribution</h3>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <Pie
                data={portfolioData.pieData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name }) => {
                  // Truncate long names to prevent overflow
                  const displayName = name.length > 20 ? name.substring(0, 17) + '...' : name;
                  return displayName;
                }}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {portfolioData.pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: portfolioData.currency || 'EUR'
                }).format(value)}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value) => {
                  // Show full name in legend, truncate if too long
                  return value.length > 25 ? value.substring(0, 22) + '...' : value;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Account List */}
        <div className="bg-white rounded-lg shadow-xl p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Accounts</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {portfolioData.accounts.map((account) => (
              <AccountCard 
                key={account.id} 
                account={account} 
                currency={portfolioData.currency}
                onUpdate={onRefresh}
                onViewDetails={onViewAccountDetails}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
