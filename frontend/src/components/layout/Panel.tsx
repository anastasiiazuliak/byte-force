import type { ReactNode } from 'react';

export function Panel({ id, title, children, collapsible = false }: {
  id: string;
  title: string;
  children: ReactNode;
  collapsible?: boolean;
}) {
  return (
    <section className="panel" id={id} aria-labelledby={id + '-title'}>
      {collapsible ? (
        <details open>
          <summary id={id + '-title'}>{title}</summary>
          <div className="panel-body">{children}</div>
        </details>
      ) : (
        <>
          <h2 id={id + '-title'}>{title}</h2>
          <div className="panel-body">{children}</div>
        </>
      )}
    </section>
  );
}
