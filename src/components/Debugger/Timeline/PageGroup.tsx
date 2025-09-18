import { h, type FunctionComponent } from "preact";

export const PageGroup: FunctionComponent<{
  pageName: string;
}> = ({ pageName, children }) => {
  return (
    <article class="event-group">
      <h1 class="event-group__heading" title="Group Name">
        {pageName}
      </h1>
      {children}
    </article>
  );
};
