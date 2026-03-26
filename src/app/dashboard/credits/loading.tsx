export default function CreditsLoading() {
  return (
    <div className="max-w-4xl animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-24 bg-border/50 rounded-lg" />
        <div className="h-10 w-32 bg-border/30 rounded-xl" />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-5 h-28" />
        ))}
      </div>
      <div className="h-5 w-32 bg-border/50 rounded-lg mb-3" />
      <div className="bg-card border border-border rounded-2xl p-5 h-24 mb-3" />
      <div className="bg-card border border-border rounded-2xl p-5 h-24" />
    </div>
  );
}
