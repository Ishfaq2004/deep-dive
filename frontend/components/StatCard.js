const ACCENTS = {
  cyan: "border-cyan/30 text-cyan",
  gold: "border-gold/30 text-gold",
  coral: "border-coral/30 text-coral",
};

export default function StatCard({ label, value, accent = "cyan" }) {
  return (
    <div className={`rounded-xl border bg-mid/60 px-5 py-4 ${ACCENTS[accent]}`}>
      <div className="text-xs text-textDim uppercase tracking-wide mb-1">{label}</div>
      <div className="font-mono text-2xl font-semibold">{value}</div>
    </div>
  );
}
