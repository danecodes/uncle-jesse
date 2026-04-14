sub init()
    m.navBar = m.top.findNode("navBar")
    m.homeScreen = m.top.findNode("homeScreen")
    m.searchScreen = m.top.findNode("searchScreen")
    m.settingsScreen = m.top.findNode("settingsScreen")
    m.detailsScreen = m.top.findNode("detailsScreen")
    m.videoScreen = m.top.findNode("videoScreen")
    m.currentScreen = "home"
    m.screenStack = createObject("roArray", 0, true)
    m.navBar.observeField("selectedTab", "onTabSelected")
    m.homeScreen.observeField("itemSelected", "onHomeItemSelected")
    m.detailsScreen.observeField("playSelected", "onPlaySelected")
    m.homeScreen.setFocus(true)
end sub

sub onTabSelected()
    selectedTab = m.navBar.selectedTab
    if selectedTab = m.currentScreen
        return
    end if
    showScreen(selectedTab)
end sub

sub showScreen(screenName as String)
    m.homeScreen.visible = (screenName = "home")
    m.searchScreen.visible = (screenName = "search")
    m.settingsScreen.visible = (screenName = "settings")
    m.detailsScreen.visible = false
    m.videoScreen.visible = false
    m.currentScreen = screenName
    m.screenStack.clear()
    if screenName = "home" then m.homeScreen.setFocus(true)
    if screenName = "search" then m.searchScreen.setFocus(true)
    if screenName = "settings" then m.settingsScreen.setFocus(true)
end sub

sub onHomeItemSelected()
    selectedItem = m.homeScreen.selectedItem
    if selectedItem = invalid
        return
    end if
    m.detailsScreen.content = selectedItem
    m.detailsScreen.visible = true
    m.homeScreen.visible = false
    m.detailsScreen.setFocus(true)
    m.screenStack.push("details")
end sub

sub onPlaySelected()
    m.videoScreen.content = m.detailsScreen.content
    m.videoScreen.visible = true
    m.detailsScreen.visible = false
    m.videoScreen.setFocus(true)
    m.screenStack.push("video")
end sub

sub onDeepLink()
    contentId = m.top.deepLinkContentId
    mediaType = m.top.deepLinkMediaType
    if contentId = invalid or contentId = ""
        return
    end if
    deepItem = createObject("RoSGNode", "ContentNode")
    deepItem.title = "Deep Link Item"
    deepItem.id = contentId
    deepItem.description = "Loaded via deep link"
    if mediaType = "movie" or mediaType = "episode"
        m.detailsScreen.content = deepItem
        m.detailsScreen.visible = true
        m.homeScreen.visible = false
        m.detailsScreen.setFocus(true)
        m.screenStack.push("details")
    end if
end sub

function onKeyEvent(key as String, press as Boolean) as Boolean
    if not press then return false
    if key = "back"
        if m.screenStack.count() > 0
            lastScreen = m.screenStack.pop()
            if lastScreen = "video"
                m.videoScreen.visible = false
                m.detailsScreen.visible = true
                m.detailsScreen.setFocus(true)
            else if lastScreen = "details"
                m.detailsScreen.visible = false
                showCurrentScreen()
            end if
            return true
        end if
        if m.currentScreen <> "home"
            showScreen("home")
            m.navBar.selectedIndex = 0
            return true
        end if
    end if
    if key = "up"
        if m.screenStack.count() = 0
            m.navBar.setFocus(true)
            return true
        end if
    end if
    return false
end function

sub showCurrentScreen()
    if m.currentScreen = "home"
        m.homeScreen.visible = true
        m.homeScreen.setFocus(true)
    else if m.currentScreen = "search"
        m.searchScreen.visible = true
        m.searchScreen.setFocus(true)
    else if m.currentScreen = "settings"
        m.settingsScreen.visible = true
        m.settingsScreen.setFocus(true)
    end if
end sub
