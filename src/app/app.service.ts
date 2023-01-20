import {Injectable, Logger} from '@nestjs/common';
import {HelperService} from "../helper/helper.service";
import axios from "axios";

const instance = axios.create({
    baseURL: 'API URL',
    timeout: 5000
});

const colorList = ['yellow', 'black', 'red', 'blue', 'orange', 'green', 'purple', 'cyan', 'teal', 'gray', 'maroon', 'brown', 'lime', 'pink']

export interface Player {
    color: string
    points: number,
    id: string,
    ready: boolean,
    colorList: string[]
}

export interface Result {
    result: "message" | "error" | "result",
    message?: string,
    err?: string,
    winner?: string,
    color?: string
}

@Injectable()
export class AppService {
    //lobby name
    lobbyName = "";

    //helper services
    private helper = new HelperService();
    private logger: Logger = new Logger('AppService');

    //variables
    private solo: boolean = false;
    private currentGameState: "in_progress" | "waiting" | "done"
    players: Player[] = [];
    winner: string = null;

    //add new player
    addNewPlayer(player: string, solo?: boolean): Result {
        //    if this player is already exists
        if (this.players.some(p => p.id === player))
            return {result: "error", err: "Player with this id already connected"}

        if (solo)
            this.solo = true;

        this.players.push({id: player, color: '', points: 0, ready: false, colorList: []})
        this.logger.log(`Player #${player} has been connected, [${this.lobbyName}]`)
        return {result: "message", message: `Player #${player} has been connected`}
    }

    getPlayer(id): Player {
        return this.players.filter(x => x.id === id)[0];
    }

    //remove player from game
    removePlayer(player: string): Result {
        //    if this player is already exists
        if (!this.players.some(p => p.id === player))
            return {result: "error", err: "Player with this id not connected"}

        this.players = this.players.filter(p => p.id !== player);

        if (this.currentGameState === "in_progress")
            this.winner = this.players[0]?.id;

        this.logger.log(`Player #${player} has been disconnected, [${this.lobbyName}]`)
        return {result: "message", message: `Player #${player} has been disconnected`}
    }

    skipColor(id): { status: boolean, message?: string, points: number, color: string } {
        const player = this.getPlayer(id);
        const colorIndex = player.colorList.findIndex(c => c === player.color);
        const notIncluded = colorList.filter(c=>!player.colorList.includes(c));
        if(notIncluded.length === 0)
            return {status: false, message: 'You cant swap right now.', points: player.points, color: player.color}

        const _newColor = colorList[this.helper.getRandomInt(colorList.length - 1)];

        player.colorList[colorIndex] = _newColor;
        player.color = _newColor;

        return {status: true, points: player.points, color: player.color}
    }

    generateColors(): string[] {
        let cloneColors = Array.from(colorList);
        let newColors = []
        while (newColors.length < 5) {
            const random = this.helper.getRandomInt(cloneColors.length - 1);
            newColors.push(...cloneColors.splice(random, 1));
        }

        this.players.forEach(p => p.color = newColors[0]);
        return newColors;
    }

    readyPlayer(id: string) {
        this.players.forEach(p => {
            if (p.id === id)
                p.ready = true;
        })
    }

    unReadyPlayer(id: string) {
        this.players.forEach(p => {
            if (p.id === id)
                p.ready = false;
        })
    }

    gameEnd() {
        this.currentGameState = 'done';
        console.log("end")
        if (this.winner)
            return {
                points: this.players
                    .filter(p => p.id === this.winner)[0].points, winner: this.winner
            };

        if (this.solo) {
            const points = this.players[0].points;
            this.winner = points === 5 ? this.players[0].id : null;
            return {points: points, winner: this.winner}
        } else {
            if (this.players[0].points > this.players[1].points) {
                this.winner = this.players[0].id;
                return {points: this.players[0].points, winner: this.players[0].id}
            } else if (this.players[0].points < this.players[1].points) {
                this.winner = this.players[1].id;
                return {points: this.players[1].points, winner: this.players[1].id}
            } else {
                this.winner = 'draw';
                return {points: this.players[0].points, winner: 'draw'}
            }
        }
    }

    //start the game
    startGame(): Result {
        //    if not enough players
        if (this.players.length === 0 || this.players.length < 2 && !this.solo)
            return {result: "error", err: "For start game should be 2 players!"}

        if (this.players.filter(p => p.ready).length !== this.players.length)
            return {result: "error", err: "Not all players are ready!"}

        // if game is already started
        if (this.currentGameState === "in_progress")
            return {result: "error", err: "Game is already started!"}

        //reset all variables
        this.winner = null;
        this.logger.log(`Game started!, [${this.lobbyName}]`)

        const _colors = this.generateColors();
        this.players.forEach(p => {
            p.colorList = _colors;
            p.points = 0;
        });

        this.currentGameState = "in_progress";

        return {
            result: "message",
            message: `Game started!, [${this.lobbyName}]`,
            color: _colors[0]
        };
    }

    getData(playerId: string, image: string, onResult: (result: { winner: string, isCorrect: boolean, points: number, color: string }) => void, onErr): any {
        if (this.currentGameState !== "in_progress") {
            onErr('Game is not started!');
            return;
        }

        const player = this.getPlayer(playerId);
        instance.post('', {imgb64: image, color: player.color}).then(res => {
            const result = this.helper.IsChildColor(res.data.defined_closest_color, player.color);

            if (result) {
                player.points += 1;
                console.log(player.points)
                if (player.points === 5) {
                    this.currentGameState = 'done';
                    this.winner = playerId;
                } else {
                    const colorIndex = player.colorList.findIndex(c => c === player.color);
                    player.color = player.colorList[colorIndex + 1];
                }
            }
            onResult({isCorrect: result, points: player.points, winner: this.winner ?? "", color: player.color})
        }).catch(err => {
            onErr('ERROR')
        })
    }

    //get current game points
    getPlayersStats(): Player[] {
        return this.players;
    }
}
