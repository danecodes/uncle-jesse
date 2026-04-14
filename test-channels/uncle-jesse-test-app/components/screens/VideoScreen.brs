sub init()
    m.player = m.top.findNode("videoPlayer")
    m.titleLabel = m.top.findNode("videoTitle")

    m.top.observeField("visible", "onVisibleChange")
end sub

sub onContentChange()
    item = m.top.content
    if item = invalid
        return
    end if

    m.titleLabel.text = item.title

    videoContent = createObject("RoSGNode", "ContentNode")
    videoContent.url = item.url
    videoContent.streamFormat = item.streamFormat
    videoContent.title = item.title
    m.player.content = videoContent
end sub

sub onVisibleChange()
    if m.top.visible
        m.player.control = "play"
    else
        m.player.control = "stop"
    end if
end sub
