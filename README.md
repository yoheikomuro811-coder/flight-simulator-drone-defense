# Drone Defense: Strait of Taiwan

This project is a lightweight browser-based multiplayer drone defense game built as a simple prototype for an economics class project. The simulation places players in a real-time defense scenario over the Strait of Taiwan, where they pilot drones and shoot down hostile drones before they breach the defense ring.

Features:
- Real-time multiplayer using Socket.IO
- Browser-based flight controls with keyboard input
- Defense objective with enemy drones, projectiles, and a central base
- Resource tracking through credits and wave progression
- Taiwan Strait themed environment and HUD

## Quick start

1. Install dependencies:
   npm install
2. Start the server:
   npm start
3. Open the app in a browser:
   http://localhost:3000

## Controls
- W / A / S / D or arrow keys: move your drone
- Space: fire weapons

## Economics angle
The game includes a simple cost-benefit loop:
- Each enemy destroyed earns credits
- Widening enemy waves increase pressure on the defense system
- Players balance survival and resource gain during combat

This makes it suitable for a class discussion around strategy, scarcity, defense spending, and payoff optimization.

## Notes
This is intentionally a compact prototype rather than a full commercial game. It is designed to be easy to run and easy to extend for coursework or a classroom demo.
