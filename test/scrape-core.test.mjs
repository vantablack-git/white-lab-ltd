import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTargetUrl, buildDocumentation } from "../shared/scrape-core.mjs";

test("normalizeTargetUrl rejects local hosts", () => {
  assert.throws(() => normalizeTargetUrl("http://localhost/docs"), /not allowed/);
});

test("normalizeTargetUrl accepts https URLs", () => {
  const url = normalizeTargetUrl("https://example.com/path");
  assert.equal(url, "https://example.com/path");
});

test("buildDocumentation wraps markdown with freelancer template", () => {
  const doc = buildDocumentation({
    url: "https://example.com",
    markdown: "# Example\n\nHello world.",
    template: "freelancer",
    provider: "test",
  });
  assert.match(doc, /# Example/);
  assert.match(doc, /Freelancer deliverable draft/);
  assert.match(doc, /Hello world\./);
});
