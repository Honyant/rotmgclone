import { Game } from './game/Game';

const game = new Game();
game.start().catch(console.error);
