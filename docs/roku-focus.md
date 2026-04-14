# Roku Focus Behavior

Notes on how Roku handles focus in the SceneGraph tree, learned from testing against real devices. For how to structure your channel to work well with these behaviors, see [Writing Testable Channels](./testable-channels.md). For the API that handles focus, see [API Reference](./api.md#liveelement).

## Focus chain

Roku sets `focused="true"` on the entire focus chain from the Scene root down to the leaf item. A single UI query will return multiple nodes with `focused="true"`. For example, when a grid item is focused:

```
MainScene focused="true"
  HomeScreen focused="true"
    RowList focused="true"
      RowListItem focused="true"   (active row)
        PosterGrid                 (no focused attr)
          RenderableNode focused="true"  (the actual item)
```

Uncle Jesse's `getFocusedElement()` walks this chain depth-first, following the focused child at each level, and returns the deepest node. Intermediate nodes that aren't focused (like PosterGrid) are traversed by checking their children.

## Multiple rows

In a RowList with multiple rows, Roku sets `focused="true"` on items in every row, not just the active one. Each row's PosterGrid independently tracks its own `focusItem`. The active row is the RowListItem with `focused="true"`.

Uncle Jesse handles this by walking the focus chain through the focused RowListItem, then into its PosterGrid's focused child. Items in inactive rows are ignored even though they have `focused="true"`.

## Visible attribute

Roku omits the `visible` attribute when a node is visible (the default). Only `visible="false"` appears explicitly. This means:

- `[visible="true"]` will never match anything
- To check if a screen is showing, use `[focused="true"]` or check that `visible` is not `"false"`
- `isDisplayed()` in LiveElement returns `true` when the attribute is absent or anything other than `"false"`

## List item rendering

Built-in list components (RowList, LabelList, PosterGrid) render their items as anonymous nodes:

- **RowList items**: `RenderableNode > content` with a `title` attribute from ContentNode
- **LabelList items**: `RenderableNode > LabelListItem > Label` with the text on the nested Label
- **PosterGrid items**: `RenderableNode > PosterGridItem > Poster`

ContentNode fields (`title`, `id`, `description`) appear as attributes on the rendered nodes, but the component hierarchy is determined by Roku's internal rendering, not your XML.

## Focus animation timing

After pressing a key, the focus change in the SceneGraph tree is not instantaneous. RowList animations, page transitions, and other effects mean the tree state at the moment ECP returns the keypress response may not reflect the final focus position.

Uncle Jesse's focusPath handles this with stable-focus detection: after each key press, it queries the tree twice and waits until two consecutive snapshots agree on the focused element. This typically settles in 2-3 polls (300-450ms) without needing fixed delays.

## Home screen

The Roku home screen has a dynamic app ID that varies by device and firmware. When `home()` is called, Uncle Jesse waits until the active app changes from whatever was running, rather than checking for a specific home screen ID.
