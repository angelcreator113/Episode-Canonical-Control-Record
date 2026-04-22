import './PageLayout.css';

/**
 * Canonical page wrapper. Gives every page a consistent max-width,
 * mobile-first horizontal padding, and top/bottom rhythm — so pages
 * stop reinventing their own container + padding (which triple-stacks
 * against App.css's .app-content padding).
 *
 * variant:
 *   default  — 1200px, app tools and dashboards
 *   wide     — 1600px, tables / boards / timelines
 *   narrow   — 720px,  forms and focused flows
 *   prose    — 680px,  story / reading (applies Lora prose font)
 */
export default function PageLayout({
  variant = 'default',
  title,
  subtitle,
  actions,
  className = '',
  children,
}) {
  const classes = ['page-layout', `page-layout--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      {(title || actions) && (
        <header className="page-layout__header">
          <div className="page-layout__titles">
            {title && <h1 className="page-layout__title">{title}</h1>}
            {subtitle && <p className="page-layout__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="page-layout__actions">{actions}</div>}
        </header>
      )}
      <div className="page-layout__content">{children}</div>
    </div>
  );
}
