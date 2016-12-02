'use strict'

const http = require('http');
const https = require('https');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const token = require('./token.json');
const kuromoji = require("kuromoji");

//////////////////////
// setting http
app.use(express.static('app'));

const server = http.createServer(app);
server.listen(port);

console.log("Node app is running at localhost:" + port);

let tokenizer;
kuromoji.builder({ dicPath: "node_modules/kuromoji/dict/" }).build(function (err, _tokenizer) {
    tokenizer = _tokenizer;
});

///////////////////
// setting ws
const WebSocketServer = require('ws').Server;
const wss = new WebSocketServer({ server: server });

wss.on('connection', ws => {
    ws.on('message', data => {
        const message = JSON.parse(data);

        console.log('message:', message);

        wss.clients.forEach(client => {
            client.send(JSON.stringify({
                success: true,
                type: 'message',
                text: message.text,
                isSelf: client === ws
            }));
        });

        const match = message.text.match(/^(?:@?bot\s|bot:)(\S+)\s?([\s\S]*)$/);

        if (match && Bot.hasOwnProperty(match[1])) {
            const data = Bot[match[1]].command(match[2], wss);

            if (data) {
                const json = JSON.stringify(data);

                wss.clients.forEach(client => client.send(json));
            }
        }
    });
    ws.on('close', () => {
        console.log('websocket connection close');
    });
});

const Bot = {
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
                const parse = JSON.parse(res);
                const text = (parse.meta.code === 200) ?
                    `「${parse.data.name}」のオシャレ度は\n${separate(parse.data.media_count)}です` :
                    `${parse.meta.error_type}\n${parse.meta.error_message}`;

                const json = JSON.stringify({
                    success: true,
                    type: 'bot',
                    text: text
                });

                wss.clients.forEach(client => client.send(json));
            };

            getRequest(option, callback);
        }
    },
    yomi: {
        description: 'bot yomi {keyword}: 読みを返す',
        command: (arg, wss) => {
            // tokenizer is ready
            const path = tokenizer.tokenize(arg);

            const json = JSON.stringify({
                success: true,
                type: 'bot',
                text: path.map(v => v.reading || v.surface_form).join(' ')
            })

            wss.clients.forEach(client => client.send(json))
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
