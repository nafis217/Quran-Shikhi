import type { ReactNode } from 'react';

/** The hero panel every main page opens with: a small label, a large title, a line of text and something on the side. */
export function PageHero({ overline, title, sub, aside, compact, children }: { overline?: string; title: ReactNode; sub?: ReactNode; aside?: ReactNode; compact?: boolean; children?: ReactNode }) {
  return (
    <section className={`hero2 page-hero${compact ? ' compact' : ''}`}>
      <div className="hero2-pattern" aria-hidden="true" />
      <div className="hero2-body">
        {overline && <p className="overline">{overline}</p>}
        <h1 className="hero2-title">{title}</h1>
        {sub && <p className="hero2-sub">{sub}</p>}
        {children}
      </div>
      {aside && <div className="hero2-side">{aside}</div>}
    </section>
  );
}
