/** Apple-style page header: big tight headline + muted subtitle. */
export default function PageHeader({ eyebrow, title, subtitle }) {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-16 pb-8">
      {eyebrow && (
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-timber">
          {eyebrow}
        </p>
      )}
      <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-subtle">{subtitle}</p>
      )}
    </div>
  );
}
