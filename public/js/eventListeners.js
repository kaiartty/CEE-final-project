let mouseX = 0;
let mouseY = 0;
let lastShotTime = 0; // Tracks the last time a shot was fired
const cooldown = 300; // Cooldown duration in milliseconds (e.g., 500ms)

// Track mouse position relative to the canvas
document.addEventListener('mousemove', (event) => {
  const canvas = document.querySelector('canvas');
  const { top, left } = canvas.getBoundingClientRect();

  mouseX = event.clientX - left; // Mouse X relative to canvas
  mouseY = event.clientY - top;  // Mouse Y relative to canvas
});

// Shoot when the space bar is pressed
document.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    const currentTime = Date.now();

    // Check if the cooldown period has passed
    if (currentTime - lastShotTime < cooldown) {
      console.log('On cooldown, wait before shooting again');
      return;
    }

    const canvas = document.querySelector('canvas');

    if (!frontEndPlayers[socket.id]) {
      console.warn('Player not initialized yet');
      return; // Ensure the player exists before shooting
    }

    const playerPosition = {
      x: frontEndPlayers[socket.id].x,
      y: frontEndPlayers[socket.id].y,
    };

    // Calculate the angle from the player to the mouse position
    const angle = Math.atan2(mouseY - playerPosition.y, mouseX - playerPosition.x);

    // Emit the shoot event to the backend with position and angle
    socket.emit('shoot', {
      x: playerPosition.x,
      y: playerPosition.y,
      angle,
    });

    console.log('Bullet fired:', {
      x: playerPosition.x,
      y: playerPosition.y,
      angle,
    });

    // Update the last shot time
    lastShotTime = currentTime;
  }
});
