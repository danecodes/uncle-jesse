sub Main(args as Dynamic)
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    scene = screen.CreateScene("MainScene")

    if args.contentId <> invalid and args.contentId <> ""
        scene.deepLinkContentId = args.contentId
    end if
    if args.mediaType <> invalid and args.mediaType <> ""
        scene.deepLinkMediaType = args.mediaType
    end if

    screen.show()

    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed()
                return
            end if
        end if
    end while
end sub
