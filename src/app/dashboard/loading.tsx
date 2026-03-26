export default function DashboardLoading() {
  return (
    <div className="max-w-5xl animate-pulse">
      <div className="mb-8">
        <div className="h-8 w-64 bg-border/50 rounded-lg mb-2" />
        <div className="h-4 w-48 bg-border/30 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-5 h-32" />
        ))}
      </div>
      <div className="bg-card border border-border rounded-2xl p-6 h-24 mb-6" />
      <div className="bg-card border border-border rounded-2xl p-6 h-48" />
    </div>
  );
}
