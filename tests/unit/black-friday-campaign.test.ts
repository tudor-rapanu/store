import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_BLACK_FRIDAY_COPY,
  getBlackFridayCountdownTarget,
  getBlackFridayDismissKey,
  getBlackFridayPhase,
  getCountdownParts,
  isBlackFridayHiddenPath,
  normalizeBlackFridaySettings,
  resolveBlackFridayHref,
  validateBlackFridaySettings,
} from "../../src/lib/black-friday/campaign";

const campaign = normalizeBlackFridaySettings({
  enabled: true,
  teaserStartsAt: "2026-11-20T00:00:00.000Z",
  saleStartsAt: "2026-11-27T00:00:00.000Z",
  saleEndsAt: "2026-11-30T22:00:00.000Z",
  ctaHref: "/category/black-friday",
});

test("phase moves from nothing to countdown to sale to nothing", () => {
  assert.equal(getBlackFridayPhase(campaign, Date.parse("2026-11-19T23:59:59Z")), null);
  assert.equal(
    getBlackFridayPhase(campaign, Date.parse("2026-11-20T00:00:00Z")),
    "teaser",
  );
  assert.equal(
    getBlackFridayPhase(campaign, Date.parse("2026-11-27T00:00:00Z")),
    "sale",
  );
  assert.equal(getBlackFridayPhase(campaign, Date.parse("2026-11-30T22:00:00Z")), null);
});

test("disabled or undated campaigns never show", () => {
  const now = Date.parse("2026-11-28T00:00:00Z");

  assert.equal(getBlackFridayPhase({ ...campaign, enabled: false }, now), null);
  assert.equal(getBlackFridayPhase({ ...campaign, saleEndsAt: null }, now), null);
});

test("a missing teaser start shows the countdown right away", () => {
  const settings = { ...campaign, teaserStartsAt: null };

  assert.equal(
    getBlackFridayPhase(settings, Date.parse("2026-01-01T00:00:00Z")),
    "teaser",
  );
});

test("countdown targets the sale start, then the sale end", () => {
  assert.equal(
    getBlackFridayCountdownTarget(campaign, "teaser"),
    Date.parse("2026-11-27T00:00:00Z"),
  );
  assert.equal(
    getBlackFridayCountdownTarget(campaign, "sale"),
    Date.parse("2026-11-30T22:00:00Z"),
  );
});

test("countdown parts split the remaining time and never go negative", () => {
  const now = Date.parse("2026-11-25T21:58:30Z");

  assert.deepEqual(getCountdownParts(Date.parse("2026-11-27T00:00:00Z"), now), {
    days: 1,
    hours: 2,
    minutes: 1,
    seconds: 30,
  });
  assert.deepEqual(getCountdownParts(now - 1000, now), {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
});

test("validation requires dates in order and a sale link when enabled", () => {
  assert.equal(validateBlackFridaySettings(campaign), null);
  assert.equal(
    validateBlackFridaySettings({ ...campaign, enabled: false, ctaHref: "" }),
    null,
  );
  assert.match(
    validateBlackFridaySettings({ ...campaign, saleStartsAt: null }) ?? "",
    /sale start/,
  );
  assert.match(
    validateBlackFridaySettings({ ...campaign, saleEndsAt: campaign.saleStartsAt }) ??
      "",
    /end after/,
  );
  assert.match(
    validateBlackFridaySettings({
      ...campaign,
      teaserStartsAt: "2026-11-28T00:00:00.000Z",
    }) ?? "",
    /countdown must start/,
  );
  assert.match(validateBlackFridaySettings({ ...campaign, ctaHref: "" }) ?? "", /link/);
});

test("normalization fills empty copy with defaults and rejects unsafe links", () => {
  const settings = normalizeBlackFridaySettings({
    enabled: "yes",
    saleStartsAt: "not a date",
    ctaHref: "javascript:alert(1)",
    copy: { en: { teaserTitle: "  Soon  ", saleTitle: "" } },
  });

  assert.equal(settings.enabled, false);
  assert.equal(settings.saleStartsAt, null);
  assert.equal(settings.ctaHref, "");
  assert.equal(settings.copy.en.teaserTitle, "Soon");
  assert.equal(settings.copy.en.saleTitle, DEFAULT_BLACK_FRIDAY_COPY.en.saleTitle);
  assert.deepEqual(settings.copy.ro, DEFAULT_BLACK_FRIDAY_COPY.ro);
});

test("sale links get the locale prefix unless they already have one", () => {
  assert.equal(
    resolveBlackFridayHref("/category/black-friday", "ro"),
    "/ro/category/black-friday",
  );
  assert.equal(
    resolveBlackFridayHref("/en/category/black-friday", "ro"),
    "/en/category/black-friday",
  );
  assert.equal(
    resolveBlackFridayHref("https://example.com/bf", "en"),
    "https://example.com/bf",
  );
  assert.equal(resolveBlackFridayHref("", "en"), "/en");
  assert.equal(resolveBlackFridayHref("/", "ro"), "/ro");
});

test("takeover stays off checkout, auth, admin, and the sale page itself", () => {
  const ctaHref = "/ro/category/black-friday";

  assert.equal(isBlackFridayHiddenPath("/ro/checkout", ctaHref), true);
  assert.equal(isBlackFridayHiddenPath("/en/admin/orders", ctaHref), true);
  assert.equal(isBlackFridayHiddenPath("/en/login", ctaHref), true);
  assert.equal(isBlackFridayHiddenPath("/ro/category/black-friday/", ctaHref), true);
  assert.equal(isBlackFridayHiddenPath("/ro", ctaHref), false);
  assert.equal(isBlackFridayHiddenPath("/ro/products/patch", ctaHref), false);
});

test("dismissals are tracked separately for countdown and sale", () => {
  assert.notEqual(
    getBlackFridayDismissKey(campaign, "teaser"),
    getBlackFridayDismissKey(campaign, "sale"),
  );
});
