import type { Har } from "har-format";

import { default as microGet } from "./micro-get.har.json" with { type: "json" };
import { default as microPost } from "./micro-post.har.json" with { type: "json" };
import { default as microCustom } from "./micro-postpath.har.json" with { type: "json" };
import { default as badPayloadViolation } from "./collector_payload_format_violation.json" with { type: "json" };

export const micro: Record<string, Har> = {
  get: microGet,
  post: microPost,
  custom: microCustom,
};

export const bad = {
  collector_payload_format_violation: badPayloadViolation,
} as const;
