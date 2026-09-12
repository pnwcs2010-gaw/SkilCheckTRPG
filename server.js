const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// เปิดให้ใช้ไฟล์ในโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public')));

// เก็บข้อมูลห้อง: { roomId: { host: socketId, players: [{id, name}], settings } }
const rooms = {};

io.on('connection', (socket) => {
    // สร้างห้อง
    socket.on('create-room', ({ playerName }, callback) => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        rooms[roomId] = {
            host: socket.id,
            players: [{ id: socket.id, name: playerName }]
        };
        socket.join(roomId);
        callback({ success: true, roomId, players: rooms[roomId].players });
    });

    // เข้าร่วมห้อง
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

    // ส่ง Skill Check ไปหาผู้เล่น (เพิ่มการดึงชื่อคนรับเพื่อให้หน้าจอเพื่อนแสดงชื่อถูก)
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

    // ซิงค์การหมุนของเข็มให้คนอื่นเห็นแบบเรียลไทม์ (Spectate Mode)
    socket.on('spectate-sync', (data) => {
        socket.to(data.roomId).emit('spectate-sync', data);
    });

    // ซิงค์ผลลัพธ์การกด (Success / Perfect / Fail) ให้คนอื่นเห็นเอฟเฟกต์พร้อมกัน
    socket.on('spectate-result', (data) => {
        socket.to(data.roomId).emit('spectate-result', data);
    });

    // รับผลลัพธ์ไปแสดงที่ Live Feed ของ Host
    socket.on('skillcheck-result', (data) => {
        io.to(data.roomId).emit('player-result', data);
    });

    // ออกจากห้อง / ตัดการเชื่อมต่อ
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

    // สัญญาณแจ้งว่าผู้เล่นเล่นจบครบทุกรอบแล้ว ให้ปิดหน้าจอผู้ชมทั้งหมด
    socket.on('spectate-end', (data) => {
        socket.to(data.roomId).emit('spectate-end');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});