(function () {
    'use strict';

    var ws = new WebSocket(location.origin.replace(/^http/, 'ws'));
    var messages = document.getElementById('messages');

    /** @type {HTMLInputElement} */
    var input = document.getElementById('message-input');

    var createMessageElement = (function () {
        var li = document.createElement('li');
        var p = document.createElement('p');

        p.className = 'message-text';
        li.appendChild(p);

        return function (text, isSelf) {
            p.textContent = text;
            li.className = 'message' + (isSelf ? ' self' : '');

            return li.cloneNode(true);
        }
    })();

    input.focus();

    document.getElementById('form').onsubmit = function (e) {
        e.preventDefault();

        if (input.value !== '') {
            ws.send(JSON.stringify({ text: input.value }));
        }

        input.value = '';
        input.focus();
    };

    ws.onmessage = function (msg) {
        var resp = JSON.parse(msg.data);
        var text = resp.text;

        messages.appendChild(createMessageElement(text, resp.isSelf));
    };

    ws.onerror = function (err) {
        console.log("err", err);
    };

    ws.onclose = function close() {
        console.log('disconnected');
    };
})();
