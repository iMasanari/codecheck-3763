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

wss.on('connection', (ws) => {
    ws.on('message', (data) => {
        var message = JSON.parse(data);

        console.log('message:', message);

        wss.clients.forEach((client) => {
            client.send(JSON.stringify({
                success: true,
                type: 'message',
                text: data
            }));
        });
    });
    ws.on('close', function () {
        console.log('websocket connection close');
    });
});
