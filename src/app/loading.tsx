export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-600 animate-spin"></div>
        </div>
        <p className="text-gray-500 text-sm font-medium">Loading...</p>
      </div>
    </div>
  );
}
