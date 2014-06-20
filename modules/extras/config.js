

var FORCE_KILL_TIMEOUT = 100;
var FORCE_CAPTURE_TIMEOUT = 80;
var PLAYER_RELOAD_TIMEOUT = 20;


var CHANNEL_SELECTORS = [
    {
        frame_src: "list.asp",
        script: "var CHT_3 = document.getElementById('CHT_3'); CHT_3.firstElementChild.click();"
    },
    {
        frame_src: "ggwl=list",
        script: "var cp_3=document.getElementById('cp_3'); var kp_3 = document.getElementById('kp_3'); kp_3.children[3].onclick();"
    },
    {
        frame_src: "www.letvlive.com/tvlive.php",
        script: "var cctv5=document.getElementById('cctv5'); cctv5.click();"
    },
    {
        frame_src: "srt360.com/index.asp?action=list",
        script: "var a3171=document.getElementById('a3171'); a3171.click();" // <a> should use click() to invoke onclick.
    }
];

