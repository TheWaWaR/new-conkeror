
require("extras/run-script.js");
require("extras/responseObserver.js");


function ChannelListenerProxy(win, buffer) {
    this.window = win;
    this.buffer = buffer;
    this.click_timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
}


function click_youku(spec, win, buffer) {
    var script = "var c_list = document.getElementById('c_list');"
            + "var menus = c_list.firstElementChild.children;"
            + "for (var i = 0; i < menus.length; i++) { "
            + "    var item = menus[i]; "
            + "    var textContent = item.textContent; "
            + "    var youku = '' + String.fromCharCode(20248) + String.fromCharCode(37239);" // 优酷
            + "    if (textContent.indexOf(youku) > -1) { "
            + "        item.onclick(); "
            + "        break;"
            + "    } "
            + "}";
    inject_script(win.parent.document, script);
    buffer.capture_log.push((new Date()) + ": Inject script to reload flash stream.");
    dump("$$ Inject click script for:" + spec + "\n");
    dump("---- stop request:" + " -> " + spec + "\n");
}

function player_loaded_try_capture(spec, buffer) {
    buffer.player_loaded = true;
    buffer.player_load_timer.cancel();
    if (buffer.capture_timer != null && !buffer.force_capture) {
        buffer.capture_timer.cancel();
    }
    buffer.capture_log.push((new Date()) + ": Player loaded:" + spec + ". Try capture......");
    start_capture(buffer);
}


ChannelListenerProxy.prototype = {
    onStartRequest: function(request, requestContext) {},

    onDataAvailable: function(request, requestContext, inputStream, offset, count) {
        var spec = request.URI.spec;
        var buffer = this.buffer;
        
        if (spec.indexOf("youkulive") > -1) {
            dump("@@@ youku stream ready!");
            if (buffer && "capture_args" in buffer && !buffer.stream_ready) {
                buffer.capture_log.push((new Date()) + ': Flash stream data available!');
                buffer.stream_ready = true;
                start_capture(buffer);
            }
        }
    },

    onStopRequest: function(request, requestContext, statusCode)
    {
        var spec = request.URI.spec;
        var buffer = this.buffer;

        if (spec.indexOf("youkulive") > -1) {
            dump("@@@ youku STOPED!\n");
            var click_youku_timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
            var win = this.window;
            var click_event = {
                notify: function() {
                    click_youku(spec, win, buffer);
                    dump("@@@ click youku after 2s \n");
                }
            };
            initWithCallback(click_event, 2000, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
            buffer.click_youku_timer = click_youku_timer;
        }
    },

    onCollectData: function(request, data, offset) {
        var spec = request.URI.spec;
        dump("@@@@@@@ onCollectData:" + spec + "\n");
    },

    shouldCacheRequest: function(request) {
        return false;
    },
}


function on_modify_request(request, data, win, buffer) {
    var uri = request.URI;
    var spec = uri.spec;
    var host = uri.host;
    var listener = null;

    // dump("......... GOT REQUEST:" + spec + ", win:" + win  + ", buffer:" + buffer  + "\n");

    if (buffer && "capture_args" in buffer) {
        if (spec.indexOf("64ma.com") > -1) {
            buffer.is_64ma = true;
        }
        
        else if (spec.indexOf("live/flv/channel") > -1) {
            if (!("source_clicked" in buffer)) {
                dump("@@@ first click youku.\n");
                click_youku(spec, win, buffer);
                buffer.source_clicked = true;
            }
        }
        // !!! Dead code.
        else if (spec.indexOf("youkulive") > -1) {
            dump("@@@ Detect youku, add channel_listener.\n");
            listener = HttpResponseObserver.register(win, request, new ChannelListenerProxy(win, buffer));
            buffer.channel_listener = listener;

            if ("click_youku_timer" in buffer) {
                dump("@@@ youku reloaded cancel the click timer!\n");
                buffer.click_youku_timer.cancel();
            }
            
            buffer.stream_ready = false;
            if (buffer.capturing && !buffer.force_capture) {
                buffer.capturing = false;
                buffer.capture_timer.cancel();
                dump("<!!> Cancel capture timer:" + spec + "\n");
                buffer.capture_log.push((new Date()) + ": Stream reloading... Cancel capture timer");
            }
        }
    }

    // if (host.indexOf("google-analytics.com") > -1
    //     || host.indexOf("googleapis.com") > -1) {
    //     dump("!!! on_modify_request.Cancel:" + spec + "\n");
    //     request.cancel(Components.results.NS_BINDING_ABORTED);
    // }
}

function on_opening_request(request, data, win, buffer){
    // var uri = request.URI;
    // if (uri.host.indexOf("google-analytics.com") > -1) {
    //     dump("!!! on_opening_request.Cancel:" + uri.spec + "\n");
    //     request.cancel(Components.results.NS_BINDING_ABORTED);
    // }
}

function on_examine_response(request, data, win, buffer) {
    var spec = request.URI.spec;

    // dump("......... EXAMINE RESPONSE:" + spec + ", win:" + win  + ", buffer:" + buffer  + "\n");
    if (buffer && "capture_args" in buffer) {
        if (spec.indexOf(".swf") > -1) {
            player_loaded_try_capture(spec, buffer);
        }
        else if (spec.indexOf("live/flv/channel") > -1) {
            if (buffer && "capture_args" in buffer) {
                buffer.capture_log.push((new Date()) + ': Flash stream responsed!');
            }
        }
        else if (spec.indexOf("live.64ma.com:1930/tv/file/v") > -1) {
            if (buffer && "capture_args" in buffer) {
                buffer.capture_log.push((new Date()) + ': Flash stream data available!');
                buffer.stream_ready = true;
                buffer.capture_args.delay += 5000;
                start_capture(buffer);
            }
        }
    }
    
}

function on_examine_cached_response(request, data, win, buffer) {
    var spec = request.URI.spec;
    // dump("......... CACHED RESPONSE:" + spec + ", win:" + win  + ", buffer:" + buffer  + "\n");
}

function on_examine_merged_response(request, data, win, buffer) {
    var spec = request.URI.spec;
    // dump("......... MERGED RESPONSE:" + spec + ", win:" + win  + ", buffer:" + buffer  + "\n");
}


var observe_started = false;
function start_observe(window) {

    if (observe_started) {
        dump(">>>> observe started !\n");
        return;
    }
    // dump("NS_BINDING_ABORTED:" + Components.results.NS_BINDING_ABORTED + "\n");
    dump(">>>> starting observe..... !\n");
    
    var netObserver = {
        observe: function(subject, topic, data) {
            var win = getWindowForRequest(subject);
            var buffer = getBufferByWindow(window.buffers, win);
            
            subject.QueryInterface(Ci.nsIHttpChannel);

            var title = null;
            var parent = null;
            var uri = subject.URI;
            function getTitle(){
                var browser = buffer.browser;
                if (browser == null) {
                    dump("@@@ browser null\n");
                    return;
                }
                var doc = browser.contentDocument;
                if (doc == null) {
                    dump("@@@ document null\n");
                    return;
                }
                var titleDOM = doc.getElementsByTagName("title")[0];
                if (titleDOM == null) {
                    // dump("@@@ titleDOM null\n");
                    return;
                }
                title = titleDOM.text;
            }
            if (buffer != null) {
                getTitle();
            }
            
            if (win != null) {
                parent = win.parent;
            }

            /*
            if (!(topic == "http-on-opening-request")) {
                dump("------- \n"
                     + " %%% -> win:" + win + " --> " + topic + " @ " + uri.spec + "\n"
                     + "     -> win.parent:" + parent + "\n"
                     + "     -> Buffer.title:" + title + "\n"
                     + "     -> Traceable channel:" + (subject instanceof Ci.nsITraceableChannel) + "\n"
                     + "======================\n");
            }
             */
            
            if (topic == "http-on-modify-request")
                on_modify_request(subject, data, win, buffer);
            else if (topic == "http-on-opening-request")
                on_opening_request(subject, data, win, buffer);
            else if (topic == "http-on-examine-response")
                on_examine_response(subject, data, win, buffer);
            else if (topic == "http-on-examine-cached-response")
                on_examine_cached_response(subject, data, win, buffer);
            else if (topic == "http-on-examine-merged-response")
                on_examine_merged_response(subject, data, win, buffer);
        }
    };
    
    observer_service.addObserver(netObserver, "http-on-modify-request", false);
    observer_service.addObserver(netObserver, "http-on-opening-request", false);
    observer_service.addObserver(netObserver, "http-on-examine-response", false);
    observer_service.addObserver(netObserver, "http-on-examine-cached-response", false);
    observer_service.addObserver(netObserver, "http-on-examine-merged-response", false);

    observe_started = true;
}

add_hook("window_initialize_late_hook", start_observe);

