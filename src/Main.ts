import EventEmitter from "events";
import Database from "./database/Database";
import { randomBytes } from "crypto";
import { UserRole } from "./database/UserDatabase";
import API from "./api/API";
import UserHandler from "./handlers/UserHandler";
import { hashPassword, SessionHandler } from "./handlers/SessionHandler";
import MettingHandler from "./handlers/MettingHandler";
import InvitationHandler from "./handlers/InvitationHandler";

export default class Main extends EventEmitter {

    api: API;
    database: Database;
    users: UserHandler;
    sessions: SessionHandler;
    meetings: MettingHandler;
    invitations: InvitationHandler;

    constructor() {
        super();
        this.database = new Database(this);
        this.users = new UserHandler(this);
        this.sessions = new SessionHandler(this);
        this.meetings = new MettingHandler(this);
        this.invitations = new InvitationHandler(this);
        this.api = new API(this);
    }

    public async init() {
        this.emit('ready');
        await this.api.init();

        let user = await this.database.users.createOrUpdateUser({
            id: '1',
            name: "hactazia",
            displayName: 'Hactazia',
            email: "hactazia@gmail.com",
            password: hashPassword("azerty"),
            role: UserRole.ADMIN
        });

        await this.database.meetings.createOrUpdateMeeting({
            id: '1',
            title: 'Test',
            description: 'Test',
            startDate: new Date(),
            endDate: new Date(),
            location: 'Test',
            ownerId: user.id,
            participantIds: [user.id]
        });

        console.log(await this.database.users.getAllUsers());
        await this.api.listen(parseInt(process.env.PORT || '3000'));

        console.log('Server is running on port', process.env.PORT || '3000');
    }
}