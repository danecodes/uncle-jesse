# Writing Testable Channels

Uncle Jesse queries the SceneGraph XML tree that Roku exposes over ECP at `/query/app-ui`. What your tests can see and interact with depends on how your channel's components are structured.

## How ECP exposes your UI

Every SceneGraph node appears in the tree with its component type as the tag name and its fields as attributes. Custom components show up by name:

```xml
<HomePage name="homePage" focused="true">
  <HomeHeroCarousel name="heroCarousel">
    <AppButton name="infoBtn" text="More Info" />
  </HomeHeroCarousel>
</HomePage>
```

This tree is queryable with selectors like `HomePage HomeHeroCarousel AppButton#infoBtn`.

## Name your components

Set the `id` field in your XML to give components a `name` attribute in the ECP tree. Without it, you can only select by tag name, which breaks when you have multiple instances of the same component.

```xml
<!-- Good: queryable as #heroCarousel or HomeHeroCarousel#heroCarousel -->
<HomeHeroCarousel id="heroCarousel" />

<!-- Bad: only queryable as HomeHeroCarousel, ambiguous if there are two -->
<HomeHeroCarousel />
```

## Use descriptive component names

The component name in your XML definition becomes the tag in the ECP tree. `HomeHeroCarousel` is a better selector target than `Group` or `LayoutGroup`.

```xml
<!-- Good: queryable as HomePage HomeHeroCarousel -->
<component name="HomeHeroCarousel" extends="Group">

<!-- Bad: queryable only as Group, not distinguishable from other Groups -->
<component name="Group" extends="Group">
```

## Set identifiable fields on ContentNode items

Built-in list components (RowList, LabelList, PosterGrid) render items as anonymous `RenderableNode` elements. The items themselves don't carry your component names. But fields set on the ContentNode (like `title`, `id`, `description`) appear as attributes on child nodes.

```brightscript
item = createObject("RoSGNode", "ContentNode")
item.title = "Action Movies Item 1"    ' becomes title="Action Movies Item 1"
item.id = "action-1"                   ' becomes name="action-1" (queryable as #action-1)
```

This lets you write selectors like `[title="Action Movies Item 1"]` or `#action-1`.

## Avoid deep anonymous nesting

Each named component in your hierarchy is a selector anchor point. Deep trees of unnamed Groups make selectors fragile:

```xml
<!-- Hard to target the button -->
<Group>
  <Group>
    <Group>
      <AppButton text="Play" />
    </Group>
  </Group>
</Group>

<!-- Easy to target -->
<PlayerControls id="controls">
  <AppButton id="playBtn" text="Play" />
</PlayerControls>
```

## Roku focus behavior

Roku sets `focused="true"` on every node in the focus chain from the Scene root down to the leaf item. When checking focus, Uncle Jesse walks this chain and returns the deepest focused node.

The `visible` attribute is only set when explicitly `false`. Visible components have no `visible` attribute at all, so `[visible="true"]` will never match. Use `[focused="true"]` to detect which screen is active, or check that `visible` is not `"false"`.

## LabelList and button text

LabelList renders items as `RenderableNode > LabelListItem > Label`. The button text is on the nested Label, not the RenderableNode. To find a button by text:

```typescript
// This works
this.$('Label[text="Play"]')

// This does not (RenderableNode has no text attribute)
this.$('RenderableNode[text="Play"]')
```
