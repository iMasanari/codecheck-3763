'use strict';

(function() {
    var ws = new WebSocket(location.origin.replace(/^http/, 'ws'));
    var messages = document.getElementById('messages');

    /** @type {HTMLInputElement} */
    var input = document.getElementById('message-input');

    var MessageTemp = {
        message: document.createElement('li'),
        text: document.createElement('p'),
        init: function() {
            this.text.className = 'message-text';
            this.message.appendChild(this.text);

            return this;
        },
        getClone: function(text, isSelf) {
            this.text.textContent = text;
            this.message.className = 'message' + (isSelf ? ' self' : '');

            return this.message.cloneNode(true);
        }
    }.init();

    input.focus();

    document.getElementById('form').onsubmit = function(e) {
        e.preventDefault();

        ws.send(JSON.stringify({ text: input.value }));

        input.value = '';
        input.focus();
    };

    ws.onmessage = function(msg) {
        var resp = JSON.parse(msg.data);
        var text = resp.type === 'bot' ? resp.text : JSON.parse(resp.text).text;

        messages.appendChild(MessageTemp.getClone(text, resp.isSelf));
    };

    ws.onerror = function(err) {
        console.log("err", err);
    };

    ws.onclose = function close() {
        console.log('disconnected');
    };
})();
