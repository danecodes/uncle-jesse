sub init()
    m.titleLabel = m.top.findNode("titleLabel")
    m.descLabel = m.top.findNode("descriptionLabel")
    m.yearLabel = m.top.findNode("yearLabel")
    m.poster = m.top.findNode("poster")
    m.buttons = m.top.findNode("actionButtons")

    m.buttons.observeField("itemSelected", "onButtonSelected")

    buttons = createObject("RoSGNode", "ContentNode")
    for each label in ["Play", "Add to List", "Related"]
        btn = createObject("RoSGNode", "ContentNode")
        btn.title = label
        buttons.appendChild(btn)
    end for
    m.buttons.content = buttons
end sub

sub onContentChange()
    item = m.top.content
    if item = invalid
        return
    end if

    m.titleLabel.text = item.title
    m.descLabel.text = item.description
    m.yearLabel.text = item.releaseDate
    m.poster.uri = item.hdPosterUrl
end sub

sub onButtonSelected()
    idx = m.buttons.itemSelected
    if idx = 0
        m.top.playSelected = true
    end if
end sub
