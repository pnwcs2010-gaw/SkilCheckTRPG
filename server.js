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
    console.log(`User connected: ${socket.id}`);

    // สร้างรหัสห้องแบบสุ่ม 5 ตัวอักษร
    const generateRoomCode = () => Math.random().toString(36).substring(2, 7).toUpperCase();

    // สร้างห้อง
    socket.on('create-room', ({ playerName }, callback) => {
        const roomId = generateRoomCode();
        rooms[roomId] = {
            host: socket.id,
            players: [{ id: socket.id, name: playerName || 'Host' }]
        };
        socket.join(roomId);
        console.log(`Room created: ${roomId} by ${socket.id}`);
        callback({ success: true, roomId, players: rooms[roomId].players });
    });

    // เข้าร่วมห้อง
    socket.on('join-room', ({ roomId, playerName }, callback) => {
        const room = rooms[roomId];
        if (room) {
            socket.join(roomId);
            room.players.push({ id: socket.id, name: playerName || `Player_${socket.id.substring(0,4)}` });
            
            // อัปเดตรายชื่อผู้เล่นให้ทุกคนในห้องรู้
            io.to(roomId).emit('update-players', room.players);
            
            callback({ success: true, players: room.players });
            console.log(`User ${socket.id} joined room ${roomId}`);
        } else {
            callback({ success: false, message: 'ไม่พบห้องนี้ กรุณาตรวจสอบรหัสห้องอีกครั้ง' });
        }
    });

    // Host ส่งคำสั่ง Skill Check ไปยังผู้เล่น
    socket.on('send-skillcheck', ({ roomId, targetId, settings }) => {
        const room = rooms[roomId];
        if (room && room.host === socket.id) {
            if (targetId === 'all') {
                // ส่งให้ทุกคนยกเว้น Host
                socket.to(roomId).emit('trigger-skillcheck', settings);
            } else {
                // ส่งให้ผู้เล่นตาม ID ที่เจาะจง
                io.to(targetId).emit('trigger-skillcheck', settings);
            }
        }
    });

    // ลูกห้องส่งผลลัพธ์การกดกลับมาหา Host
    socket.on('skillcheck-result', ({ roomId, result, playerName }) => {
        const room = rooms[roomId];
        if (room) {
            // แจ้งเตือน Host ให้แสดงผลลัพธ์บนจอแดชบอร์ด
            io.to(room.host).emit('player-result', { playerName, result });
        }
    });

    // จัดการกรณีผู้เล่นหลุดการเชื่อมต่อ
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        for (const roomId in rooms) {
            const room = rooms[roomId];
            room.players = room.players.filter(p => p.id !== socket.id);

            if (socket.id === room.host) {
                // ถ้า Host หลุด ให้ยุติห้องหรือแจ้งเตือน
                io.to(roomId).emit('host-disconnected');
                delete rooms[roomId];
            } else {
                io.to(roomId).emit('update-players', room.players);
            }
        }
    });
    
    socket.on('spectate-sync', (data) => {
        socket.to(data.roomId).emit('spectate-sync', data);
    });
    socket.on('spectate-result', (data) => {
    socket.to(data.roomId).emit('spectate-result', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});