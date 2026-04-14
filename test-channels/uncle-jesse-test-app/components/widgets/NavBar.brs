sub init()
    m.tabs = [
        m.top.findNode("tabHome"),
        m.top.findNode("tabSearch"),
        m.top.findNode("tabSettings")
    ]
    m.tabIds = ["home", "search", "settings"]
    m.focusIndex = 0

    updateHighlight()
end sub

sub onIndexChange()
    m.focusIndex = m.top.selectedIndex
    updateHighlight()
end sub

sub updateHighlight()
    for i = 0 to m.tabs.count() - 1
        m.tabs[i].selected = (i = m.focusIndex)
    end for
end sub

function onKeyEvent(key as String, press as Boolean) as Boolean
    if not press then return false

    if key = "right" and m.focusIndex < m.tabs.count() - 1
        m.focusIndex++
        updateHighlight()
        return true
    else if key = "left" and m.focusIndex > 0
        m.focusIndex--
        updateHighlight()
        return true
    else if key = "OK" or key = "down"
        m.top.selectedTab = m.tabIds[m.focusIndex]
        return (key = "OK")
    end if

    return false
end function
