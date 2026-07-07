/** Inline status banner. type: success | error | loading | info */
const STYLES = {
  success: "bg-timber/8 border-timber/25 text-[#15803d]",
  error: "bg-danger/8 border-danger/25 text-danger",
  loading: "bg-ocean/8 border-ocean/25 text-ocean",
  info: "bg-mist border-hairline text-subtle",
};

export default function StatusMessage({ type = "info", children, className = "" }) {
  if (!children) return null;
  return (
    <div
      className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-relaxed ${STYLES[type]} ${className}`}
    >
      {children}
    </div>
  );
}
