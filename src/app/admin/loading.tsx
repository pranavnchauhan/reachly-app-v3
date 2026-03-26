export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-border/50 rounded-lg" />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 h-20" />
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl p-5 h-48" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card border border-border rounded-xl p-5 h-40" />
        <div className="bg-card border border-border rounded-xl p-5 h-40" />
      </div>
    </div>
  );
}
