import { h, type FunctionComponent } from "preact";

export const PageGroup: FunctionComponent<{
  pageName: string;
  events: number;
}> = ({ pageName, children, events }) => {
  return (
    <details class="event-group" open>
      <summary>
        <span
          data-event-count={events.toLocaleString(undefined, {
            minimumIntegerDigits: 2,
          })}
        >
          {pageName}
        </span>
      </summary>
      {children}
    </details>
  );
};
