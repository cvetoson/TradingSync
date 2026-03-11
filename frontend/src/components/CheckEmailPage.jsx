import { Link } from 'react-router-dom';

export default function CheckEmailPage({ email, devLink }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-800 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-xl p-8 border border-white/20 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
          <p className="text-blue-100 mb-6">
            We sent a verification link to <strong className="text-white">{email}</strong>
          </p>
          {devLink ? (
            <div className="space-y-2 mb-6">
              <p className="text-amber-200 text-sm">
                Email could not be sent. Use this link to verify:
              </p>
              <a
                href={devLink}
                className="inline-block px-4 py-2 rounded-md bg-amber-500/30 hover:bg-amber-500/50 text-amber-100 font-medium transition border border-amber-400/50"
              >
                Verify my email →
              </a>
            </div>
          ) : (
            <p className="text-blue-200 text-sm mb-6">
              Click the link in the email to verify your account. The link expires in 24 hours.
            </p>
          )}
          <Link
            to="/"
            className="inline-block px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white transition"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
