import { describe, expect, test } from "@jest/globals";
import { getOrgIdFromJWT } from "./jwtUtils";
import type { OAuthResult, OAuthAccess, OAuthIdentity } from "./types";

describe("getOrgIdFromJWT", () => {
  const mockIdentity: OAuthIdentity = {
    iss: "https://example.com",
    sid: "session-id",
    name: "Test User",
    sub: "user-123",
    updated_at: "2024-01-01T00:00:00Z",
    picture: "https://example.com/picture.jpg",
  };

  const mockAuthentication = {
    headers: { Authorization: "Bearer test-token" },
  };

  const mockLogout = async () => "logged-out";

  test("extracts org ID from valid JWT", () => {
    const mockAccess: OAuthAccess = {
      exp: Date.now() + 3600000,
      "https://snowplowanalytics.com/roles": {
        user: {
          id: "user-123",
          name: "Test User",
          organization: {
            id: "org-456",
            name: "Test Org",
          },
        },
        groups: [],
      },
    };

    const login: OAuthResult = {
      identity: mockIdentity,
      access: mockAccess,
      authentication: mockAuthentication,
      logout: mockLogout,
    };

    expect(getOrgIdFromJWT(login)).toBe("org-456");
  });

  test("returns undefined for undefined login", () => {
    expect(getOrgIdFromJWT(undefined)).toBeUndefined();
  });

  test("returns undefined when access token is missing", () => {
    const login = {
      identity: mockIdentity,
      access: undefined as any,
      authentication: mockAuthentication,
      logout: mockLogout,
    };

    expect(getOrgIdFromJWT(login)).toBeUndefined();
  });

  test("returns undefined when roles are missing", () => {
    const mockAccess = {
      exp: Date.now() + 3600000,
    } as OAuthAccess;

    const login: OAuthResult = {
      identity: mockIdentity,
      access: mockAccess,
      authentication: mockAuthentication,
      logout: mockLogout,
    };

    expect(getOrgIdFromJWT(login)).toBeUndefined();
  });

  test("returns undefined when organization is missing", () => {
    const mockAccess: OAuthAccess = {
      exp: Date.now() + 3600000,
      "https://snowplowanalytics.com/roles": {
        user: {
          id: "user-123",
          name: "Test User",
          organization: undefined as any,
        },
        groups: [],
      },
    };

    const login: OAuthResult = {
      identity: mockIdentity,
      access: mockAccess,
      authentication: mockAuthentication,
      logout: mockLogout,
    };

    expect(getOrgIdFromJWT(login)).toBeUndefined();
  });

  test("returns undefined when organization ID is missing", () => {
    const mockAccess: OAuthAccess = {
      exp: Date.now() + 3600000,
      "https://snowplowanalytics.com/roles": {
        user: {
          id: "user-123",
          name: "Test User",
          organization: {
            id: undefined as any,
            name: "Test Org",
          },
        },
        groups: [],
      },
    };

    const login: OAuthResult = {
      identity: mockIdentity,
      access: mockAccess,
      authentication: mockAuthentication,
      logout: mockLogout,
    };

    expect(getOrgIdFromJWT(login)).toBeUndefined();
  });
});
