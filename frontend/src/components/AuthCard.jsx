export default function AuthCard({ subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-800 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
          <h1 className="text-3xl font-bold text-white mb-2 text-center">Trading Sync</h1>
          {subtitle && <p className="text-blue-100 text-center mb-6">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
