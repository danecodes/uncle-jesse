sub init()
    m.label = m.top.findNode("tabLabel")
    m.bg = m.top.findNode("tabBackground")
end sub

sub onTextChange()
    m.label.text = m.top.text
end sub

sub onSelectedChange()
    if m.top.selected
        m.label.color = "0xffffffff"
        m.bg.color = "0x333366ff"
    else
        m.label.color = "0xaaaaaaff"
        m.bg.color = "0x00000000"
    end if
end sub
