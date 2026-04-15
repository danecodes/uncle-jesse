sub Main(args as Dynamic) : odcMain(args)
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    scene = screen.CreateScene("MainScene")

    screen.show() : createObject("roSGNode", "RokuODC")

    if args.mediaType <> invalid and args.mediaType <> ""
        scene.deepLinkMediaType = args.mediaType
    end if
    if args.contentId <> invalid and args.contentId <> ""
        scene.deepLinkContentId = args.contentId
    end if

    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed()
                return
            end if
        end if
    end while
end sub
