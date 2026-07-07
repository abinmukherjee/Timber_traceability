/** Apple-style pill button. Variants: primary | secondary | ghost | danger. */
const VARIANTS = {
  primary: "bg-ocean text-white hover:bg-[#0077ed] disabled:bg-ocean/50",
  timber: "bg-timber text-white hover:bg-[#17833f] disabled:bg-timber/50",
  secondary:
    "bg-mist text-ink border border-hairline hover:bg-[#ececee] disabled:opacity-50",
  ghost: "bg-transparent text-ocean hover:bg-ocean/5 disabled:opacity-50",
  danger:
    "bg-danger/10 text-danger border border-danger/20 hover:bg-danger/15 disabled:opacity-50",
};

const SIZES = {
  sm: "px-3.5 py-1.5 text-sm",
  md: "px-5 py-2.5 text-[15px]",
  lg: "px-7 py-3 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight
        transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed
        ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
