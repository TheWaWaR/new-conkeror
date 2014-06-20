
require("extras/capture.js");
require("extras/net-monitor.js");

var serverSocket = Components.classes["@mozilla.org/network/server-socket;1"]
                             .createInstance(Components.interfaces.nsIServerSocket);
var tm = Cc["@mozilla.org/thread-manager;1"].getService();
var ss = Cc["@mozilla.org/scriptableinputstream;1"];

function gen_uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}

var capture_buffers;
if (typeof(capture_buffers) === 'undefined') {
    capture_buffers = {};
}


function socket_initialize_window (window) {
    dump("ServerSocket Starting......\n");
    var default_buffer = window.buffers.current;
    var listener = {
        onSocketAccepted: function(serverSocket, clientSocket) {
            dump("Accepted connection on "+clientSocket.host+":"+clientSocket.port + "\n");
            var input = clientSocket.openInputStream(0, 0, 0).QueryInterface(Ci.nsIAsyncInputStream);
            var output = clientSocket.openOutputStream(Ci.nsITransport.OPEN_BLOCKING, 0, 0);
            var port = clientSocket.port;
            var sin = ss.createInstance(Ci.nsIScriptableInputStream);
            sin.init(input);
            var buffer;
            var uuid = gen_uuid();
            
            var reader = {
                onInputStreamReady : function(input) {
                    try {
                        sin.available();
                    } catch(e) {
                        // dump("Network error:" + e + "\n");
                        return;
                    }
                    
                    var data = '';
                    while (true) {
                        try {
                            if (sin.available()) {
                                data = data + sin.read(512);
                            } else { break; }
                            
                        } catch(e) {
                            // dump("Network error:" + e + "\n");
                            return;
                        }
                    }

                    var status, obj, resp;
                    try {
                        obj = JSON.parse(data);
                        status = 'ok';
                    } catch (e) {
                        status = 'Error:' + e;
                    }

                    dump('>> Received from ' + port + ": " + status + "\n");
                    dump(">> Request:" + data + "\n");

                    
                    if ("url" in obj) {
                        buffer = open_new_buffer_background(window, obj.url);
                        dump(">>> New buffer of uuid:" + uuid + " + " + obj.url + "\n");
                        buffer.uuid = uuid;
                        capture_buffers[uuid] = buffer;
                        
                        buffer.capturing = false;
                        buffer.force_capture = false;
                        buffer.is_64ma = false;
                        buffer.buffer_loaded = false;
                        buffer.player_loaded = false;
                        buffer.channel_selected = false;
                        buffer.sidebar_frame = null;
                        buffer.stream_ready = false;
                        buffer.capture_timer = null;
                        
                        buffer.capture_args = obj;
                        buffer.capture_log = [];
                        buffer.connection = {
                            input: input,
                            output: output,
                            serverSocket: serverSocket,
                            clientSocket: clientSocket
                        };
                        buffer.capture_log.push((new Date()) + ": Starting......");
                    } 

                    if ("clear" in obj) {
                        kill_other_buffers(default_buffer);
                        dump("Kill all other buffer!\n");
                        var result = {status: "ok"};
                        var msg = JSON.stringify(result) + "\n";
                        output.write(msg, msg.length);
                        output.flush();
                        output.close();
                        input.close();
                    } else {
                        input.asyncWait(reader,0,0,tm.mainThread);
                    }
                }
            };
            input.asyncWait(reader, 0, 0, tm.mainThread);
            dump("Ready for another accept!\n");
        }
    };
    serverSocket.init(8989, true, 2);
    serverSocket.asyncListen(listener);
    dump("ServerSocket started!\n");
}

add_hook("window_initialize_hook", socket_initialize_window);
