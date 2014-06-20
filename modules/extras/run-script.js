
function inject_script(doc, script_text) {
    var script_tag = doc.createElement("script");
    script_tag.type = "text/javascript";
    script_tag.text = script_text;
    doc.documentElement.appendChild(script_tag);
}


function inject_param_obj(obj) {
    var doc = getDocument(obj);
    
    var children = obj.children;
    for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.tagName.toUpperCase() === "PARAM" && child.name.toLowerCase() === "wmode") {
            var value = child.value.toLowerCase();
            if (!(value === "transparent" || value === "opaque")) {
                child.value = "transparent";
                child.remove();
                obj.appendChild(child);
                dump("Change param of object: "+ obj.data + "\n");
                return forceRedraw(obj);
            } else {
                return null;             // DONE;
            }
        }
    }
    
    var param = doc.createElement('param');
    param.name = 'wmode';
    param.value = 'transparent';
    obj.appendChild(param);
    dump("Insert param to object: "+ obj.data + "\n");
    return forceRedraw(obj);
}

function inject_param_embed(embed) {
    var p = embed.parentElement;
    
    var wmode = embed.getAttribute("wmode");
    if (wmode != null) {
        var l_wmode = wmode.toLowerCase();
        if (l_wmode === "opaque" || l_wmode == "transparent") {
            // OK
            return null;
        }
    }
    
    embed.setAttribute("wmode", "transparent");
    embed.remove();
    p.appendChild(embed);
    dump("Insert param to embed: "+ embed.data + "\n");
    return forceRedraw(embed);
}


function getDocument(elem) {
    while (elem.parentElement != null) {
        elem = elem.parentElement;
    }
    return elem.parentNode;
}

function forceRedraw (element){

    if (!element) {return null;}
    
    var doc = getDocument(element);
    var n = doc.createTextNode(' ');
    var disp = element.style.display;  // don't worry about previous display style

    element.appendChild(n);
    element.style.display = 'none';

    var timer = call_after_timeout(function(){
        element.style.display = disp;
        n.parentNode.removeChild(n);
    },20); // you can play with this timeout to make it as short as possible
    return timer;
}


// var {
//     interfaces: Ci,
//     utils: Cu,
//     classes: Cc
// } = Components;
// Cu.import("resource://gre/modules/FileUtils.jsm");
// Cu.import("resource://gre/modules/NetUtil.jsm");

// function writeFile(nsiFile, data, overwrite, callback) {
//     //overwrite is true false, if false then it appends
//     //nsiFile must be nsiFile
//     if (!(nsiFile instanceof Ci.nsIFile)) {
//         Cu.reportError('ERROR: must supply nsIFile ie: "FileUtils.getFile(\'Desk\', [\'rawr.txt\']" OR "FileUtils.File(\'C:\\\\\')"');
//         return;
//     }
//     var openFlags;
//     if (overwrite) {
//         openFlags = FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE | FileUtils.MODE_TRUNCATE;
//     } else {
//         openFlags = FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE | FileUtils.MODE_APPEND;
//     }
//     //data is data you want to write to file
//     //if file doesnt exist it is created
//     var ostream = FileUtils.openFileOutputStream(nsiFile, openFlags);
//     var converter = Cc['@mozilla.org/intl/scriptableunicodeconverter'].createInstance(Ci.nsIScriptableUnicodeConverter);
//     converter.charset = 'UTF-8';
//     var istream = converter.convertToInputStream(data);
//     // The last argument (the callback) is optional.
//     NetUtil.asyncCopy(istream, ostream, function (status) {
//         if (!Components.isSuccessCode(status)) {
//             // Handle error!
//             Cu.reportError('error on write isSuccessCode = ' + status);
//             callback(status);
//             return;
//         }
//         // Data has been written to the file.
//         callback(status);
//     });
// }

// function readFile(file, callback) {
//     //file does not have to be nsIFile
//     //you must pass a callback like function(dataReadFromFile, status) { }
//     //then within the callback you can work with the contents of the file, it is held in dataReadFromFile
//     //callback gets passed the data as string
//     NetUtil.asyncFetch(file, function (inputStream, status) {
//         //this function is callback that runs on completion of data reading
//         if (!Components.isSuccessCode(status)) {
//             Cu.reportError('error on file read isSuccessCode = ' + status);
//             callback(null, status);
//             return;
//         }
//         var data = NetUtil.readInputStreamToString(inputStream, inputStream.available());
//         callback(data, status);
//     });
// }

// readFile("chrome://conkeror-ext/content/inject-param-tag.js", function(data, status) {
//     dump("status:" + status + "\n");
//     define_variable("inject_param_js_str", data);
//     dump("DONE.Read: chrome://conkeror-ext/content/inject-param-tag.js\n");
// });
// readFile("chrome://conkeror-ext/content/jquery-1.11.1.min.js", function(data, status) {
//     dump("status:" + status + "\n");
//     define_variable("jquery_js_str", data);
//     dump("DONE.Read: chrome://conkeror-ext/content/jquery-1.11.1.min.js \n");
// });


// function eval_in_sandbox(win, script) {
//     var sandbox = Cu.Sandbox(win);
//     var result = Cu.evalInSandbox(script, sandbox);
//     dump("Eval result:" + result + "\n");
// }

// function inject_js(doc) {
//     // Test inject javascript.
//     var script_jquery = doc.createElement("script");
//     script_jquery.type = "text/javascript";
//     script_jquery.text = jquery_js_str;
    
//     var script_inject = doc.createElement("script");
//     script_inject.type = "text/javascript";
//     script_inject.text = inject_param_js_str;
    
//     doc.documentElement.appendChild(script_jquery);
//     doc.documentElement.appendChild(script_inject);
    
//     // dump("Current title:" + doc.title);
// }


// interactive("inject-js", "Test inject javascript to page.",
//             function(I) {
//                 var b = I.buffer.browser;
//                 var document = I.buffer.browser.contentDocument;

//                 // eval_in_sandbox(I.buffer.browser.contentWindow, "alert(\"Inject Successfully!\");");
//                 inject_js(document);
//                 I.minibuffer.message("Injected!");
//             });

