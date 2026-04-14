sub init()
    m.grid = m.top.findNode("contentGrid")
    m.grid.observeField("rowItemSelected", "onItemSelected")
    m.grid.observeField("rowItemFocused", "onItemFocused")

    loadContent()
end sub

sub loadContent()
    rows = createObject("RoSGNode", "ContentNode")

    categories = [
        { title: "Featured", prefix: "featured" },
        { title: "Recently Added", prefix: "recent" },
        { title: "Popular", prefix: "popular" }
    ]

    for each cat in categories
        row = createObject("RoSGNode", "ContentNode")
        row.title = cat.title

        for i = 1 to 5
            item = createObject("RoSGNode", "ContentNode")
            item.title = cat.prefix + "-item-" + i.toStr()
            item.id = cat.prefix + "-" + i.toStr()
            item.description = cat.title + " item number " + i.toStr()
            item.releaseDate = "2024"
            item.hdPosterUrl = "https://picsum.photos/230/130?random=" + cat.prefix + i.toStr()
            item.url = "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
            item.streamFormat = "mp4"
            row.appendChild(item)
        end for

        rows.appendChild(row)
    end for

    m.grid.content = rows
end sub

sub onItemSelected()
    sel = m.grid.rowItemSelected
    if sel.count() < 2
        return
    end if
    item = m.grid.content.getChild(sel[0]).getChild(sel[1])
    m.top.selectedItem = item
    m.top.itemSelected = item
end sub

sub onItemFocused()
    ' track focused item for external queries
    focused = m.grid.rowItemFocused
    if focused.count() >= 2
        item = m.grid.content.getChild(focused[0]).getChild(focused[1])
        m.top.selectedItem = item
    end if
end sub

sub onVisibleChange()
    if m.top.visible
        m.grid.setFocus(true)
    end if
end sub
