"use strict";

var storage = window.localStorage;
var contract = new NoteContractApi();

var URL = URL || webkitURL || window;

var ALL = [];
var activeItem = -1;

function logEvent(txt) {
    $('#foot_info').html('【星云链共享笔记】 ' + txt);
}

Date.prototype.Format = function (fmt) {
    var o = {
        "M+": this.getMonth() + 1,
        "d+": this.getDate(),
        "h+": this.getHours(),
        "m+": this.getMinutes(),
        "s+": this.getSeconds(),
        "q+": Math.floor((this.getMonth() + 3) / 3),
        "S": this.getMilliseconds()
    };
    if (/(y+)/.test(fmt))
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt))
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}

if (!String.linkify) {
    String.prototype.linkify = function () {

        // http://, https://, ftp://
        var urlPattern = /\b(?:https?|ftp):\/\/[a-z0-9-+&@#\/%?=~_|!:,.;]*[a-z0-9-+&@#\/%=~_|]/gim;

        // www. sans http:// or https://
        var pseudoUrlPattern = /(^|[^\/])(www\.[\S]+(\b|$))/gim;

        // Email addresses
        var emailAddressPattern = /[\w.]+@[a-zA-Z_-]+?(?:\.[a-zA-Z]{2,6})+/gim;

        return this
            .replace(urlPattern, ' <a href="$&" target="_blank">$&</a>')
            .replace(pseudoUrlPattern, '$1<a href="http://$2" target="_blank">$2</a>')
            .replace(emailAddressPattern, '<a href="mailto:$&">$&</a>');
    };
}

// =============== FUNCTION ===============

var tree = []; // node : item, level, type, decor(..nnn), class, isClass, hidden
var list = []; // item : title, desc, ref[{class, node}], txtPosition, index

function go(n) {
    $('#rrr').animate({
        scrollTop: $("#node" + n).offset().top + $('#rrr').scrollTop() - 32
    }, 200);
}

function parseLoop(raw, func) {

    var i = raw.indexOf('.');
    var len = raw.length;

    for (;;) {

        var j = i + 1;
        while (raw[j] == '.') {
            j++;
        }

        var k = j;
        while ((raw[k] == '0') || (raw[k] == '1') || (raw[k] == '2') || (raw[k] == '3') || (raw[k] == '4') || (raw[k] == '5') || (raw[k] == '6') || (raw[k] == '7') || (raw[k] == '8') || (raw[k] == '9')) {
            k++;
        }

        var l = k;
        var type = '';
        if ((raw[l] == '!') || (raw[l] == '-') || (raw[l] == '#')) {
            type = raw[l];
            l++;
        }

        var next = raw.indexOf('\n.', l) + 1;
        if (next == 0) {
            next = len + 1;
        }

        func(i, j, k, l, next, type);

        if (next >= len) {
            break;
        }
        i = next;
    }
}

function renderTxt(raw) {

    var out = "";

    tree = [];
    list = [];

    // =============== PARSE RAW INPUT ===============

    var index = 1;

    parseLoop(raw, function (i, j, k, l, next, type) {

        var node = {};
        node.type = type;
        node.decor = raw.substring(i, k);

        // 存储节点
        node.level = j - i - 1;
        if (j == k) {
            node.item = index;
            index++;
        } else {
            node.item = -parseInt(raw.substring(j, k), 10); // user index => negative
        }
        tree.push(node);

        // 找到的是一个新节点？
        if (!list[node.item]) {

            // 是一个非引用的节点？
            var txt = raw.substring(l, next - 1).trim();
            if (txt.length > 0) {
                var item = {};

                item.ref = [];
                item.txtPosition = l; // 项目的文字的开头点

                // 拥有名称和细节？
                var jj = txt.indexOf('\n');
                if (jj < 0)
                    item.title = txt;
                else {
                    item.title = txt.substring(0, jj).trim();
                    item.desc = txt.substr(jj + 1).trim().replace(/\n/g, "<br>");
                }

                // 找到节点的 CLASS
                if (node.type == '#') {
                    node.isClass = true;
                    node.class = item.title;
                }
                // 顶层节点强制设定为CLASS
                else if (node.level == 0) {
                    node.isClass = true;
                    node.class = item.title;
                    // 并加入到 NAV
                }

                // 存储项目
                item.index = node.item;
                list[node.item] = item;
            }
        }
    });

    // =============== PROCESS DATA ===============

    for (var i = 0; i < tree.length; i++) {
        var node = tree[i];
        if (!list[node.item]) {
            tree[i].hidden = false; // 隐藏完全无内容的节点
        } else {
            // 找到节点的class
            if ((!node.isClass) && (i > 0)) {
                var j = i - 1;
                while (((tree[j].level >= node.level) || (!tree[j].isClass)) && (j > 0)) {
                    j--;
                }
                node.class = tree[j].class;
            }

            // 存储引用某项目的节点的列表
            list[node.item].ref.push({
                'class': node.class,
                'node': i
            });
        }
    }

    // =============== CONVERT TO HTML ===============

    for (var i = 0; i < tree.length; i++) {
        var node = tree[i];
        if (!node.hidden) {

            var hasChild = false;
            var endChild = 0;

            if ((i < tree.length - 1) && (tree[i + 1])) {
                if (tree[i + 1].level > node.level)
                    hasChild = true;
                else if (tree[i + 1].level < node.level)
                    endChild = node.level - tree[i + 1].level;
            }

            var item = list[node.item];

            var isMultipleItem = false;
            var hasStartingPoint = false;
            var beginWithUrgent = false;
            var itemTitle = "";
            if (item) {
                itemTitle = item.title;
                var newItem = itemTitle.indexOf("// ");
                var newBegin = itemTitle.indexOf("：");
                if ((newItem >= 0) || (newBegin >= 0)) {
                    isMultipleItem = true;
                    if ((newBegin >= 0) && ((newBegin < newItem) || (newItem < 0))) {
                        hasStartingPoint = true;
                        if (itemTitle.charAt(newBegin + 1) == '!')
                            beginWithUrgent = true;
                        itemTitle = itemTitle.substring(0, newBegin + 1) + "<span class='subitem" + (beginWithUrgent ? ' urgent' : '') + "'>" + itemTitle.substring(newBegin + (beginWithUrgent ? 2 : 1));
                    }
                }
            }

            if (!hasChild)
                isMultipleItem = true;
            if (item) {
                if (itemTitle.charAt(0) == '!') {
                    beginWithUrgent = true;
                    itemTitle = itemTitle.substring(1);
                }
            }

            var line = '<div class="node" style="position:relative;" id="node' + i + '"><div class="bullet" style=""></div><p contentEditable=false class="title ' + (node.type == '!' ? 'urgent ' : '') + (node.type == '-' ? 'done ' : '') + (node.isClass ? 'class">' + node.class : '">' + ((isMultipleItem && !hasStartingPoint) ? "<span class='subitem" + (beginWithUrgent ? ' urgent' : '') + "'>" : "") + (item ? itemTitle.linkify() : "")) + (isMultipleItem ? "</span>" : "") + '</p>';

            if (item) {

                if (item.ref.length > 1) {
                    for (var j = 0; j < item.ref.length; j++) {
                        if (item.ref[j].node != i)
                            line += '<span class="tag" onclick="go(' + item.ref[j].node + ')">' + item.ref[j].class + '</span>';
                    }
                }

                line += (item.hasOwnProperty('desc') ? ('<p contentEditable=false class="desc">' + item.desc + '</p>') : '') + (hasChild ? '<div style="margin-left:20px;">' : '') + (!hasChild ? '</div>' : '');
            } else {
                line += '</div>';
            }

            for (var j = 0; j < endChild; j++) {
                if (j != endChild - 1)
                    line += '</div></div>';
                else
                    line += '</div><div class="line"></div></div>';
            }

            //            line = line.replace(/【/g, "<span class='subitem'>");
            //            line = line.replace(/】/g, "</span>");
            line = line.replace(/\/\/ !/g, "</span><span class='subitem urgent'>");
            line = line.replace(/\/\/!/g, "</span><span class='subitem urgent'>");
            line = line.replace(/\/\/ /g, "</span><span class='subitem'>");
            line = line.replace(/ </g, "<");
            line = line.replace(/> /g, ">");

            out = out + line;
        }
    }

    $('#rrr').html(out);
}

function refreshTxt() {
    var raw = $('#lll').val();

    if (activeItem == -1)
        storage.setItem("note", raw);

    renderTxt(raw);

    if (typeof MathJax != 'undefined') {
        if (typeof MathJax.isReady != 'undefined') {
            if (MathJax.isReady) {
                MathJax.Hub.Queue(['Typeset', MathJax.Hub, document.getElementById("rrr")]);
            }
        }
    }
}

var refreshTimeout;

$(function () {
    // =============== INIT ===============

    (function () {
        var head = document.getElementsByTagName('head')[0],
            script;
        script = document.createElement('script');
        script.type = 'text/x-mathjax-config';
        script[(window.opera ? 'innerHTML' : 'text')] =
            'MathJax.Hub.Config({\n' +
            'jax: ["input/TeX","output/SVG","output/PreviewHTML"],\n' +
            'extensions: ["tex2jax.js"],\n' +
            'TeX: { extensions: ["AMSmath.js","AMSsymbols.js","noErrors.js","noUndefined.js"] },\n' +
            'tex2jax: { inlineMath: [["$","$"]] }\n' +
            '});';
        head.appendChild(script);

        script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.1/MathJax.js';
        head.appendChild(script);
    })();

    if (!storage.getItem("note")) {
        storage.setItem("note", `. 欢迎使用《星云链共享笔记》，将你的笔记与大家分享
. 用点代表层次关系
.. 用tab可以自动缩进（两个点）
... 这是三个点的效果 // 更多事项 // 更多更多
... 还有什么 // 什么什么
.. 我是标题：具体的事项 // 事项 // !重要事项 // 事项
. 一个点的是大类别
..! 用ctrl+s可将笔记传上星云链
.. 内容也会暂时保存在浏览器本地的localStorage中 // 连接测试 http://baidu.com
.. 数学测试：$\\xi(s) = \\xi(1-s)$
. 还有更多神秘功能请查看代码`);
    }
    var raw = storage.getItem("note");
    $('#lll').val(raw);
    renderTxt(raw);

    function saveBackup() {
        if (!checkNebulas()) return;

        logEvent('正在保存...');
        contract.add($('#lll').val().replace(/\n/g, '\u9FFF'), function () {
            logEvent('保存成功。稍后刷新页面即可在左栏看到笔记。');
        });
    }

    // =============== EVENT ===============

    $(document).keydown(function (e) {
        if ((e.ctrlKey || e.metaKey) && (e.keyCode == 83)) {
            e.preventDefault();
            e.stopPropagation();
            saveBackup();
            return false;
        }
    });

    $('#lll').on('keyup', function (e) {
        window.clearTimeout(refreshTimeout);
        refreshTimeout = window.setTimeout(refreshTxt, 500);
    });

    $('#lll').on('keydown', function (e) {
        window.clearTimeout(refreshTimeout);

        if (e.keyCode == 9) { // TAB
            var range = $('#lll').range();
            if (range.start == range.end) {
                // 如果没有选中文字，则向前找到"/n."，然后加入或删除"."
                var cursor = range.start;
                var headStr = "\n" + $('#lll').val().substr(0, cursor);
                var tailStr = $('#lll').val().substr(cursor);
                var lineBegin = headStr.lastIndexOf("\n.");
                if (lineBegin >= 0) {
                    if (e.shiftKey) {
                        if (headStr.substr(lineBegin + 2, 1) == '.') { // 保证还留下一个点
                            headStr = headStr.substr(0, lineBegin) + "\n" + headStr.substr(lineBegin + 2);
                            $('#lll').val(headStr.substr(1) + tailStr);
                            $('#lll').caret(cursor - 1);
                        }
                    } else {
                        headStr = headStr.substr(0, lineBegin) + "\n.." + headStr.substr(lineBegin + 2);
                        $('#lll').val(headStr.substr(1) + tailStr);
                        $('#lll').caret(cursor + 1);
                    }
                }
            } else {
                var str = "\n" + range.text;
                if (e.shiftKey) {
                    str = str.replace(/\n\.\./g, '\n.');
                    $('#lll').range(str.substr(1));
                } else {
                    str = str.replace(/\n\./g, '\n..');
                    $('#lll').range(str.substr(1));
                }
            }
            e.preventDefault();
            e.stopPropagation();

            return false;
        } else if (e.keyCode == 13) { // ENTER
            // 在文件最后 or 本条目的末尾 按回车，则自动生成层次个点
            var cursor = $('#lll').caret();
            var before = $('#lll').val().substr(cursor - 1, 1);
            if (before != '\n') { //前面已经是空行，就不要再生成了
                var next = $('#lll').val().substr(cursor, 99); //是否后面就是新条目（除去可能的空行和空格）
                if ((next.trim().substr(0, 1) == ".") || (next.length == 0)) {
                    var headStr = "\n" + $('#lll').val().substr(0, cursor);
                    var tailStr = $('#lll').val().substr(cursor);
                    var lineBegin = headStr.lastIndexOf("\n.");
                    var level = 1;
                    while (headStr[lineBegin + level + 1] == '.') {
                        level++;
                    }
                    var levelStr = "\n";
                    while (level > 0) {
                        levelStr += ".";
                        level--;
                    }
                    $('#lll').caret(levelStr + " ");
                    if (next.length == 0)
                        $('#lll').scrollTop($('#lll').scrollTop() + 20);
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            }
        }
    });

    function updateItemTxt() {

    }

    function checkNebulas() {
        var isExtensionExist = typeof (webExtensionWallet) !== "undefined";
        if (!isExtensionExist) {
            $('#nav').html('<a href="https://github.com/ChengOrangeJu/WebExtensionWallet">请先点击此处，安装星云链钱包</a>');
        } else {
            logEvent('已与星云链连接。');
        }
        return isExtensionExist;
    }

    $('#nav').html('正在载入笔记...');

    if (checkNebulas()) {
        $('#nav').html('正在读取数据...');
        logEvent('正在读取总笔记数...');
        contract.getTotalCount(function (resp) {
            var count = resp.result;
            logEvent('找到 ' + count + ' 条笔记，将载入最近的 20 条。');
            contract.get(20, Math.max(0, count - 20), function (resp) {
                $('#nav').html('');
                var navOut = '<div class="-1" onclick="show(-1)">本地笔记</div>';
                ALL = JSON.parse(resp.result);
                for (var i = ALL.length - 1; i >= 0; i--) {
                    ALL[i].text = ALL[i].text.replace(/\u9FFF/g, '\n');
                    navOut += '<div class="' + i + '"onclick="show(' + i + ')">' + (new Date(ALL[i].date)).Format("yyyy-MM-dd hh:mm:ss") + '</div>';
                }
                $('#nav').html(navOut);
                logEvent('读取完成。链上的笔记是只读的，如您需修改，可将他们复制到本地笔记然后修改。保存上链的快捷键是 Ctrl+S。');
            });
        });
    }
});


function show(id) {
    $('#nav div').removeClass('highlight');
    $('#nav .' + id).addClass('highlight');
    activeItem = id;

    var raw = "";
    if (id == -1) {
        raw = storage.getItem("note");
        $('#lll').removeAttr("readonly");
        $('#lll').css("cursor", "text");
    } else {
        raw = ALL[id].text;
        $('#lll').attr('readonly', 'readonly');
        $('#lll').css("cursor", "default");
    }
    $('#lll').val(raw);
    renderTxt(raw);
}
