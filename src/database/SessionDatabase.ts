import Database from "./Database";

export default class SessionDatabase {
    constructor(private readonly database: Database) { }

    private async getSessionsByFilter(filter: (session: RawSession) => boolean): Promise<Session[]> {
        const database = this.database.getDatabase();
        const snapshot = await database.collection('sessions').get();
        let sessions: { [key: string]: RawSession } = {};
        snapshot.forEach(doc => sessions[doc.id] = doc.data() as RawSession);
        return Object.entries(sessions)
            .filter(([_, session]) => filter(session))
            .map(([fireid, session]) => ({
                _id: fireid,
                id: session._id,
                token: session.token,
                expiresAt: new Date(session.expiresAt),
                userId: session.userId,
                createdAt: new Date(session.createdAt),
                updatedAt: new Date(session.updatedAt)
            }));
    }

    async getSessionById(id: string): Promise<Session | null> {
        return (await this.getSessionsByFilter(session => session._id === id))[0] || null;
    }

    async getAllSessions(): Promise<Session[]> {
        return this.getSessionsByFilter(() => true);
    }

    async removeSessionsByFilter(filter: (session: RawSession) => boolean): Promise<void> {
        const database = this.database.getDatabase();
        for (const session of await this.getSessionsByFilter(filter))
            await database.collection('sessions').doc(session._id).delete();
    }

    async removeSessions(sessions: Session[]): Promise<void> {
        const database = this.database.getDatabase();
        for (const session of sessions)
            await database.collection('sessions').doc(session._id).delete();
    }

    async createOrUpdateSession(createSession: CreateSession): Promise<Session> {
        let session = await this.getSessionById(createSession.id);
        if (session) await this.removeSessions([session]);
        const database = this.database.getDatabase();
        const sessionRef = session ? database.collection('sessions').doc(session._id) : database.collection('sessions').doc();
        const newSession: RawSession = {
            _id: createSession.id,
            token: createSession.token,
            expiresAt: createSession.expiresAt.getTime(),
            userId: createSession.userId,
            createdAt: session ? session.createdAt.getTime() : Date.now(),
            updatedAt: Date.now()
        };
        await sessionRef.set(newSession);
        return {
            _id: sessionRef.id,
            id: newSession._id,
            token: newSession.token,
            expiresAt: new Date(newSession.expiresAt),
            userId: newSession.userId,
            createdAt: new Date(newSession.createdAt),
            updatedAt: new Date(newSession.updatedAt)
        };
    }

    async getSessionByToken(token: string): Promise<Session | null> {
        return (await this.getSessionsByFilter(session => session.token === token))[0] || null;
    }
}

export interface RawSession {
    _id: string;
    token: string;
    expiresAt: number;
    userId: string;
    createdAt: number;
    updatedAt: number;
}

export interface Session {
    _id: string;
    id: string;
    token: string;
    expiresAt: Date;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateSession {
    id: string;
    token: string;
    expiresAt: Date;
    userId: string;
}