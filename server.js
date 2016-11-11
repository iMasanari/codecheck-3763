'use strict'

var http = require('http');
var express = require('express');
var app = express();
var port = process.env.PORT || 3000;

//////////////////////
// setting http
app.use(express.static('app'));

var server = http.createServer(app);
server.listen(port);

console.log("Node app is running at localhost:" + port);

///////////////////
// setting ws
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({ server: server });

wss.on('connection', ws => {
    ws.on('message', data => {
        var message = JSON.parse(data);

        console.log('message:', message);

        wss.clients.forEach(client => {
            client.send(JSON.stringify({
                success: true,
                type: 'message',
                text: data,
                isSelf: client === ws
            }));
        });

        var match = message.text.match(/^(?:bot\s|@bot\s|bot:)(\S+)\s?([\s\S]*)$/);

        if (match && Bot.hasOwnProperty(match[1])) {
            var data = Bot[match[1]].command(match[2], wss)

            if (data != null) {
                wss.clients.forEach(client => {
                    client.send(JSON.stringify(data));
                })
            }
        }
    });
    ws.on('close', function () {
        console.log('websocket connection close');
    });
});

var Bot = {
    ping: {
        description: 'bot ping: pongを返す',
        command: () => ({
            success: true,
            type: 'bot',
            text: 'pong'
        })
    },
    help: {
        description: 'bot help: コマンドの一覧を表示する',
        command: () => ({
            success: true,
            type: 'bot',
            text: Object.keys(Bot).map(
                v => Bot[v].description || `bot ${v}`
            ).join('\n')
        })
    }
};
