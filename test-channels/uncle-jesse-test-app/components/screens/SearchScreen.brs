sub init()
    m.keyboard = m.top.findNode("searchInput")
    m.resultsLabel = m.top.findNode("resultsLabel")
    m.resultsList = m.top.findNode("resultsList")

    m.keyboard.observeField("text", "onTextChange")

    m.allItems = []
    for each prefix in ["featured", "recent", "popular"]
        for i = 1 to 5
            m.allItems.push(prefix + "-item-" + i.toStr())
        end for
    end for
end sub

sub onTextChange()
    query = lcase(m.keyboard.text)
    if query = ""
        m.resultsLabel.text = "Type to search"
        m.resultsList.visible = false
        return
    end if

    results = createObject("RoSGNode", "ContentNode")
    count = 0
    for each title in m.allItems
        if instr(1, lcase(title), query) > 0
            item = createObject("RoSGNode", "ContentNode")
            item.title = title
            results.appendChild(item)
            count++
        end if
    end for

    if count > 0
        m.resultsList.content = results
        m.resultsList.visible = true
        m.resultsLabel.text = count.toStr() + " results"
    else
        m.resultsList.visible = false
        m.resultsLabel.text = "No results"
    end if
end sub
