const socket = io();
let currentRoom = null;
let isHost = false;

document.getElementById('btn-create').addEventListener('click', () => {
    socket.emit('create-room', (res) => {
        if (res.success) {
            currentRoom = res.roomId;
            isHost = true;
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('host-screen').style.display = 'block';
            document.getElementById('room-code-display').innerText = currentRoom;
        }
    });
});

document.getElementById('btn-join').addEventListener('click', () => {
    const roomId = document.getElementById('input-room').value.toUpperCase();
    socket.emit('join-room', roomId, (res) => {
        if (res.success) {
            currentRoom = roomId;
            document.getElementById('login-screen').style.display = 'none';
            alert('เข้าร่วมห้องสำเร็จ! รอรับสกิลเช็คจากหัวหน้าห้อง');
        } else {
            alert(res.message);
        }
    });
});

// Host สั่งส่งสกิลเช็ค
document.getElementById('btn-fire').addEventListener('click', () => {
    const speed = document.getElementById('setting-speed').value;
    const size = document.getElementById('setting-size').value;
    const count = document.getElementById('setting-count').value;
    const targetSocketId = document.getElementById('setting-target').value;

    socket.emit('send-skillcheck', {
        roomId: currentRoom,
        targetSocketId,
        settings: { speed, size, count }
    });
});

// ลูกห้องได้รับคำสั่งให้แสดง Skill Check
socket.on('trigger-skillcheck', (settings) => {
    spawnSkillCheck(settings);
});

// ฟังก์ชันสร้างวง Skill Check (จำลองระบบ DBD)
function spawnSkillCheck(settings) {
    const container = document.getElementById('skillcheck-container');
    // สร้าง Canvas หรือ DOM Elements สำหรับวงกลมสกิลเช็ค
    // วาดวงกลม พื้นที่สีขาว (Success Zone) และเข็มที่กำลังหมุนด้วย requestAnimationFrame
    console.log("ได้รับสกิลเช็คด้วยการตั้งค่า:", settings);
    
    // ตัวอย่างการกด Spacebar เพื่อเช็คผลลัพธ์
    window.addEventListener('keydown', function handleKeyPress(e) {
        if (e.code === 'Space') {
            // เช็คว่าเข็มอยู่ในโซนสีขาวหรือไม่ แล้วส่งผลลัพธ์กลับหา Host หรือแสดงผลบนจอ
            console.log("กด Spacebar แล้ว!");
            window.removeEventListener('keydown', handleKeyPress);
        }
    });
}