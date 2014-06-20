


function kill_buffer_background(buffer, msg) {
    
    try{
        var uri = '[None]';
        try {
            uri = buffer.current_uri.spec;
        } catch (uri_err) {
            dump("Get uri error:" + uri_err + "\n");
        }

        try {
            if (msg == null)  {
                var result = {
                    full_page : null,
                    flashes : []
                };
                msg = JSON.stringify(result) + "\n";
            }
            var connection = buffer.connection;
            connection.output.write(msg, msg.length);
            connection.output.flush();
            connection.output.close();
            connection.input.close();
        } catch (conn_err) {
            dump("Close connection error:" + conn_err + "\n");
        }

        dump(">>> Connection closed!!! \n");
        dump(">>> Kill buffer background:" + uri + "\n");
        var uuid = buffer.uuid;
        kill_buffer(buffer, true);
        
        if (uuid in capture_buffers) {
            dump(">>> Remove buffer uuid:" + buffer.uuid  + " - " + uri + "\n");
            delete capture_buffers[uuid];
        } else {
            dump("Buffer of uuid already removed? uuid:" + uuid + "\n");
        }
        
        dump(">>> Kill successfully!::" + uri + "\n");
    } catch (err) {
        dump("Kill buffer error:" + err + "\n");
    }
}

function buffer_load_finished(buffer) {
    if ("capture_args" in buffer && !buffer.buffer_loaded) {
        buffer.buffer_loaded = true;
        buffer.capture_log.push((new Date()) + ': Buffer load finished!');

        // Select channel
        var topitem = find_all_win_objects(null, buffer.browser, 0);
        
        for (var i = 0; i < CHANNEL_SELECTORS.length; i++) {
            var selector = CHANNEL_SELECTORS[i];
            var sidebar_frame = find_frame_by_src(topitem, selector.frame_src);
            if (sidebar_frame != null) {
                var _doc = sidebar_frame.contentDocument;
                var frame_src = sidebar_frame.src;
                inject_script(_doc, selector.script);
                buffer.stream_ready = false;
                buffer.capture_log.push((new Date()) + ": Inject script to select cctv5 channel.: " + sidebar_frame.src);
                buffer.channel_selected = true;
            }
        }

        /*
        var target_srcs = ["list.asp", "ggwl=list", "http://www.letvlive.com/tvlive.php"];
        for (var i = 0; i < target_srcs.length; i++) {
            sidebar_frame = find_frame_by_src(topitem, target_srcs[i]);
            if (sidebar_frame != null)
                break;
        }
        if (sidebar_frame != null) {
            var _doc = sidebar_frame.contentDocument;
            var _script;
            var frame_src = sidebar_frame.src;

            for (var j = 0; j < CHANNEL_SELECTORS.length; j++) {
                var selector = CHANNEL_SELECTORS[i];
                if (frame_src.indexOf(selector.frame_src) > -1) {
                    inject_script(_doc, _script);
                    buffer.stream_ready = false;
                    buffer.capture_log.push((new Date()) + ": Inject script to select cctv5 channel.: " + sidebar_frame.src);
                    buffer.channel_selected = true;
                }
            }
            // if (frame_src.indexOf("list.asp") > -1) {
            //     _script = "var CHT_3 = document.getElementById('CHT_3'); CHT_3.firstElementChild.click();";
            // }
            // else if (frame_src.indexOf("ggwl=list") > -1) {
            //     // http://www.qd520.com/
            //     _script = "var cp_3=document.getElementById('cp_3'); var kp_3 = document.getElementById('kp_3'); kp_3.children[3].onclick();";
            // } else if (frame_src.indexOf("http://www.letvlive.com/tvlive.php") > -1) {
            //     // http://www.letvlive.com/
            //     _script = "var cctv5=document.getElementById('cctv5'); cctv5.click();";
            // }
            
        }
         */
        start_capture(buffer);
    }
}
add_hook("content_buffer_finished_loading_hook", buffer_load_finished);

function timeout_force_capture(buffer, timeout) {
    var force_capture_timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
    var capture_event = {
        notify: function() {
            buffer.force_capture = true;
            start_capture(buffer);
            buffer.capture_args.name = "force_" + buffer.capture_args.name;
            buffer.capture_log.push((new Date()) + ": Timeout: force capture");
            dump("<!!!> Force capture:" + buffer.current_uri.spec + "\n");
        }
    };
    force_capture_timer.initWithCallback(capture_event, timeout, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
    buffer.force_capture_timer = force_capture_timer;
}


function timeout_force_kill_self(buffer, timeout) {
    var spec = buffer.current_uri.spec;
    var kill_self_timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
    var kill_event = {
        notify: function() {
            dump("TIMEOUT force kill self:" + spec + "\n");
            buffer.capture_log.push((new Date()) + ": Timeout force kill self.");
            var result = {
                full_page : null,
                flashes : []
            };
            result.log = buffer.capture_log;
            var msg = JSON.stringify(result) + "\n";
            kill_buffer_background(buffer, msg);
        }
    };
    kill_self_timer.initWithCallback(kill_event, timeout, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
    buffer.kill_self_timer = kill_self_timer;
}

function timeout_buffer_load(buffer, timeout) {
    buffer.reload_retry = 3;
    var buffer_load_timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
    var reload_delay = timeout;
    var reload_event = {
        notify: function() {
            buffer.reload_retry -= 1;
            if (buffer.reload_retry > 0) {
                buffer.buffer_loaded = false;
                buffer.channel_selected = false;
                buffer.capture_log.push((new Date()) + ": Load buffer timeout reload buffer, " + buffer.reload_retry);
                dump(">> Time out reload buffer:" + buffer.reload_retry
                     + ", " + reload_delay + "," + buffer.current_uri.spec + "\n" );
                reload(buffer, null, null, null);
                
                reload_delay += timeout/2;
                buffer_load_timer.initWithCallback(reload_event, reload_delay, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
            } 
        }
    };
    buffer_load_timer.initWithCallback(reload_event, reload_delay, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
    buffer.buffer_load_timer = buffer_load_timer;
}


function timeout_player_load(buffer, timeout) {
    buffer.player_load_retry = 3;
    var player_load_timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
    var delay = timeout;
    var reload_event = {
        notify: function() {
            buffer.player_load_retry -= 1;
            if (buffer.player_load_retry > 0) {
                buffer.player_loaded = false;
                buffer.capture_log.push((new Date()) + ": Load player timeout reload buffer, " + buffer.player_load_retry);
                dump(">> Time out reload buffer:" + buffer.player_load_retry
                     + ", " + delay + "," + buffer.current_uri.spec + "\n" );
                reload(buffer, null, null, null);
                player_load_timer.initWithCallback(reload_event, delay, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
            } 
        }
    };
    player_load_timer.initWithCallback(reload_event, delay, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
    buffer.player_load_timer = player_load_timer;
}


function open_new_buffer_background(window, url) {
    // var target = OPEN_NEW_BUFFER_BACKGROUND;
    var target = OPEN_NEW_BUFFER;
    var opener = null;
    var spec = load_spec(url);

    var buffer =  create_buffer(window,
                                buffer_creator(content_buffer,
                                               $opener = opener,
                                               $load = spec),
                                target);
    
    dump(">>> Open buffer background:" + buffer.current_uri.spec + "\n");
    timeout_force_kill_self(buffer, FORCE_KILL_TIMEOUT*1000);
    timeout_force_capture(buffer, FORCE_CAPTURE_TIMEOUT*1000);
    timeout_player_load(buffer, PLAYER_RELOAD_TIMEOUT*1000);
    // timeout_buffer_load(buffer, 8*1000);
    return buffer;
}

interactive("open-new-buffer-background",
            "Open new buffer in the background",
            function(I) {
                var url = "http://www.azhibo.com/zhibo/cctv5-flv-27243.html";
                open_new_buffer_background(I.window, url);
            });
