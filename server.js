'use strict'

var http = require('http');
var https = require('https');
var express = require('express');
var app = express();
var port = process.env.PORT || 3000;
var token = require('./token.json');
var kuromoji = require("kuromoji");

//////////////////////
// setting http
app.use(express.static('app'));

var server = http.createServer(app);
server.listen(port);

console.log("Node app is running at localhost:" + port);

var tokenizer;
kuromoji.builder({ dicPath: "node_modules/kuromoji/dict/" }).build(function (err, _tokenizer) {
    tokenizer = _tokenizer;
});

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

        var match = message.text.match(/^(?:@?bot\s|bot:)(\S+)\s?([\s\S]*)$/);

        if (match && Bot.hasOwnProperty(match[1])) {
            var data = Bot[match[1]].command(match[2], wss)

            if (data) {
                wss.clients.forEach(client => {
                    client.send(JSON.stringify(data));
                })
            }
        }
    });
    ws.on('close', () => {
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
    },
    oshare: {
        description: 'bot oshare {keyword}: Instagramでタグ検索し、オシャレ度を数値化する',
        command: (arg, wss) => {
            const option = {
                host: 'api.instagram.com',
                path: `/v1/tags/${encodeURIComponent(arg)}?access_token=${token.instagram}`
            };

            const callback = res => {
                const json = JSON.parse(res);
                const text = (json.meta.code === 200) ?
                    `「${json.data.name}」のオシャレ度は\n${separate(json.data.media_count)}です` :
                    `${json.meta.error_type}\n${json.meta.error_message}`;

                wss.clients.forEach(client => {
                    client.send(JSON.stringify({
                        success: true,
                        type: 'bot',
                        text: text
                    }));
                });
            };

            getRequest(option, callback);
        }
    },
    yomi: {
        description: 'bot yomi {keyword}: 読みを返す',
        command: (arg, wss) => {
            // tokenizer is ready
            var path = tokenizer.tokenize(arg);
            
            wss.clients.forEach(client => {
                client.send(JSON.stringify({
                    success: true,
                    type: 'bot',
                    text: path.reduce((a, v) => `${a} ${v.reading || v.surface_form}`, '')
                }));
            });
        }
    }
};

function separate(num) {
    return num.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,');
}

function getRequest(url, callback) {
    const req = https.get(url, res => {
        if (res.statusCode !== 200) return;

        res.setEncoding('utf8');
        res.on('data', function (str) {
            if (callback) callback(str);
        });
    });

    req.setTimeout(1000);

    req.on('timeout', () => {
        console.log('request timed out');
        req.abort()
    });

    req.on('error', err => {
        console.log("Error: " + err.code + ", " + err.message);
    });
}
