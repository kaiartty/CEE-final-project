const express = require('express');
const app = express();

// socket.io setup
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { pingInterval: 2000, pingTimeout: 5000 });

const port = process.env.PORT || 3000;
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI; // Ensure this environment variable is set
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


let playersCollection;

// Connect to MongoDB
async function connectDB() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db('gameDB');
        playersCollection = db.collection('players');
    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    }
}

connectDB();

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const backEndPlayers = {};
const backEndProjectiles = {};

const SPEED = 5;
const RADIUS = 10;
const PROJECTILE_RADIUS = 5;
let projectileId = 0;

// Save player score to the database
async function savePlayerScore(username, score) {
    try {
        await playersCollection.updateOne(
            { username },
            { $set: { score } },
            { upsert: true } // Insert if the username doesn't exist
        );
        console.log(`Saved score for ${username}: ${score}`);
    } catch (err) {
        console.error('Error saving player score:', err);
    }
}

// Handle socket connections
io.on('connection', (socket) => {
    console.log('A user connected');

    io.emit('updatePlayers', backEndPlayers);

    socket.on('shoot', ({ x, y, angle }) => {
        projectileId++;

        const velocity = {
            x: Math.cos(angle) * 5,
            y: Math.sin(angle) * 5,
        };

        backEndProjectiles[projectileId] = {
            x,
            y,
            velocity,
            playerId: socket.id,
        };
    });

    socket.on('initGame', ({ username, width, height,screen_width,screen_height }) => {
        backEndPlayers[socket.id] = {
            x: Math.random() * 1024, // Ensure within horizontal bounds
            y: Math.random() * 768, 
            color: `hsl(${360 * Math.random()}, 100%, 50%)`,
            sequenceNumber: 0,
            score: 0,
            username,
            sc_width: screen_width,
            sc_height: screen_height,
            canvas: { width, height },
            radius: RADIUS,
        };

    });

    socket.on('disconnect', async () => {
        console.log(`User ${socket.id} disconnected`);

        if (backEndPlayers[socket.id]) {
            const { username, score } = backEndPlayers[socket.id];
            await savePlayerScore(username, score); // Save the player's score
        }

        delete backEndPlayers[socket.id];
        io.emit('updatePlayers', backEndPlayers);
    });

    socket.on('keydown', ({ keycode, sequenceNumber }) => {
        const backEndPlayer = backEndPlayers[socket.id];
        if (!backEndPlayer) return;

        const { width, height } = backEndPlayer.canvas;

        backEndPlayer.sequenceNumber = sequenceNumber;
        switch (keycode) {
          case 'KeyW': // Move up
              backEndPlayer.y = Math.max(backEndPlayer.y - SPEED, backEndPlayer.radius);
              break;
  
          case 'KeyA': // Move left
              backEndPlayer.x = Math.max(backEndPlayer.x - SPEED, backEndPlayer.radius);
              break;
  
          case 'KeyS': // Move down
              backEndPlayer.y = Math.min(backEndPlayer.y + SPEED, backEndPlayer.canvas.height - backEndPlayer.radius);
              break;
  
          case 'KeyD': // Move right
              backEndPlayer.x = Math.min(backEndPlayer.x + SPEED, backEndPlayer.canvas.width - backEndPlayer.radius);
              break;
        }

        const playerSides = {
            left: backEndPlayer.x - backEndPlayer.radius,
            right: backEndPlayer.x + backEndPlayer.radius,
            top: backEndPlayer.y - backEndPlayer.radius,
            bottom: backEndPlayer.y + backEndPlayer.radius,
        };
        //console.log(backEndPlayer.sc_height);
        if (playerSides.left < 0) backEndPlayer.x = backEndPlayer.radius;
        if (playerSides.right > backEndPlayer.sc_width) backEndPlayer.x = backEndPlayer.sc_width - backEndPlayer.radius;
        if (playerSides.top < 0) backEndPlayer.y = backEndPlayer.radius;
        if (playerSides.bottom > backEndPlayer.sc_height) backEndPlayer.y = backEndPlayer.sc_height - backEndPlayer.radius;
    });
});

// Backend ticker
setInterval(() => {
    for (const id in backEndProjectiles) {
        const projectile = backEndProjectiles[id];
        const player = backEndPlayers[projectile.playerId];
        if (!player) continue;

        const { width, height } = player.canvas;

        projectile.x += projectile.velocity.x;
        projectile.y += projectile.velocity.y;

        if (
            projectile.x - PROJECTILE_RADIUS >= width ||
            projectile.x + PROJECTILE_RADIUS <= 0 ||
            projectile.y - PROJECTILE_RADIUS >= height ||
            projectile.y + PROJECTILE_RADIUS <= 0
        ) {
            delete backEndProjectiles[id];
            continue;
        }

        for (const playerId in backEndPlayers) {
            const backEndPlayer = backEndPlayers[playerId];

            const DISTANCE = Math.hypot(
                projectile.x - backEndPlayer.x,
                projectile.y - backEndPlayer.y
            );

            // Collision detection
            if (
                DISTANCE < PROJECTILE_RADIUS + backEndPlayer.radius &&
                projectile.playerId !== playerId
            ) {
                if (backEndPlayers[projectile.playerId])
                    backEndPlayers[projectile.playerId].score++;

                delete backEndProjectiles[id];
                delete backEndPlayers[playerId];
                break;
            }
        }
    }

    io.emit('updateProjectiles', backEndProjectiles);
    io.emit('updatePlayers', backEndPlayers);
}, 15);

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

console.log('Server did load');
