' roku-odc: Launch hook for pre-launch configuration
sub odcMain(args as object)
  if args.odc_clear_registry = "true"
    registry = createObject("roRegistry")
    for each name in registry.getSectionList()
      registry.delete(name)
    end for
    registry.flush()
  end if

  if args.odc_registry <> invalid
    data = parseJson(args.odc_registry)
    if data <> invalid
      registry = createObject("roRegistry")
      for each item in data.items()
        section = createObject("roRegistrySection", item.key)
        for each entry in item.value.items()
          if entry.value = invalid
            section.delete(entry.key)
          else
            valStr = entry.value
            if getInterface(valStr, "ifToStr") <> invalid
              valStr = valStr.toStr()
            else
              valStr = formatJson(valStr)
            end if
            section.write(entry.key, valStr)
          end if
        end for
        section.flush()
      end for
      registry.flush()
    end if
  end if

  if args.odc_channel_data <> invalid
    store = createObject("roChannelStore")
    store.storeChannelCredData(args.odc_channel_data)
  end if

  if args.odc_entry_point <> invalid
    if args.odc_entry_point = "screensaver"
      RunScreenSaver()
    else if args.odc_entry_point = "screensaver-settings"
      RunScreenSaverSettings()
    end if

    if args.odc_entry_point <> "channel"
      END
    end if
  end if
end sub
