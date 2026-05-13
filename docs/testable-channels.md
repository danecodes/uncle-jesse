# Writing Testable Channels

Uncle Jesse queries the SceneGraph XML tree that Roku exposes at `/query/app-ui`. What your tests can see depends on how your components are structured. See also: [Roku Focus Behavior](./roku-focus.md), [API Reference](./api.md).

## How ECP exposes your UI

Every SceneGraph node appears in the tree with its component type as the tag name and its fields as attributes. Custom components show up by name:

```xml
<HomePage name="homePage" focused="true">
  <HeroCarousel name="heroCarousel">
    <Button name="infoBtn" text="More Info" />
  </HeroCarousel>
</HomePage>
```

This tree is queryable with selectors like `HomePage HeroCarousel Button#infoBtn`.

## Name your components

Set the `id` field in your XML to give components a `name` attribute in the ECP tree. Without it, you can only select by tag name, which breaks when you have multiple instances of the same component.

```xml
<!-- Good: queryable as #heroCarousel or HeroCarousel#heroCarousel -->
<HeroCarousel id="heroCarousel" />

<!-- Bad: only queryable as HeroCarousel, ambiguous if there are two -->
<HeroCarousel />
```

Use stable ids, not copy, row position, or experiment names. Treat ids as a public test contract:

```xml
<!-- Good: stable across copy/layout tests -->
<Button id="playBtn" text="Watch Now" />

<!-- Bad: selector changes when copy changes -->
<Button id="watchNowBtn" text="Watch Now" />
```

Prefer a small naming convention and keep it boring:

| Node | Example |
|------|---------|
| Screen root | `HomeScreen`, `DetailsScreen`, `SearchScreen` |
| Primary regions | `hero`, `contentGrid`, `actionButtons`, `navBar` |
| Actions | `playBtn`, `resumeBtn`, `watchlistBtn` |
| Content items | `movie-123`, `series-abc`, `featured-1` |

Avoid duplicate ids anywhere that can appear in the same ECP tree. Roku exposes ids as `name` attributes; duplicate names make `#playBtn` ambiguous and can hide the element your test meant to exercise.

## Use descriptive component names

The component name in your XML definition becomes the tag in the ECP tree. `HeroCarousel` is a better selector target than `Group` or `LayoutGroup`.

```xml
<!-- Good: queryable as HomePage HeroCarousel -->
<component name="HeroCarousel" extends="Group">

<!-- Bad: queryable only as Group, not distinguishable from other Groups -->
<component name="Group" extends="Group">
```

## Set identifiable fields on ContentNode items

Built-in list components (RowList, LabelList, PosterGrid) render items as anonymous `RenderableNode` elements. The items themselves don't carry your component names. But fields set on the ContentNode (like `title`, `id`, `description`) appear as attributes on child nodes.

```brightscript
item = createObject("RoSGNode", "ContentNode")
item.title = "featured-item-1"    ' becomes title="featured-item-1"
item.id = "featured-1"            ' becomes name="featured-1" (queryable as #featured-1)
```

This lets you write selectors like `[title="featured-item-1"]` or `#featured-1`.

For test data, add attributes that help humans read failures and replay output:

```brightscript
item = createObject("RoSGNode", "ContentNode")
item.id = "movie-123"
item.title = "The Long Weekend"
item.contentType = "movie"
item.category = "featured"
item.testKey = "featured-movie-123"
```

Prefer ids for stable targeting and titles for readability. Use text selectors for assertions about copy, not as the only way to find dynamic content.

## Make focusable structure explicit

Uncle Jesse can only report the focus chain Roku exposes. Put stable ids on the nodes that own focus and on the regions that contain them:

```xml
<DetailsScreen id="detailsScreen" initialFocus="actionButtons">
  <LabelList id="actionButtons" />
</DetailsScreen>
```

When focus moves through a list, make each `ContentNode.id` unique. That gives helpers like `focusByKeys()` a deterministic target:

```typescript
await device.focusByKeys('featured-3', {
  keys: ['right'],
  maxPressesPerKey: 4,
});
```

Avoid UI that leaves an invisible branch focused while another screen is visible. If a screen is hidden, clear or transfer focus during the same state transition:

```brightscript
sub showDetails()
  m.homeScreen.visible = false
  m.detailsScreen.visible = true
  m.detailsScreen.setFocus(true)
end sub
```

This keeps `waitForFocus()`, `toBeInFocusChain()`, and replay output aligned with what the user sees.

## Avoid deep anonymous nesting

Each named component in your hierarchy is a selector anchor point. Deep trees of unnamed Groups make selectors fragile:

```xml
<!-- Hard to target the button -->
<Group>
  <Group>
    <Group>
      <Button text="Play" />
    </Group>
  </Group>
</Group>

<!-- Easy to target -->
<PlayerControls id="controls">
  <Button id="playBtn" text="Play" />
</PlayerControls>
```

## Roku focus behavior

Roku sets `focused="true"` on every node in the focus chain from the Scene root down to the leaf item. When checking focus, Uncle Jesse walks this chain and returns the deepest focused node.

The `visible` attribute is only set when explicitly `false`. Visible components have no `visible` attribute at all, so `[visible="true"]` will never match. Use `[focused="true"]` to detect which screen is active, or check that `visible` is not `"false"`.

Be careful with layout-only containers. Bounds can shift when fonts, images, or experiments change. Use layout selectors to scope a query, but target named semantic nodes or stable content attributes for the assertion:

```typescript
// Good: region scopes the query, stable id identifies the item
await device.waitForElement('HomeScreen RowList#contentGrid #featured-1');

// Fragile: only tests where the item happens to render today
await device.waitForElement('RenderableNode:nth-child(2)');
```

## LabelList and button text

LabelList renders items as `RenderableNode > LabelListItem > Label`. The button text is on the nested Label, not the RenderableNode. To find a button by text:

```typescript
// This works
this.$('Label[text="Play"]')

// This does not (RenderableNode has no text attribute)
this.$('RenderableNode[text="Play"]')
```

For critical action buttons, add stable content ids to the `LabelList` items when possible. Use `Label[text="Play"]` when the test is specifically asserting localized copy or visible button text.

## Strict channel checklist

- Screen roots have stable ids and custom component names.
- Every focusable region has a stable id.
- Every list item used by tests has a unique `ContentNode.id`.
- Dynamic content exposes readable attributes such as `title`, `contentType`, and `testKey`.
- Hidden screens do not retain focus.
- Tests avoid layout-only selectors as the final target.
- Text selectors are used for copy assertions, not as the only locator for dynamic UI.
