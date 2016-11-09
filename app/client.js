'use strict';

var ws = new WebSocket(location.origin.replace(/^http/, 'ws'));

$(function () {
    $('form').submit(function () {
        var $this = $(this);
        var $m = $('#m');
        
        ws.send(JSON.stringify({ text: $m.val() }));
        $m.val('');

        return false;
    });
    ws.onmessage = function (msg) {
        var resp = JSON.parse(msg.data);
        $('#messages').append(
            $('<li>').append(
                $('<span class="message">').text(JSON.parse(resp.text).text)
            )
        );
    };
    ws.onerror = function (err) {
        console.log("err", err);
    };
    ws.onclose = function close() {
        console.log('disconnected');
    };
});
