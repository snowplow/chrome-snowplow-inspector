import { h, type FunctionComponent } from "preact";

export const PageGroup: FunctionComponent<{
  pageName: string;
  events: number;
}> = ({ pageName, children, events }) => {
  return (
    <details class="event-group" open>
      <summary
        data-event-count={events.toLocaleString(undefined, {
          minimumIntegerDigits: 2,
        })}
      >
        <span title={pageName}>{pageName}</span>
      </summary>
      {children}
    </details>
  );
};
