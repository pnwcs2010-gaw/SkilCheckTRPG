const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const rooms = {};

io.on('connection', (socket) => {
    socket.on('create-room', ({ playerName }, callback) => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        rooms[roomId] = {
            host: socket.id,
            players: [{ id: socket.id, name: playerName }]
        };
        socket.join(roomId);
        callback({ success: true, roomId, players: rooms[roomId].players });
    });

    socket.on('join-room', ({ roomId, playerName }, callback) => {
        roomId = roomId.toUpperCase();
        if (rooms[roomId]) {
            rooms[roomId].players.push({ id: socket.id, name: playerName });
            socket.join(roomId);
            callback({ success: true, players: rooms[roomId].players });
            io.to(roomId).emit('update-players', rooms[roomId].players);
        } else {
            callback({ success: false, message: 'ไม่พบรหัสห้องนี้' });
        }
    });

    socket.on('send-skillcheck', ({ roomId, targetId, settings }) => {
        if (rooms[roomId]) {
            let targetName = "ทุกคนในห้อง";
            if (targetId !== 'all') {
                const targetPlayer = rooms[roomId].players.find(p => p.id === targetId);
                if (targetPlayer) targetName = targetPlayer.name;
            }

            io.to(roomId).emit('trigger-skillcheck', {
                targetId,
                targetName,
                settings
            });
        }
    });

    // ซิงค์ตำแหน่งเข็มแบบเรียลไทม์ให้ผู้ชม
    socket.on('spectate-sync', (data) => {
        socket.to(data.roomId).emit('spectate-sync', data);
    });

    // ซิงค์ผลลัพธ์การกด (Success / Perfect / Fail)
    socket.on('spectate-result', (data) => {
        socket.to(data.roomId).emit('spectate-result', data);
    });

    // สัญญาณปิดหน้าจอเมื่อเล่นครบทุกรอบ
    socket.on('spectate-end', (data) => {
        socket.to(data.roomId).emit('spectate-end');
    });

    socket.on('skillcheck-result', (data) => {
        io.to(data.roomId).emit('player-result', data);
    });

    socket.on('disconnect', () => {
        for (let roomId in rooms) {
            let room = rooms[roomId];
            let index = room.players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                room.players.splice(index, 1);
                if (room.host === socket.id) {
                    io.to(roomId).emit('host-disconnected');
                    delete rooms[roomId];
                } else {
                    io.to(roomId).emit('update-players', room.players);
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});