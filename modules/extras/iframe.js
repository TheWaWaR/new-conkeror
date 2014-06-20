
require("extras/run-script.js");

function bad_iframe_size(ele) { // Unused!
    var rect = ele.getBoundingClientRect();
    if (rect.width < 160 || rect.height < 120) {
        dump("bad iframe:" + rect.width + "," + rect.height + "\n");
        return true;
    }
    return false;
}

function bad_object_size(ele) {
    var rect = ele.getBoundingClientRect();
    if (rect.width < 160 || rect.height < 120
        || rect.width > 960 || rect.height > 800
        || rect.height / rect.width > 2) {
        dump("Bad object:" + rect.width + "," + rect.height + "\n");
        return true;
    }
    dump("Good object:" + rect.top + "," + rect.left + "," + rect.width + "," + rect.height + "\n");
    return false;
}

function find_all_win_objects(parent, frame, level) {
    var win = frame.contentWindow;
    var doc = frame.contentDocument;
    var html = doc.documentElement;

    if (html == null) {
        return null;
    }
    
    var iframes = doc.getElementsByTagName('iframe');
    var frames = doc.getElementsByTagName('frame');
    var objects = doc.getElementsByTagName('object');
    var embeds = doc.getElementsByTagName('embed');

    var sub_iframes = [],
        cur_objects = [],
        cur_embeds = [];
    
    var rect;                   // Position+size related it's parent.
    if (level == 0) {
        rect = {
            left: 0, top: 0,
            width: html.scrollWidth,
            height: html.scrollHeight
        };
    } else {
        rect = frame.getBoundingClientRect();
    }

    function filter_objects(type, lst, objs) {
        for (var i = 0; i < objs.length; i++) {
            var _obj = objs[i];
            if (!(bad_object_size(_obj))) {
                var _rect = _obj.getBoundingClientRect();
                lst.push({
                    rect: _rect,
                    obj: _obj,
                    redrawTimer: [],
                    win: win,
                    frame: frame,
                    level: level,
                    name_suffix: 'lv'+ level + "_" + btoa(_obj.id +"_"+ _obj.data)
                });
                dump('>> Find object: ' + 'lv'+ level + "_" + _obj.id + "_" + _obj.data + '\n');
            }
        }
    }
    filter_objects('object', cur_objects, objects);
    filter_objects('embed', cur_embeds, embeds);

    function find_sub_frames(the_frames) {
        for (var i = 0; i < the_frames.length; i++) {
            var _iframe = the_frames[i];
            dump('>> Find iframe:' + 'lv'+level + '_'+ _iframe.src +'\n');
            sub_iframes.push(find_all_win_objects(frame, _iframe, level+1));
        }
    }
    find_sub_frames(iframes);
    find_sub_frames(frames);

    dump("@@@ frame.src:" + frame.src + "\n");
    return {
        parent: parent,
        frame: frame,
        win: win,
        level: level,
        rect: rect,
        sub_iframes: sub_iframes,
        objects : cur_objects,
        embeds : cur_embeds
    };
}

function collect_objects(topitem) {
    var objs = [];

    if (topitem == null) {
        return objs;
    }
    
    function collect(item) {
        var i, _obj;
        for (i = 0; i < item.objects.length; i++) {
            _obj = item.objects[i];
            dump(">> Collate object:" + _obj.name_suffix + "\n");
            _obj.redrawTimer.push(inject_param_obj(_obj.obj));
            objs.push(_obj);
        }
        for (i = 0; i < item.embeds.length; i++) {
            _obj = item.embeds[i];
            dump(">> Collate embed:" + _obj.name_suffix + "\n");
            _obj.redrawTimer.push(inject_param_embed(_obj.obj));
            objs.push(_obj);
        }

        for (i = 0; i < item.sub_iframes.length; i++) {
            var _item = item.sub_iframes[i];
            if (_item != null) {
                collect(_item);
            }
        }
    }
    collect(topitem);
    return objs;
}


function find_frame_by_src (topitem, src_url) {
    var target_frame = null;

    function _find(item) {
        var frame_src = item.frame.src;
        if (typeof(frame_src) != 'undefined' && frame_src.indexOf(src_url) > -1) {
            target_frame = item.frame;
            return;
        }

        var sub_iframes = item.sub_iframes;
        for (var i = 0; i < sub_iframes.length; i++) {
            var cur_item = sub_iframes[i];
            _find(cur_item);
        }
    }
    _find(topitem);
    
    return target_frame;
}

function find_object_by_data(objs, data_url) {
    var target_obj = null;

    for (var i = 0; i < objs.length; i++) {
        var obj = objs[i];
        var obj_data = obj.data;
        dump("object:" + obj + "\n");
        if (typeof(obj_data) != 'undefined' && obj_data.indexOf(data_url) > -1) {
            target_obj = obj;
            break;
        }
    }
    dump("target_obj:" + target_obj + "\n");
    return target_obj;
}

function find_all_iframes(doc, parent_item) {
    var iframes = doc.getElementsByTagName("iframe");
    var cur_level = parent_item != null ? parent_item.level + 1 : 1;
    var item_lst = [];
    
    dump("find_all_iframes():" + iframes.length + ", Current level: " + cur_level + "\n");
    /*
    [{iframe: <iframe>, sub_iframes: []}, ]
     */
        
    for (var i = 0; i < iframes.length; i++) {
        var i_iframe = iframes[i];
        var i_doc = i_iframe.contentDocument;
        var rect = i_iframe.getBoundingClientRect();
        
        var cur_item = {
            rect : rect,
            doc : doc,
            parent: parent_item,
            iframe : i_iframe,
            level : cur_level
        };

        var sub_items = find_all_iframes(i_doc, cur_item);
        cur_item.sub_items = sub_items;
        item_lst.push(cur_item);
        dump("Sub items:" + cur_item.sub_items.length + ", Current level: " + cur_item.level + "\n");
    }
    return item_lst;
}

function find_iframes_has_flash(buffer, sub_src_url) {
    var doc = buffer.browser.contentDocument;
    var all_items = find_all_iframes(doc, null);
    var target_items = [];

    function filter_iframes(items) {
        /* Valid iframe size, has at least one valid object/embed  */
        dump("filter_iframes(items):" + items.length + "\n");
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var iframe = item.iframe;

            for (var k in item) {
                if (item.hasOwnProperty(k)) {
                    dump("item.k = " + k + "\n");
                }
            }
            dump("======\n");
            
            var src = iframe.src;
            dump("Print src:" + src + "\n");
            if (typeof(src) !== 'undefined'
                && src.indexOf(sub_src_url) > -1) {
                var t_doc = iframe.contentDocument;
                var objects = t_doc.getElementsByTagName("object");
                var embeds = t_doc.getElementsByTagName("embed");
                var validCnt = 0;
                var validObjs = [];
                for (var j = 0; j < objects.length; j++) {
                    if (!bad_object_size(objects[j])) {
                        validCnt += 1;
                        validObjs.push(objects[j]);
                    }
                }
                for (var k = 0; k < embeds.length; k++) {
                    if (!bad_object_size(embeds[k])) {
                        validCnt += 1;
                        validObjs.push(embeds[k]);
                    }
                }
                
                if (objects.length + embeds.length > 0  && validCnt > 0) {
                    dump("Got iframe:" + iframe.src + "\n");
                    item.objects = validObjs;
                    target_items.push(item);
                }
            }
            dump("filter_iframes().item.sub_items:" + item.sub_items.length + "\n");
            
            filter_iframes(item.sub_items);
        }
    }
    
    filter_iframes(all_items);
    return target_items;
}


// function get_object_coordinates(buffer, sub_src_url) {
//     var items = find_iframes_has_flash(buffer, sub_src_url);
//     var lst = [];
//     for (var i = 0; i < items.length; i++) {
//         var item = items[i];
//         var win = item.iframe.contentWindow;
//         var objs = item.objects;
//         var rects = [];
//         for (var j = 0; j < objs.length; j++) {
//             var rect = objs[j].getBoundingClientRect();
//             rects.push({
//                 left: rect.left + win.pageXOffset,
//                 top: rect.top + win.pageYOffset,
//                 width: rect.width,
//                 height: rect.height,
//                 isRoot: false,
//                 name_suffix: 'frame'+ (i+1) +"_rect"+ (j+1)
//             });
//             dump(">> need to capture --> " + "frame"+ (i+1) +"_rect"+ (j+1) + "\n");
//         }
//         lst.push({
//             win: win,
//             rects: rects
//         });
//     }

//     var bwin = buffer.browser.contentWindow;
//     var html = bwin.document.documentElement;
//     lst.push({
//         win: bwin,
//         rects: [{
//             left   : 0,
//             top    : 0,
//             width  : html.scrollWidth,
//             height : html.scrollWidth,
//             isRoot : true
//         }]
//     });
//     return lst;
// }


// interactive("access-iframe", "Access Iframe",
//             function(I) {
//                 var url = "http://www.azhibo.com/zhibo/cctv5-flv-27243.html";
//                 var win = I.buffer.browser.contentWindow;
//                 var doc = I.buffer.browser.contentDocument;
//                 var iframes = doc.getElementsByTagName("iframe");
//                 var t_frame = null;

//                 // var items = find_iframes_has_flash(I.buffer, "64ma.com");
//                 var topitem = find_all_win_objects(null, I.buffer.browser, 0);
//                 var items = collect_objects(topitem);
//                 dump(">> Object size:" + objs.length + "\n");
//             });
