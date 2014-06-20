
require("extras/buffer-mgr.js");


function start_capture(buffer) {
    var spec = buffer.current_uri.spec;
    if (!('capture_args' in buffer)) {
        dump(">> NO capture :" + spec + "\n");
        return;
    }

    if (!buffer.force_capture) {
        if (buffer.capturing) {
            // dump("<!> Already captured: " + spec + "\n");
            return;
        }
        
        if (!buffer.buffer_loaded) {
            dump("<!> Wating for loading buffer ......" + spec + "\n");
            return;
        }

        if (!buffer.player_loaded) {
            dump("<!> Wating for loading player......." + spec + "\n");
            return;
        }

        if (buffer.is_64ma && !buffer.stream_ready) {
            dump("??? Not ready to capture: " + spec + ", finished=" + buffer.buffer_loaded
                 + ", stream_ready="+ buffer.stream_ready + "\n");
            return;
        }
        
        if (spec === "about:blank") {
            dump("@@@ Empty buffer\n");
            return;
        }
    }

    buffer.force_capture_timer.cancel();
    buffer.player_load_timer.cancel();
    
    buffer.capturing = true;
    buffer.reload_retry = 0;

    var args = buffer.capture_args;
    
    // var sub_src_url = args.sub_src_url;
    var delay = buffer.force_capture ? 0 : args.delay;
    var path = args.path;
    var name = args.name;
    buffer.window.buffers.current = buffer;
    

    dump("Ready to capture:" + spec + " : delay=" + delay +  + "\n");
    buffer.capture_log.push((new Date())
                            + ": Ready to capture: force_capture=" + buffer.force_capture
                            + ", buffer_loaded=" + buffer.buffer_loaded
                            + ", player_loaded=" + buffer.player_loaded
                            + ", is_64ma=" + buffer.is_64ma
                            + ", stream_ready=" + buffer.stream_ready);
    
            
    var topitem = find_all_win_objects(null, buffer.browser, 0);
    var items = collect_objects(topitem);
    items.push(topitem);
    buffer.topitem = topitem;
    buffer.capture_items = items;
    
    // **TMP**
    var event = {
        notify: function(){
            if (!buffer.force_capture) {
                buffer.window.buffers.current = buffer;
            }
            buffer.capture_log.push((new Date()) + ": Capturing.....");
            dump("Capturing........" + spec + "\n");

            var result = {
                full_page : null,
                flashes : []
            };
            
            try{
                result = save_capture(buffer.capture_items, path, name);
            } catch( err ) {
                dump("Save capture error:" + err + "\n");
            }
            
            result.is_64ma = buffer.is_64ma;
            result.log = buffer.capture_log;
            var msg = JSON.stringify(result) + "\n";
            dump(msg);
            dump(">>> Going to kill buffer:" + spec + "\n");
            kill_buffer_background(buffer, msg);
        }
    };
    buffer.capture_log.push((new Date()) + ": Start capture timer.");
    var capture_timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
    capture_timer.initWithCallback(event, delay, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
    buffer.capture_timer = capture_timer;
}


function save_file(win, data, path) {
    var file = Components.classes["@mozilla.org/file/local;1"]
            .createInstance(Components.interfaces.nsILocalFile);
    
    file.initWithPath(path); //!!!!!!!!!!!!!!!!!!!!!
    dump(">>> Save capture file to:" + path + "\n");
    
    var wbp = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1']
            .createInstance(Components.interfaces.nsIWebBrowserPersist);
    var ios = Components.classes['@mozilla.org/network/io-service;1']
            .getService(Components.interfaces.nsIIOService);
    var uri = ios.newURI(data, null, null);
    wbp.persistFlags &= ~Components.interfaces.nsIWebBrowserPersist.PERSIST_FLAGS_NO_CONVERSION; // don't save gzipped
    var privacyContext = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                                     .getInterface(Components.interfaces.nsIWebNavigation)
                                     .QueryInterface(Components.interfaces.nsILoadContext);
    
    wbp.saveURI(uri, null, null, null, null, file, privacyContext);
    return path;
}

function save_capture(items, local_path, name) {
    var saved_path = {
        full_page : null,
        flashes : []
    };
    
    dump(">> save_capture().items.length:" + items.length + "\n");
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var win = item.win;
        var rect = item.rect;
        var doc = win.document;
        var html = doc.documentElement;

        if (doc.body == null) {
            dump("No body Element\n");
            continue;
        }

        dump(">> save_capture().rect:" + JSON.stringify(rect) + "\n");
        var canvas = doc.createElement("canvas");
        canvas.width = rect.width; 
        canvas.height = rect.height; // need refinement
        canvas.style.display = 'none';
        doc.body.appendChild(canvas);

        var ctx = canvas.getContext("2d");
        ctx.drawWindow(win, rect.left, rect.top, rect.width, rect.height, 'rgb(255, 255, 255)');

        var data = canvas.toDataURL();
        // dump("\n\n" + canvas.toDataURL());
        var fname = name;
        if (!('sub_iframes' in item)) {
            fname = name + "_OBJECT_" + i; // + "_" + item.name_suffix;
        } else {
            fname = name + "_full";
        }
        
        var path = save_file(win, data, local_path + fname + '.png');
        if ('sub_iframes' in item) {
            saved_path.full_page = path;
        } else {
            saved_path.flashes.push(path);
        }
        canvas.remove();
    }
    return saved_path;
}

interactive("save-capture", "Save page capture",
            function(I) {
                var topitem = find_all_win_objects(null, I.buffer.browser, 0);
                var items = collect_objects(topitem);
                items.push(topitem);
                I.buffer.save_capture_timer = call_after_timeout(function() {
                    save_capture(items, '/home/weet/tmp/', 'output_new');
                }, 5000);
            });

