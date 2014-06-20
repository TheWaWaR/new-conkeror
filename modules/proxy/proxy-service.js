
require('proxy/proxy-pac.js');

var pps = Cc["@mozilla.org/network/protocol-proxy-service;1"]
        .getService(Components.interfaces.nsIProtocolProxyService);

// Create the proxy info object in advance to avoid creating one every time
// var myProxyInfo = pps.newProxyInfo("socks", "127.0.0.1", 7070, 0, -1, 0);

var proxy_filter = {
    applyFilter: function(pps, uri, proxy) {
        var spec = uri.spec;
        var host = uri.host;
        // dump("FindProxyForURL for: " + host + " -> " + spec + "\n");
        var proxy_str = FindProxyForURL(null, host);
        
        if (proxy_str.toLowerCase() === "direct") {
            return null;
        }
        
        try {
            var arr = proxy_str.split(' ');
            var type = arr[0].toLowerCase();
            var host_port = arr[1];
            arr = host_port.split(':');
            var p_host = arr[0];
            var p_port = parseInt(arr[1]);

            // dump("proxy " + type + "->" + p_host + ":" + p_port + " for:" + spec + "\n");
            return pps.newProxyInfo(type, p_host, p_port, Ci.nsIProxyInfo.TRANSPARENT_PROXY_RESOLVES_HOST, -1, null);
        } catch (err) {
            dump("Apply proxy filter error:" + err + "\n");
            return null;
        }
    }
};

pps.registerFilter(proxy_filter, 0);


