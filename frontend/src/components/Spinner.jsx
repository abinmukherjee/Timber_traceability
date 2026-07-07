export default function Spinner({ className = "" }) {
  return (
    <div
      className={`h-8 w-8 animate-spin rounded-full border-[3px] border-hairline border-t-ocean ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
