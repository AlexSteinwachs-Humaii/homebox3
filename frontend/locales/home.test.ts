import { IntlMessageFormat } from "intl-messageformat";
import { expect, test } from "vitest";
import messages from "./en.json";

test.each([
  [0, "0 items", "0 locations"],
  [1, "1 item", "1 location"],
  [2, "2 items", "2 locations"],
])("Home count copy uses the app's ICU pluralization for %s", (count, items, locations) => {
  expect(new IntlMessageFormat(messages.home.item_count, "en").format({ count })).toBe(items);
  expect(new IntlMessageFormat(messages.home.location_count, "en").format({ count })).toBe(locations);
  expect(new IntlMessageFormat(messages.home.welcome_counts, "en").format({ items, locations })).toBe(
    `${items} across ${locations}.`
  );
});

test("collection and user names are interpolated as data", () => {
  const collection = "Studio {north} & tools";
  expect(new IntlMessageFormat(messages.home.collection_overview, "en").format({ collection })).toBe(
    `${collection} · Collection overview`
  );
  expect(new IntlMessageFormat(messages.home.welcome_home, "en").format({ name: "Morgan" })).toBe(
    "Welcome home, Morgan."
  );
});
