import { h, type FunctionComponent } from "preact";

import { consoleAnalytics, landingUrl } from "../ts/analytics";
import { doOAuthFlow } from "../ts/oauth";
import type { IConsoleStatus, OAuthIdentity } from "../ts/types";

import "./ConsoleStatus.css";
import logo from "@res/logo.svg";
import logOut from "@res/log-out.svg";

const LogoOrButton: FunctionComponent<{ handler: () => void }> = ({
  handler,
  children,
}) =>
  chrome.identity ? (
    <button class="console" onClick={handler}>
      {children} Log in
    </button>
  ) : (
    // if identity not available we can't log in from here, gracefully degrade to a link
    <a class="toolbar__logo" href={landingUrl} target="_blank">
      {children} Snowplow
    </a>
  );

const Profile: FunctionComponent<{ identity: OAuthIdentity }> = ({
  identity,
}) => (
  <span class="profile">
    {identity.picture ? (
      <img alt="Profile picture" src={identity.picture} />
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
    <div class="console_info">
      {identity ? (
        [
          <ul id="consolestatus-po" popover="auto">
            <li title={`User ID: ${user?.id}`}>
              <Profile identity={identity} />
              {user?.name}
            </li>
            <li title={`Organization ID: ${user?.organization.id}`}>
              {user?.organization.name}
            </li>
            <li
              title={`Last Login: ${identity?.updated_at}`}
              onClick={logoutHandler}
              role="button"
              tabIndex={0}
            >
              <img alt="" src={logOut} />
              Log Out
            </li>
          </ul>,
          <button type="button" popovertarget="consolestatus-po">
            <Profile identity={identity} />
          </button>,
        ]
      ) : (
        <LogoOrButton handler={loginHandler}>
          <img alt="Snowplow logo" src={logo} />
        </LogoOrButton>
      )}
    </div>
  );
};
