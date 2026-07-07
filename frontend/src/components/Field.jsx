/** Labelled form control primitives with Apple-style inputs. */

export function Label({ children, htmlFor }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-subtle"
    >
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-[15px] text-ink " +
  "placeholder:text-subtle/60 transition-colors focus:border-ocean";

export function Input({ className = "", ...props }) {
  return <input className={`${inputClass} ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }) {
  return (
    <select className={`${inputClass} appearance-none ${className}`} {...props}>
      {children}
    </select>
  );
}

export function FormRow({ children, className = "" }) {
  return (
    <div className={`flex flex-col ${className}`}>{children}</div>
  );
}
