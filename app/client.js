'use strict';

var ws = new WebSocket(location.origin.replace(/^http/, 'ws'));

$(function() {
    var $m = $('#m');

    $m.focus();

    $('form').submit(function() {
        var $this = $(this);

        ws.send(JSON.stringify({ text: $m.val() }));
        $m.val('');
        $m.focus();

        return false;
    });

    ws.onmessage = function(msg) {
        var resp = JSON.parse(msg.data);
        var message = resp.type === 'bot' ? resp.text : JSON.parse(resp.text).text;

        $('#messages').append(
            $('<li class="message">').addClass(resp.isSelf ? 'self' : '').append(
                $('<p class="message-text">').text(message)
            )
        );
    };

    ws.onerror = function(err) {
        console.log("err", err);
    };

    ws.onclose = function close() {
        console.log('disconnected');
    };
});
