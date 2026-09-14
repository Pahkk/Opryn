export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="opryn-page-heading mb-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="opryn-page-heading__copy min-w-0">
          {eyebrow ? <p className="opryn-page-kicker mb-3">{eyebrow}</p> : null}
          <h1 className="opryn-page-title">{title}</h1>
          {description ? (
            <p className="opryn-page-description mt-3 max-w-2xl">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="opryn-page-heading__actions shrink-0">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="opryn-empty-state">
      {icon ? (
        <span
          aria-hidden="true"
          className="grid size-12 place-items-center rounded-[14px] border border-[#d7e3f3] bg-[#eff5fd] text-[var(--opryn-blue)] [&_svg]:size-5"
        >
          {icon}
        </span>
      ) : null}
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? (
        <div className="opryn-empty-state__action">{action}</div>
      ) : null}
    </div>
  );
}
