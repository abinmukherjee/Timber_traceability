const TONES = {
  timber: "bg-timber/10 text-timber",
  ocean: "bg-ocean/10 text-ocean",
  amber: "bg-amber/10 text-amber",
  grape: "bg-grape/10 text-grape",
  danger: "bg-danger/10 text-danger",
  neutral: "bg-mist text-subtle",
};

export default function Pill({ tone = "neutral", className = "", children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
