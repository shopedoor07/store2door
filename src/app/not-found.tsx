import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-8xl font-bold text-emerald-200">404</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Page nahi mila!
          </h1>
          <p className="mt-2 text-gray-600">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors"
          >
            🏠 Home jaayein
          </Link>
          <Link
            href="/categories"
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-100 transition-colors"
          >
            📦 Products dekhein
          </Link>
        </div>
      </div>
    </div>
  );
}
