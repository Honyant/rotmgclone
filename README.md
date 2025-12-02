# RotMG Clone

A multiplayer browser-based game clone inspired by Realm of the Mad God, built with TypeScript, WebSockets, and Canvas rendering.

## Features

- **Three playable classes**: Wizard, Warrior, and Archer - each with unique stats, weapons, and abilities
- **Procedurally generated dungeons**: Branching room layouts with boss rooms
- **Real-time multiplayer**: WebSocket-based server with support for multiple players
- **Instance system**: Nexus hub, open Realm areas, and instanced dungeons
- **Combat system**: Projectile-based combat with different weapon types and enemy behaviors
- **Loot system**: Tiered items (T0-T4) dropped by enemies in loot bags
- **Inventory management**: Equipment slots and inventory with drag-and-drop
- **Minimap**: Real-time minimap showing terrain, players, enemies, and portals

## Project Structure

```
rotmg/
├── shared/          # Shared types, definitions, and game data
│   └── src/
│       ├── types.ts        # TypeScript interfaces and types
│       └── definitions.ts  # Game data (classes, items, enemies, etc.)
├── server/          # Game server
│   └── src/
│       ├── network/        # WebSocket server and message handling
│       ├── instances/      # Instance management (Nexus, Realm, Dungeon)
│       ├── entities/       # Player and enemy logic
│       └── game/           # Game map and core logic
├── client/          # Browser client
│   └── src/
│       ├── game/           # Main game class and state management
│       ├── rendering/      # Canvas-based renderer
│       └── network/        # WebSocket client
└── package.json     # Workspace configuration
```

## Tech Stack

- **Language**: TypeScript
- **Server**: Node.js with WebSocket (ws)
- **Client**: Vite + Canvas 2D rendering
- **Database**: SQLite (sql.js) for persistence
- **Architecture**: Monorepo with npm workspaces

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Install dependencies
npm install

# Build all packages
npm run build
```

### Running the Game

```bash
# Terminal 1: Start the server
npm run start:server

# Terminal 2: Start the client dev server
npm run dev:client
```

The game will be available at `http://localhost:3000`.

## Controls

| Key | Action |
|-----|--------|
| W/A/S/D | Move |
| Mouse | Aim |
| Left Click | Shoot |
| Space | Use ability |
| F | Interact with portal |
| Q/E | Rotate camera |
| Z | Reset camera rotation |
| R | Return to Nexus |
| Enter | Open chat |
| 1-8 | Use inventory items |

## Game Content

### Classes

| Class | HP | Weapon | Playstyle |
|-------|-----|--------|-----------|
| Wizard | Low | Staff | High damage, ranged |
| Warrior | High | Sword | Melee tank |
| Archer | Medium | Bow | Balanced ranged |

### Enemies

- **Snake**: Low-tier wandering enemy
- **Pirate**: Chases players, moderate difficulty
- **Demon**: Orbits players, fires spread shots
- **Cube God**: Stationary boss with heavy damage
- **Dungeon Minion/Guardian/Boss**: Found in dungeons

### Items

- **Weapons**: T0-T4 staffs, swords, and bows
- **Armor**: Robes, leather, and heavy armor
- **Abilities**: Class-specific (spells, helms, quivers)
- **Rings**: Stat-boosting accessories

## Development

```bash
# Build shared package only
npm run build --workspace=@rotmg/shared

# Build server only
npm run build --workspace=@rotmg/server

# Run server in dev mode with hot reload
npm run dev:server
```

## Architecture

The game uses an authoritative server model:

1. **Client** sends input (movement, shooting, interactions)
2. **Server** validates and processes all game logic
3. **Server** broadcasts state updates to clients
4. **Client** interpolates and renders the game state

Instances are isolated game worlds (Nexus, Realm, Dungeon) that players can move between via portals.
