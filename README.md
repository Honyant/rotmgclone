# RotMG Clone

A multiplayer browser-based game clone inspired by Realm of the Mad God, built with TypeScript, WebSockets, and Canvas rendering.

## Features

- **Three playable classes**: Wizard, Warrior, and Archer - each with unique stats, weapons, and abilities
- **Procedurally generated dungeons**: Branching room layouts with boss rooms
- **Real-time multiplayer**: WebSocket-based server with support for multiple players
- **Instance system**: Nexus hub, open Realm areas, and instanced dungeons
- **Combat system**: Projectile-based combat with different weapon types and enemy behaviors
- **Loot system**: Tiered items (T0-T4) dropped by enemies in loot bags
- **Permadeath**: Characters are permanently lost on death
- **Inventory management**: Equipment slots and inventory with click-to-swap
- **Minimap**: Real-time minimap showing terrain, players, enemies, and portals
- **Visual effects**: Particle effects for abilities, level-ups, and buffs

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
│       ├── game/           # Entities, spatial hash, game map
│       └── persistence/    # SQLite database
├── client/          # Browser client
│   └── src/
│       ├── game/           # Main game class, input handling
│       ├── rendering/      # Canvas-based renderer with interpolation
│       └── network/        # WebSocket client
└── package.json     # Workspace configuration
```

## Tech Stack

- **Language**: TypeScript
- **Server Runtime**: Bun (recommended) or Node.js
- **Networking**: WebSocket with MessagePack binary protocol
- **Client**: Vite + Canvas 2D rendering
- **Database**: SQLite (sql.js) for persistence
- **Architecture**: Monorepo with npm workspaces

### Performance Optimizations

- **Spatial Hashing**: O(1) collision detection via grid-based entity lookup
- **Binary Protocol**: MessagePack serialization (~40% smaller than JSON, 2-5x faster)
- **Bun Runtime**: 3-4x faster execution compared to Node.js

## Getting Started

### Prerequisites

- Node.js 18+ or Bun 1.0+
- npm

### Installation

```bash
# Install dependencies
npm install

# Build all packages
npm run build
```

### Running the Game

**With Bun (recommended for performance):**
```bash
# Terminal 1: Start the server with Bun
cd server && npm run dev:bun

# Terminal 2: Start the client dev server
cd client && npm run dev
```

**With Node.js:**
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
| F | Interact (portals, loot) |
| R | Return to Nexus |
| Q/E | Rotate camera |
| Z | Reset camera rotation |
| Enter | Open chat |
| H (hold) | Show controls |
| Shift+Click | Drop item |

## Game Content

### Classes

| Class | HP | Weapon | Ability | Playstyle |
|-------|-----|--------|---------|-----------|
| Wizard | Low | Staff | Spell Bomb (AOE damage) | High damage, ranged |
| Warrior | High | Sword | Helm (Speed buff) | Melee tank |
| Archer | Medium | Bow | Quiver (Piercing shot) | Balanced ranged |

### Enemies

- **Snake**: Low-tier wandering enemy
- **Pirate**: Chases players, moderate difficulty
- **Demon**: Orbits players, fires spread shots, can drop dungeon portals
- **Cube God**: Stationary boss with heavy damage
- **Dungeon Minion/Guardian/Boss**: Found in dungeons with increasing difficulty

### Items

- **Weapons**: T0-T4 staffs, swords, and bows
- **Armor**: Robes, leather armor, and heavy armor
- **Abilities**: Class-specific (spell bombs, helms, quivers)
- **Rings**: Stat-boosting accessories

### Loot Bags

Items drop in colored bags based on tier:
- Brown: T0-T1
- Silver: T1-T2
- Gold: T3-T4
- Cyan: T5-T6
- Purple: T7+ (soulbound)

## Development

```bash
# Build shared package only
npm run build --workspace=@rotmg/shared

# Build server only
npm run build --workspace=@rotmg/server

# Run server in dev mode with hot reload (Node.js)
npm run dev:server

# Run server in dev mode with hot reload (Bun - faster)
cd server && npm run dev:bun
```

## Architecture

The game uses an authoritative server model:

1. **Client** sends input (movement, shooting, interactions) via MessagePack
2. **Server** validates and processes all game logic
3. **Server** uses spatial hashing for efficient collision detection
4. **Server** broadcasts state updates to clients via MessagePack
5. **Client** interpolates positions and renders the game state

Instances are isolated game worlds (Nexus, Realm, Dungeon) that players can move between via portals.

### Network Protocol

Messages are serialized using MessagePack binary format for optimal performance:
- ~40% smaller payloads than JSON
- 2-5x faster serialization/deserialization
- Backwards compatible with JSON fallback on server
