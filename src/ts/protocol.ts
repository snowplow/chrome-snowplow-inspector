namespace TrackingProtocol {
  type ParameterType =
    | "bool"
    | "numb"
    | "doub"
    | "text"
    | "enum"
    | "emap"
    | "uuid"
    | "epoc"
    | "json"
    | "ba64";

  interface ParameterDescription {
    name: string;
    deprecated?: boolean;
    cookie?: string;
    header?: string;
  }

  type SimpleParameter = {
    type: Exclude<ParameterType, "enum" | "emap" | "ba64">;
  };
  type EnumParameter = { type: "enum"; values: readonly string[] };
  type MappedEnumParameter = { type: "emap"; values: { [ev: string]: string } };
  type B64Parameter = { type: "ba64"; then: ParameterType };

  export type Parameter = (
    | SimpleParameter
    | EnumParameter
    | MappedEnumParameter
    | B64Parameter
  ) &
    ParameterDescription;

  export type Field = keyof typeof rawParamMap;
  export type EnrichedField = keyof typeof enrichedMap;
  export type FieldGroup = { name: string; fields: TrackingProtocol.Field[] };
}

export const groupPriorities: TrackingProtocol.FieldGroup[] = [
  {
    name: "Event",
    fields: ["se_ca", "se_ac", "se_la", "se_pr", "se_va", "ue_pr", "ue_px"],
  },
  {
    name: "Transaction",
    fields: [
      "tr_id",
      "tr_af",
      "tr_tt",
      "tr_tx",
      "tr_sh",
      "tr_ci",
      "tr_st",
      "tr_co",
      "tr_cu",
      "ti_id",
      "ti_sk",
      "ti_na",
      "ti_nm",
      "ti_ca",
      "ti_pr",
      "ti_qu",
      "ti_cu",
    ],
  },
  { name: "Ad", fields: ["ad_ad", "ad_ca", "ad_ba", "ad_uid"] },
  { name: "Social", fields: ["sn", "sa", "st", "sp"] },
  { name: "Ping", fields: ["pp_mix", "pp_max", "pp_miy", "pp_may"] },
  {
    name: "Beacon",
    fields: [
      "evn",
      "e",
      "aid",
      "eid",
      "ttm",
      "dtm",
      "stm",
      "p",
      "u",
      "tid",
      "tna",
      "tv",
    ],
  },
  { name: "Entities", fields: ["cv", "co", "cx"] },
  { name: "User", fields: ["duid", "nuid", "tnuid", "uid"] },
  { name: "Session", fields: ["vid", "sid"] },
  { name: "Page", fields: ["url", "page", "refr", "ds", "cs"] },
  {
    name: "Browser",
    fields: [
      "ua",
      "fp",
      "cookie",
      "lang",
      "vp",
      "f_pdf",
      "f_fla",
      "f_java",
      "f_ag",
      "f_qt",
      "f_realp",
      "f_wma",
      "f_dir",
      "f_gears",
    ],
  },
  { name: "Device", fields: ["tz", "ip", "mac", "res", "ctype", "cd"] },
];

const rawParamMap = {
  tna: { name: "Tracker Name", type: "text" },
  evn: { name: "Event Vendor", type: "text", deprecated: true },
  aid: { name: "Application ID", type: "text" },
  p: {
    name: "Platform",
    type: "enum",
    values: ["web", "mob", "pc", "srv", "app", "tv", "cnsl", "iot"],
  },
  dtm: { name: "Device Created Timestamp", type: "epoc" },
  stm: { name: "Device Sent Timestamp", type: "epoc" },
  ttm: { name: "True Timestamp", type: "epoc" },
  tz: { name: "Client Timezone", type: "text" },
  e: {
    name: "Event Type",
    type: "emap",
    values: {
      pv: "Pageview",
      pp: "Page Ping",
      ue: "Self-Describing Event",
      tr: "Transaction",
      ti: "Transaction Item",
      se: "Structured Event",
    } as { [eventType: string]: string },
  },
  tid: { name: "Transaction ID", type: "numb", deprecated: true },
  eid: { name: "Event ID", type: "uuid" },
  tv: { name: "Tracker Version", type: "text" },
  duid: { name: "Domain User ID", type: "text" },
  nuid: { name: "Network User ID", type: "uuid", cookie: "sp" },
  tnuid: { name: "Network User ID (override)", type: "uuid" },
  uid: { name: "Client User ID", type: "text" },
  vid: { name: "Domain Session Index", type: "numb" },
  sid: { name: "Domain Session ID", type: "uuid" },
  ip: { name: "User IP Address", type: "text" },
  res: { name: "Device Resolution", type: "text" },
  url: { name: "Page URL", type: "text" },
  ua: { name: "Browser User Agent", type: "text", header: "User-Agent" },
  page: { name: "Page Title", type: "text" },
  refr: { name: "Page Referrer URL", type: "text" },
  fp: { name: "Browser Fingerprint", type: "text" },
  ctype: { name: "Connection Type", type: "text" },
  cookie: { name: "Cookies Allowed", type: "bool" },
  lang: { name: "Browser Language", type: "text", header: "Accept-Language" },
  f_pdf: { name: "PDF Support", type: "bool" },
  f_qt: { name: "QuickTime Support", type: "bool" },
  f_realp: { name: "RealPlayer Support", type: "bool" },
  f_wma: { name: "Windows Media Player Support", type: "bool" },
  f_dir: { name: "Director Support", type: "bool" },
  f_fla: { name: "Flash Support", type: "bool" },
  f_java: { name: "Java Support", type: "bool" },
  f_gears: { name: "Google Gears Support", type: "bool" },
  f_ag: { name: "Silverlight Support", type: "bool" },
  cd: { name: "Screen Colour Depth", type: "text" },
  ds: { name: "Document Size (pixels)", type: "text" },
  cs: { name: "Document Character Set", type: "text" },
  vp: { name: "Viewport Size", type: "text" },
  mac: { name: "MAC address", type: "text" },
  pp_mix: { name: "Minimum Horizontal Offset", type: "numb" },
  pp_max: { name: "Maximum Horizontal Offset", type: "numb" },
  pp_miy: { name: "Minimum Vertical Offset", type: "numb" },
  pp_may: { name: "Maximum Vertical Offset", type: "numb" },
  ad_ba: { name: "Banner ID", type: "text" },
  ad_ca: { name: "Campaign ID", type: "text" },
  ad_ad: { name: "Advertiser ID", type: "text" },
  ad_uid: { name: "User ID", type: "text" },
  tr_id: { name: "Transaction ID", type: "text" },
  tr_af: { name: "Transaction Affiliation", type: "text" },
  tr_tt: { name: "Transaction Total", type: "doub" },
  tr_tx: { name: "Transaction Tax", type: "doub" },
  tr_sh: { name: "Transaction Shipping", type: "doub" },
  tr_ci: { name: "Transaction City", type: "text" },
  tr_st: { name: "Transaction State", type: "text" },
  tr_co: { name: "Transaction Country", type: "text" },
  tr_cu: { name: "Transaction Currency", type: "text" },
  ti_id: { name: "Item Transaction ID", type: "text" },
  ti_sk: { name: "Item SKU", type: "text" },
  ti_na: { name: "Item Name", type: "text" },
  ti_nm: { name: "Item Name", type: "text" },
  ti_ca: { name: "Item Category", type: "text" },
  ti_pr: { name: "Item Price", type: "doub" },
  ti_qu: { name: "Item Quantity", type: "numb" },
  ti_cu: { name: "Item Currency", type: "text" },
  sa: { name: "Social Action", type: "text" },
  sn: { name: "Social Network", type: "text" },
  st: { name: "Social Target", type: "text" },
  sp: { name: "Social Pagepath", type: "text" },
  se_ca: { name: "Event Category", type: "text" },
  se_ac: { name: "Event Action", type: "text" },
  se_la: { name: "Event Label", type: "text" },
  se_pr: { name: "Event Property", type: "text" },
  se_va: { name: "Event Value", type: "doub" },
  ue_pr: { name: "Self-Describing Event", type: "json" },
  ue_px: { name: "Self-Describing Event", type: "ba64", then: "json" },
  cv: { name: "Entity Vendor", type: "text", deprecated: true },
  co: { name: "Custom Entity", type: "json" },
  cx: { name: "Custom Entity", type: "ba64", then: "json" },
  u: { name: "Redirect To", type: "text" },
} as const;

type ParamMap = {
  [F in TrackingProtocol.Field]: TrackingProtocol.Parameter;
};

export const paramMap: ParamMap = rawParamMap;

const enrichedMap = {
  app_id: "aid",
  platform: "p",
  etl_tstamp: "",
  collector_tstamp: "",
  dvce_created_tstamp: "dtm",
  event: "e",
  event_id: "eid",
  txn_id: "tid",
  name_tracker: "tna",
  v_tracker: "tv",
  v_collector: "",
  v_etl: "",
  user_id: "uid",
  user_ipaddress: "ip",
  user_fingerprint: "fp",
  domain_userid: "duid",
  domain_sessionidx: "vid",
  network_userid: "nuid",
  geo_country: "",
  geo_region: "",
  geo_city: "",
  geo_zipcode: "",
  geo_latitude: "",
  geo_longitude: "",
  geo_region_name: "",
  ip_isp: "",
  ip_organization: "",
  ip_domain: "",
  ip_netspeed: "",
  page_url: "url",
  page_title: "page",
  page_referrer: "refr",
  page_urlscheme: "",
  page_urlhost: "",
  page_urlport: "",
  page_urlpath: "",
  page_urlquery: "",
  page_urlfragment: "",
  refr_urlscheme: "",
  refr_urlhost: "",
  refr_urlport: "",
  refr_urlpath: "",
  refr_urlquery: "",
  refr_urlfragment: "",
  refr_medium: "",
  refr_source: "",
  refr_term: "",
  mkt_medium: "",
  mkt_source: "",
  mkt_term: "",
  mkt_content: "",
  mkt_campaign: "",
  contexts: "",
  se_category: "se_ca",
  se_action: "se_ac",
  se_label: "se_la",
  se_property: "se_pr",
  se_value: "se_va",
  unstruct_event: "",
  tr_orderid: "tr_id",
  tr_affiliation: "tr_af",
  tr_total: "tr_tt",
  tr_tax: "tr_tx",
  tr_shipping: "tr_sh",
  tr_city: "tr_ci",
  tr_state: "tr_st",
  tr_country: "tr_co",
  ti_orderid: "ti_id",
  ti_sku: "ti_sk",
  ti_name: "ti_na",
  ti_category: "ti_ca",
  ti_price: "ti_pr",
  ti_quantity: "ti_qu",
  pp_xoffset_min: "pp_mix",
  pp_xoffset_max: "pp_max",
  pp_yoffset_min: "pp_miy",
  pp_yoffset_max: "pp_may",
  useragent: "ua",
  br_name: "",
  br_family: "",
  br_version: "",
  br_type: "",
  br_renderengine: "",
  br_lang: "lang",
  br_features_pdf: "f_pdf",
  br_features_flash: "f_fla",
  br_features_java: "f_java",
  br_features_director: "f_dir",
  br_features_quicktime: "f_qt",
  br_features_realplayer: "f_realp",
  br_features_windowsmedia: "f_wma",
  br_features_gears: "f_gears",
  br_features_silverlight: "f_ag",
  br_cookies: "cookie",
  br_colordepth: "cd",
  br_viewwidth: "res",
  br_viewheight: "res",
  os_name: "",
  os_family: "",
  os_manufacturer: "",
  os_timezone: "",
  dvce_type: "",
  dvce_ismobile: "",
  dvce_screenwidth: "vp",
  dvce_screenheight: "vp",
  doc_charset: "cs",
  doc_width: "ds",
  doc_height: "ds",
  tr_currency: "tr_cu",
  tr_total_base: "",
  tr_tax_base: "",
  tr_shipping_base: "",
  ti_currency: "ti_cu",
  ti_price_base: "",
  base_currency: "",
  geo_timezone: "tz",
  mkt_clickid: "",
  mkt_network: "",
  etl_tags: "",
  dvce_sent_tstamp: "stm",
  refr_domain_userid: "",
  refr_device_tstamp: "",
  derived_contexts: "",
  domain_sessionid: "sid",
  derived_tstamp: "",
  event_vendor: "",
  event_name: "",
  event_format: "",
  event_version: "",
  event_fingerprint: "",
  true_tstamp: "ttm",
} as const;

export const esMap: Record<
  TrackingProtocol.EnrichedField,
  TrackingProtocol.Field | ""
> = enrichedMap;

export const gaMap = {
  t: {
    name: "hitType",
    type: "emap",
    values: {
      pageview: "GA Pageview",
      screenview: "GA Screenview",
      event: "GA Event",
      transaction: "GA Transaction",
      item: "GA Item",
      social: "GA Social",
      exception: "GA Exception",
      timing: "GA Timing",
    } as { [eventType: string]: string },
  },
} as const;

export const protocol = {
  esMap,
  groupPriorities,
  paramMap,
  gaMap,
};
