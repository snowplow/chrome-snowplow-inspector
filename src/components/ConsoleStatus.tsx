import { h, FunctionComponent } from "preact";
import { LogIn } from "lucide-preact";

import { consoleAnalytics, landingUrl } from "../ts/analytics";
import { doOAuthFlow } from "../ts/oauth";
import { IConsoleStatus, OAuthIdentity } from "../ts/types";

const LogoOrButton: FunctionComponent<{ handler: () => void }> = ({
  handler,
  children,
}) =>
  chrome.identity ? (
    <button
      class="inline-flex items-center justify-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary)/0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      onClick={handler}
    >
      {children}
      <span>Log in</span>
    </button>
  ) : (
    // if identity not available we can't log in from here, gracefully degrade to a link
    <a
      class="inline-flex items-center justify-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary)/0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"
      href={landingUrl}
      target="_blank"
    >
      {children}
      <span>Snowplow</span>
    </a>
  );

const Profile: FunctionComponent<{ identity: OAuthIdentity }> = ({
  identity,
}) => (
  <span class="leading-none">
    {identity.picture ? (
      <img
        alt="Profile picture"
        src={identity.picture}
        class="max-h-8 rounded-full"
        style="clip-path: circle(44%)"
      />
    ) : (
      identity.name
        .split(/\s+/)
        .map((s) => s[0])
        .join("")
        .toUpperCase()
    )}
  </span>
);
export const ConsoleStatus: FunctionComponent<IConsoleStatus> = ({
  login,
  setLogin,
}) => {
  const loginHandler = () => {
    consoleAnalytics("Auth Flow Start");
    doOAuthFlow(true).then(
      (response) => {
        consoleAnalytics("Auth Flow Complete");
        setLogin(response);
      },
      (e: Error) => {
        consoleAnalytics("Auth Flow Error", String(e));
        // TODO: display error information
      },
    );
  };

  const logoutHandler = () => {
    if (!login) return;
    login.logout().finally(() => setLogin(undefined));
  };

  const { access, identity } = login ?? {};
  const { "https://snowplowanalytics.com/roles": { user } = {} } = access ?? {};

  return (
    <div class="flex flex-col items-center justify-end gap-2 mx-4 my-2">
      {identity ? (
        [
          <ul
            id="consolestatus-po"
            popover="auto"
            class="absolute left-0 z-50 mt-1 w-48 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] shadow-md focus:outline-none [&>li:last-child]:border-t [&>li:last-child]:border-[#232323] [&>li:last-child]:mt-1 [&>li:last-child]:py-3.5"
            style="position-area: top"
          >
            <li
              title={`User ID: ${user?.id}`}
              class="relative cursor-pointer select-none rounded-sm px-2 py-1.5 text-sm outline-none"
            >
              <Profile identity={identity} />
              {user?.name}
            </li>
            <li
              title={`Organization ID: ${user?.organization.id}`}
              class="relative cursor-pointer select-none rounded-sm px-2 py-1.5 text-sm outline-none"
            >
              {user?.organization.name}
            </li>
            <li
              title={`Last Login: ${identity?.updated_at}`}
              onClick={logoutHandler}
              role="button"
              tabIndex={0}
              class="relative cursor-pointer select-none rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
            >
              <img alt="" src="log-out.svg" class="mr-2 inline max-h-8" />
              Log Out
            </li>
          </ul>,
          <button
            type="button"
            popovertarget="consolestatus-po"
            class="bg-transparent border-0 hover:bg-transparent active:bg-transparent focus:bg-transparent hover:border-0 active:border-0 focus:border-0 focus:outline-none"
          >
            <Profile identity={identity} />
          </button>,
        ]
      ) : (
        <LogoOrButton handler={loginHandler}>
          <LogIn size={16} strokeWidth={2} aria-hidden="true" />
        </LogoOrButton>
      )}
    </div>
  );
};
