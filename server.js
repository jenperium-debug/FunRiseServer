const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Раздача статических файлов
app.use(express.static(path.join(__dirname, 'public')));

// Хранение комнат
const rooms = {};

io.on('connection', (socket) => {
    console.log('Новый игрок подключен:', socket.id);

    // Создание комнаты
    socket.on('createRoom', (data) => {
        const roomId = generateRoomId();
        rooms[roomId] = {
            players: [socket.id],
            playerData: {
                [socket.id]: {
                    x: 2,
                    z: 5,
                    health: 3,
                    floor: 1,
                    alive: true
                }
            },
            granny: {
                x: -5,
                z: -4,
                floor: 1
            },
            items: generateItems()
        };
        socket.join(roomId);
        socket.emit('roomCreated', { roomId });
        console.log(`Комната ${roomId} создана игроком ${socket.id}`);
    });

    // Подключение к комнате
    socket.on('joinRoom', (data) => {
        const roomId = data.roomId;
        if (rooms[roomId]) {
            if (rooms[roomId].players.length >= 2) {
                socket.emit('error', { message: 'Комната полна' });
                return;
            }
            rooms[roomId].players.push(socket.id);
            rooms[roomId].playerData[socket.id] = {
                x: 2 + Math.random() * 3,
                z: 5 + Math.random() * 3,
                health: 3,
                floor: 1,
                alive: true
            };
            socket.join(roomId);
            socket.emit('joinedRoom', { 
                roomId, 
                players: rooms[roomId].players,
                playerData: rooms[roomId].playerData,
                granny: rooms[roomId].granny,
                items: rooms[roomId].items
            });
            
            // Уведомляем других игроков
            socket.to(roomId).emit('playerJoined', {
                playerId: socket.id,
                data: rooms[roomId].playerData[socket.id]
            });
            console.log(`Игрок ${socket.id} подключился к комнате ${roomId}`);
        } else {
            socket.emit('error', { message: 'Комната не найдена' });
        }
    });

    // Обновление позиции игрока
    socket.on('updatePlayer', (data) => {
        const roomId = findRoomByPlayer(socket.id);
        if (!roomId) return;
        
        const room = rooms[roomId];
        if (room && room.playerData[socket.id]) {
            room.playerData[socket.id].x = data.x;
            room.playerData[socket.id].z = data.z;
            room.playerData[socket.id].floor = data.floor;
            room.playerData[socket.id].health = data.health;
            room.playerData[socket.id].alive = data.alive;
            
            socket.to(roomId).emit('playerMoved', {
                playerId: socket.id,
                data: room.playerData[socket.id]
            });
        }
    });

    // Обновление Грэнни
    socket.on('updateGranny', (data) => {
        const roomId = findRoomByPlayer(socket.id);
        if (!roomId) return;
        
        const room = rooms[roomId];
        if (room) {
            room.granny.x = data.x;
            room.granny.z = data.z;
            room.granny.floor = data.floor;
            room.granny.rotation = data.rotation;
            
            socket.to(roomId).emit('grannyMoved', room.granny);
        }
    });

    // Создание шума (падение предмета)
    socket.on('makeNoise', (data) => {
        const roomId = findRoomByPlayer(socket.id);
        if (!roomId) return;
        
        socket.to(roomId).emit('noiseMade', {
            x: data.x,
            z: data.z,
            floor: data.floor
        });
    });

    // Игрок вышел
    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        const roomId = findRoomByPlayer(socket.id);
        if (roomId && rooms[roomId]) {
            rooms[roomId].players = rooms[roomId].players.filter(id => id !== socket.id);
            delete rooms[roomId].playerData[socket.id];
            
            socket.to(roomId).emit('playerLeft', { playerId: socket.id });
            
            // Если комната пуста - удаляем
            if (rooms[roomId].players.length === 0) {
                delete rooms[roomId];
                console.log(`Комната ${roomId} удалена`);
            }
        }
    });
});

// Вспомогательные функции
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function findRoomByPlayer(playerId) {
    for (const [roomId, room] of Object.entries(rooms)) {
        if (room.players.includes(playerId)) {
            return roomId;
        }
    }
    return null;
}

function generateItems() {
    const positions = [
        { x: -2, z: -4 },
        { x: 3, z: -3 },
        { x: -4, z: 3 },
        { x: 4, z: 2 }
    ];
    const colors = ['#8a6a4a', '#6a8a4a', '#4a6a8a', '#8a4a6a'];
    return positions.map((pos, i) => ({
        x: pos.x,
        z: pos.z,
        color: colors[i % colors.length],
        active: true
    }));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
