import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway, WebSocketServer
} from '@nestjs/websockets';
import {Logger} from "@nestjs/common";
import {Socket, Server} from "socket.io";
import {AppService} from "./app.service";
import {HelperService} from "../helper/helper.service";

interface Room {
    room: string,
    players: { id: string, creator: boolean }[]
    service: AppService,
    soloPlayer: boolean,
    round: number,
    timer: any
}

interface DefaultResponse {
    status: boolean,
    message?: string | boolean,
    client?: string,
    data?: any,
    winner?: string
}

@WebSocketGateway()
export class AppGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {

    @WebSocketServer() wss: Server;

    private rooms: Room[] = [];
    private logger: Logger = new Logger('AppGateway');
    private helper = new HelperService();

    //Initialize server
    afterInit(server: Server): any {
        this.logger.log(`Initialized!`)
    }

    //handle connection to ws
    //return connected, with args {id: string}
    handleConnection(client: Socket, ...args: any[]): any {
        this.logger.log(`Client connected: ${client.id}`)
        client.emit('connected', {id: client.id});
        this.logger.debug(`Rooms: ${this.rooms.map(r => r.room)}`)
    }

    //handle disconnection from ws
    handleDisconnect(client: Socket): any {
        this.logger.log(`Client disconnected: ${client.id}`)
        const _userRooms = this.rooms.filter(r => r.players.some(u => u.id === client.id))
        _userRooms.forEach(r => {
            this.handleLeaveRoom(client, {room: r.room}, true);
        })
    }

    //get user rooms
    getUserRooms(client: Socket) {
        return Array.from(client.rooms.values()).filter(x => x !== client.id);
    }

    //get room object by name
    getRoom(room: string) {
        if (this.isRoomExists(room))
            return this.rooms[this.rooms.findIndex(r => r.room === room)];
        else return null;
    }

    //check if room exists
    isRoomExists(room: string) {
        return this.rooms.some(r => r.room === room)
    }

    //event on 'createRoom'
    //return joinedRoom, with args {status: true | false, message?: string} as DefaultResponse
    //return createdRoomName, with args {status: true | false, message?: string} as DefaultResponse
    @SubscribeMessage('createRoom')
    handleCreateRoom(client: Socket, data: {solo?: boolean}): void {
        //if user already in room, he cant connect to other
        if (this.getUserRooms(client).length > 0) {
            client.emit('createdRoomName', <DefaultResponse>{status: false});
            client.emit('joinedRoom', <DefaultResponse>{
                status: false,
                message: "You already in another room! Please leave."
            });
            return;
        }

        //generate random room code
        let room = this.helper.makeid(4, true);
        while (this.isRoomExists(room))
            room = this.helper.makeid(4, true);

        //create new room object
        const newRoomObj = {
            room: room,
            players: [{id: client.id, creator: true}],
            service: new AppService(),
            soloPlayer: data.solo ?? false,
            round: 1
        } as Room;
        newRoomObj.service.lobbyName = room;
        this.rooms.push(newRoomObj);

        this.logger.log(`Client ${client.id} created room: ${room}`)

        newRoomObj.service.addNewPlayer(client.id, data.solo);

        client.join(room);
        client.emit('createdRoomName', <DefaultResponse>{status: true, data: room});
        client.emit('joinedRoom', <DefaultResponse>{status: true, client: client.id, data: {players: [{id: client.id, ready: false}]}});
    }

    //event on 'joinRoom'
    //return joinedRoom, with args {status: true | false, message?: string} as DefaultResponse
    @SubscribeMessage('joinRoom')
    handleJoinRoom(client: Socket, data: {room: string}): void {
        //if the user is already in the room, he cannot connect to another
        if (this.getUserRooms(client).length > 0) {
            client.emit('joinedRoom', <DefaultResponse>{
                status: false,
                message: "You already in another room! Please leave."
            });
            return;
        }

        //if room doesnt exists user get exception
        if (!this.isRoomExists(data.room)) {
            client.emit('joinedRoom', <DefaultResponse>{status: false, message: "Room doesnt exists!"})
            return;
        }

        //get current room
        //add new player to game lobby and in array of players
        const _rm = this.getRoom(data.room);
        if (_rm.soloPlayer) {
            client.emit('joinedRoom', <DefaultResponse>{status: false, message: "This room only for 1 player!"})
            return;
        }

        _rm.players.push({id: client.id, creator: false})
        _rm.service.addNewPlayer(client.id);

        this.logger.log(`Client ${client.id} joined to room: ${data.room}`)

        client.join(data.room);

        const players = _rm.service.players.map(p=>{
            return {id: p.id, ready: p.ready}
        });

        this.wss.to(data.room).emit('joinedRoom', <DefaultResponse>{status: true, client: client.id, data: {players: players}});
    }

    //event on 'leaveRoom'
    //return leavedRoom, with args {status: true | false, message?: string, client?: string} as DefaultResponse
    @SubscribeMessage('leaveRoom')
    handleLeaveRoom(client: Socket, data: {room: string}, force: boolean = false): void {
        //user cant leave from a room in which he is not a member
        if (!this.getUserRooms(client).includes(data.room) && !force) {
            client.emit('leavedRoom', <DefaultResponse>{status: false, message: "You doesnt connected to this room!"})
            return;
        }

        //if room doesnt exists user get exception
        if (!this.isRoomExists(data.room)) {
            client.emit('leavedRoom', <DefaultResponse>{status: false, message: "Room doesnt exists!"})
            return;
        }

        //get current room
        const _rm = this.getRoom(data.room);

        //remove from players, player which leave
        _rm.service.removePlayer(client.id);
        _rm.players = _rm.players.filter(p => p.id !== client.id);

        //check if there is no creator in the room
        //if not give creator for 1 player
        //if not enough players remove room
        if (_rm.players.length > 0 && !_rm.players.some(p => p.creator))
            _rm.players[0].creator = true;
        else if (_rm.players.length === 0)
            this.rooms = this.rooms.filter(r => r.room !== data.room);

        this.logger.log(`Client ${client.id} leave from room: ${data.room}`)
        this.wss.to(data.room).emit('leavedRoom', <DefaultResponse>{status: true, client: client.id});
        client.leave(data.room);

        clearInterval(_rm.timer);
        //if there is a winner in the room, tell about it others
        if (_rm.service.winner && _rm.service.players.length !== 0)
        {
            const winner = _rm.service.players[0];
            this.wss.to(data.room).emit('gameEnded', <DefaultResponse>{status: true, data: {points: winner.points, winner: winner.id}})
        }
    }

    //event on 'startGame'
    //return gameStarted, with args {status: true | false, message?: string, dips?: Player[]} as DefaultResponse
    //return playersDips, with args [{player: Player, dip: "X" | "O"}]
    @SubscribeMessage('startGame')
    handleStartGame(client: Socket, data: {room: string}): void {
        //if room doesnt exists user get exception
        if (!this.isRoomExists(data.room)) {
            client.emit('gameStarted', <DefaultResponse>{status: false, message: "Room doesnt exists!"})
            return;
        }

        //get current room
        const _rm = this.getRoom(data.room);

        //call startGame method
        const result = _rm.service.startGame();

        //if we had error, tell it to user
        if (result.result === "error") {
            client.emit('gameStarted', <DefaultResponse>{status: false, message: result.err})
            return;
        }

        let delay = 5;
        let time = 60;

        this.wss.to(data.room).emit('gameStarted', <DefaultResponse>{status: true, data: {color: result.color, round: 1}})

        let countdown = setInterval(() => {
            if(delay !== 0)
            {
                this.wss.to(data.room).emit('countdown', <DefaultResponse>{status: true, data: {timeLeft: delay}})
                delay--;
            }
            else
            {
                clearInterval(countdown);
                _rm.timer = setInterval(()=>{
                    if(time !== 0)
                    {
                        if(_rm.service.winner)
                        {
                            clearInterval(_rm.timer);
                            return;
                        }

                        this.wss.to(data.room).emit('time', <DefaultResponse>{status: true, data: {timeLeft: time}})
                        time--;
                    }
                    else {
                        const _endData = _rm.service.gameEnd();
                        this.wss.to(data.room).emit('gameEnded', <DefaultResponse>{status: true, data: _endData});
                        clearInterval(_rm.timer);
                    }
                }, 1000)
            }
        }, 1000)
    }

    @SubscribeMessage('ready')
    handleReady(client: Socket, data: {room: string}): void {
        //if room doesnt exists user get exception
        if (!this.isRoomExists(data.room)) {
            client.emit('ready', <DefaultResponse>{status: false, message: "Room doesnt exists!"})
            return;
        }

        //user cant leave from a room in which he is not a member
        if (!this.getUserRooms(client).includes(data.room)) {
            client.emit('ready', <DefaultResponse>{status: false, message: "You doesnt connected to this room!"})
            return;
        }

        //get current room
        const _rm = this.getRoom(data.room);
        _rm.service.readyPlayer(client.id)

        this.wss.to(data.room).emit('ready', <DefaultResponse>{status: true, data: {ready: client.id}})
    }

    @SubscribeMessage('unready')
    handleUnReady(client: Socket, data: {room: string}): void {
        //if room doesnt exists user get exception
        if (!this.isRoomExists(data.room)) {
            client.emit('ready', <DefaultResponse>{status: false, message: "Room doesnt exists!"})
            return;
        }

        //user cant leave from a room in which he is not a member
        if (!this.getUserRooms(client).includes(data.room)) {
            client.emit('ready', <DefaultResponse>{status: false, message: "You doesnt connected to this room!"})
            return;
        }

        //get current room
        const _rm = this.getRoom(data.room);

        _rm.service.unReadyPlayer(client.id);

        this.wss.to(data.room).emit('unready', <DefaultResponse>{status: true, data: {unready: client.id}})
    }

    @SubscribeMessage('skipColor')
    handleSkipColor(client: Socket, data: { room: string}): void {
        //if room doesnt exists user get exception
        if (!this.isRoomExists(data.room)) {
            client.emit('skipColor', <DefaultResponse>{status: false, message: "Room doesnt exists!"})
            return;
        }

        //user cant leave from a room in which he is not a member
        if (!this.getUserRooms(client).includes(data.room)) {
            client.emit('skipColor', <DefaultResponse>{status: false, message: "You doesnt connected to this room!"})
            return;
        }

        //get current room
        const _rm = this.getRoom(data.room);
        const result = _rm.service.skipColor(client.id);

        client.emit('skipColor', <DefaultResponse>{status: result.status, message: result.message ?? '', data: {points: result.points, color: result.color}});
    }
    @SubscribeMessage('data')
    handleGetData(client: Socket, data: { room: string, image: string }): void {
        //if room doesnt exists user get exception
        if (!this.isRoomExists(data.room)) {
            client.emit('data', <DefaultResponse>{status: false, message: "Room doesnt exists!"})
            return;
        }

        //user cant leave from a room in which he is not a member
        if (!this.getUserRooms(client).includes(data.room)) {
            client.emit('data', <DefaultResponse>{status: false, message: "You doesnt connected to this room!"})
            return;
        }

        //get current room
        const _rm = this.getRoom(data.room);

        data = _rm.service.getData(client.id, data.image, (result: {winner: string, isCorrect: boolean, points: number}) => {
            const winner = result.winner;

            if(winner !== '')
            {
                clearInterval(_rm.timer);
                client.emit('data', <DefaultResponse>{status: true, message: result.isCorrect, points: result.points})
                this.wss.to(data.room).emit('gameEnded', <DefaultResponse>{status: true, data: {points: result.points, winner: result.winner}})
            }
            else
                client.emit('data', <DefaultResponse>{status: true, message: result.isCorrect, points: result.points})
        }, (err) => {
            client.emit('data', <DefaultResponse>{status: false, message: err})
        });
    }
}
