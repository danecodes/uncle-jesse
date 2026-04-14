sub init()
    m.list = m.top.findNode("settingsList")
    m.statusLabel = m.top.findNode("statusLabel")

    m.list.observeField("itemSelected", "onItemSelected")

    content = createObject("RoSGNode", "ContentNode")
    for each label in ["Closed Captions: Off", "Audio Language: English", "Video Quality: Auto", "Notifications: On", "About"]
        item = createObject("RoSGNode", "ContentNode")
        item.title = label
        content.appendChild(item)
    end for
    m.list.content = content

    m.settings = {
        captions: false,
        language: "English",
        quality: "Auto",
        notifications: true
    }
end sub

sub onItemSelected()
    idx = m.list.itemSelected
    content = m.list.content

    if idx = 0
        m.settings.captions = not m.settings.captions
        label = "Closed Captions: " + iif(m.settings.captions, "On", "Off")
        content.getChild(0).title = label
        m.statusLabel.text = label
    else if idx = 3
        m.settings.notifications = not m.settings.notifications
        label = "Notifications: " + iif(m.settings.notifications, "On", "Off")
        content.getChild(3).title = label
        m.statusLabel.text = label
    else if idx = 4
        m.statusLabel.text = "Uncle Jesse Test App v1.0"
    end if
end sub

function iif(condition as Boolean, trueVal as String, falseVal as String) as String
    if condition then return trueVal
    return falseVal
end function
