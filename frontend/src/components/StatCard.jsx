import { useScrollReveal } from "../hooks/useScrollReveal.js";

const ACCENTS = {
  timber: "text-timber",
  ocean: "text-ocean",
  amber: "text-amber",
  grape: "text-grape",
};

export default function StatCard({ icon, value, label, accent = "timber", delay = 0 }) {
  const [ref, visible] = useScrollReveal();
  return (
    <div
      ref={ref}
      style={{ animationDelay: `${delay}ms` }}
      className={`card card-hover p-6 ${visible ? "animate-fade-up" : "opacity-0"}`}
    >
      <div className="mb-3 text-2xl">{icon}</div>
      <div className={`text-4xl font-semibold tracking-tight ${ACCENTS[accent]}`}>
        {value ?? "—"}
      </div>
      <div className="mt-1 text-sm text-subtle">{label}</div>
    </div>
  );
}
