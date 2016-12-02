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
            const data = Bot[match[1]].command(match[2], wss, ws);

            if (data) {
                const json = JSON.stringify(data);

                wss.clients.forEach(client => client.send(json));
            }
        }

        if (!match && isPlaying && playerList.has(ws)) {
            const path = tokenizer.tokenize(message.text);
            const yomi = path.map(v => v.reading).join('')
            const strLen = yomi.length
            const last = yomi[yomi.length - 1]

            if (last === 'ン') {
                wss.clients.forEach(client => {
                    client.send(JSON.stringify({
                        success: true,
                        type: 'bot',
                        text: `「${message.text}」（${yomi}）は最後に「ン」がついてます！」`
                    }));
                });
                return
            }
            if (yomi[0] !== lastStr) {
                wss.clients.forEach(client => {
                    client.send(JSON.stringify({
                        success: true,
                        type: 'bot',
                        text: `「${message.text}」（${yomi}）は「${lastStr}」から始まっていません」`
                    }));
                });
                return
            }
            const option = {
                host: 'api.instagram.com',
                path: `/v1/tags/${encodeURIComponent(message.text)}?access_token=${token.instagram}`
            };

            const callback = res => {
                const parse = JSON.parse(res);
                let text

                if (parse.meta.code !== 200) {
                    text = `${parse.meta.error_type}\n${parse.meta.error_message}`;
                }
                else if (parse.data.media_count < 5000) {
                    text = `「${message.text}」はあまりオシャレではありません\n「${lastStr}」から始まるオシャレなワードを答えてください`;
                }
                else {
                    lastStr = last
                    text = `「${message.text}」（${yomi}）のオシャレ度は\n${separate(parse.data.media_count)}でした\n${playerList.get(ws)}に+${parse.data.media_count}ポイント！\n次は「${lastStr}」から始まるオシャレなワードを答えてください`;
                }

                wss.clients.forEach(client => {
                    client.send(JSON.stringify({
                        success: true,
                        type: 'bot',
                        text: text
                    }));
                });
            }
            getRequest(option, callback);
        }
    });
    ws.on('close', () => {
        console.log('websocket connection close');
    });
});

let isPlaying = false
let lastStr = ''
const playerList = new Map()

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
        command: oshare
    },
    yomi: {
        description: 'bot yomi {keyword}: 漢字などの読みを返す botが読めない文字があるかも',
        command: yomi
    },
    join: {
        description: 'bot join {yourname}: オシャレしりとりに参加する',
        command: (arg, wss, ws) => {
            console.log(arg, 'hcuhoac')
            playerList.set(ws, arg)
        }
    },
    player: {
        description: 'bot player: 参加している人のリストを返す',
        command: (arg, wss, ws) => {
            let array = []
            for (const value of playerList) {
                array.push(value[1])
            }
            return {
                success: true,
                type: 'bot',
                text: array.join(', ') + 'が参加しています'
            }
        }
    },
    play: {
        description: 'bot play: オシャレしりとりを始める',
        command: playGame
    },
    rule: {
        description: 'bot rule: オシャレしりとりのルールを確認する',
        command: () => ({
            success: true,
            type: 'bot',
            text: 'オシャレしりとりは、60秒間のしりとりの中で、いかにオシャレをアピールできるかを競うゲームです\nしりとりのワードはInstagramでタグ検索され、そのヒット数がそのままポイントになります\nプレイするには、「bot join {yourname}」「bot play」と入力してください'
        })
    }
};

function oshare(arg, wss, ws) {
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

function yomi(arg, wss, ws) {
    // tokenizer is ready
    const path = tokenizer.tokenize(arg);

    const json = JSON.stringify({
        success: true,
        type: 'bot',
        text: path.map(v => v.reading || v.surface_form).join(' ')
    })

    wss.clients.forEach(client => client.send(json))
}

function playGame(arg, wss, ws) {
    if (isPlaying) {
        return {
            success: true,
            type: 'bot',
            text: '現在プレイ中です'
        }
    }
    if (!playerList.has(ws)) {
        return {
            success: true,
            type: 'bot',
            text: 'ゲームに参加していません\nbot join {yourname} で参加してください'
        }
    }

    isPlaying = true

    setTimeout(() => {
        const json = JSON.stringify({
            success: true,
            type: 'bot',
            text: '残り30秒！'
        })

        wss.clients.forEach(client => client.send(json))
    }, 30 * 1000)

    setTimeout(() => {
        const json = JSON.stringify({
            success: true,
            type: 'bot',
            text: '残り10秒！'
        })

        wss.clients.forEach(client => client.send(json))
    }, 50 * 1000)

    setTimeout(() => {
        isPlaying = false

        const json = JSON.stringify({
            success: true,
            type: 'bot',
            text: 'ゲーム終了です'
        })

        wss.clients.forEach(client => client.send(json))
    }, 60 * 1000)

    const list = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワ'

    lastStr = list[Math.random() * list.length | 0]
    return {
        success: true,
        type: 'bot',
        text: `最初の文字は「${lastStr}」です\n「${lastStr}」から始まるオシャレなワードを答えてください`
    }
}

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
