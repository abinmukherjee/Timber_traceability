export default function SectionHeader({ title, action, className = "" }) {
  return (
    <div className={`mb-4 mt-14 flex items-center justify-between ${className}`}>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}
