import { AdvancedRequest, AdvancedResponse } from "../api/API";
import { InvitationStatus } from "../database/InvitationDatabase";
import { Session } from "../database/SessionDatabase";
import { User } from "../database/UserDatabase";
import Main from "../Main";
import { pbkdf2Sync, randomBytes } from 'crypto';

export class SessionHandler {
    constructor(private readonly main: Main) { }

    api() {
        this.main.api.app.post('/login', async (request: any, response) => this.apiLogin(request as AdvancedRequest, response as AdvancedResponse));
        this.main.api.app.post('/logout', async (request: any, response) => this.apiLogout(request as AdvancedRequest, response as AdvancedResponse));
        this.main.api.app.post('/register', async (request: any, response) => this.apiRegister(request as AdvancedRequest, response as AdvancedResponse));
    }

    async getAuth(request: AdvancedRequest, response: AdvancedResponse): Promise<{ user: User, session: Session } | null> {
        const token = request.query.authtoken || request.headers.authorization;
        if (!token || typeof token !== 'string') return null;
        const session = await this.main.database.sessions.getSessionByToken(token);
        if (!session || !this.isValid(session)) return null;
        const user = await this.main.database.users.getUserById(session.userId);
        if (!user) return null;
        return { user, session };
    }

    async login(identifiant: string, password: string): Promise<Session | null> {
        const results = await this.main.database.users.getUsersByFilter(user => user.email === identifiant || user.name === identifiant);
        if (results.length === 0) return null;
        const user = results[0];
        if (!verifyPassword(password, user.password)) return null;
        const session = await this.main.database.sessions.createOrUpdateSession({
            id: randomBytes(16).toString('hex'),
            token: randomBytes(32).toString('hex'),
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7 * 2),
            userId: user.id
        });
        return session;
    }

    async logout(session: Session): Promise<void> {
        await this.main.database.sessions.removeSessions([session]);
    }

    isValid(session: Session): boolean {
        return session.expiresAt.getTime() > Date.now();
    }

    async apiLogin(request: AdvancedRequest, response: AdvancedResponse) {
        const { identifiant, password } = request.body;
        if (typeof identifiant !== 'string' || typeof password !== 'string')
            return response.send({ error: 'Invalid request' });
        const session = await this.login(identifiant, password);
        if (!session) return response.send({ error: 'Invalid credentials' });
        let user = await this.main.database.users.getUserById(session.userId);
        if (!user) return response.send({ error: 'Invalid user' });
        response.cookie('_uid', session.token);
        return response.send({
            token: session.token,
            expiresAt: session.expiresAt,
            user: {
                id: user.id,
                name: user.name,
                display: user.displayName,
                email: user.email,
                role: user.role
            }
        });
    }

    async apiLogout(request: AdvancedRequest, response: AdvancedResponse) {
        const auth = await this.getAuth(request, response);
        if (!auth) return response.send({ error: 'Unauthorized' });
        await this.logout(auth.session);
        return response.send({ success: true });
    }

    async apiRegister(request: AdvancedRequest, response: AdvancedResponse) {
        const { name, display, email, password, invitation: invitationToken } = request.body;
        if (typeof name !== 'string' || typeof display !== 'string' || typeof email !== 'string' || typeof password !== 'string' || typeof invitationToken !== 'string')
            return response.send({ error: 'Invalid request' });
        let invitation = await this.main.database.invitations.getInvitationByToken(invitationToken);
        if (!this.main.invitations.isValid(invitation))
            return response.send({ error: 'Invalid invitation' });

        if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(name))
            return response.send({ error: 'Invalid name' });

        if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(display))
            return response.send({ error: 'Invalid display' });

        if (!/^[^@]+@[^@]+\.[^@]+$/.test(email))
            return response.send({ error: 'Invalid email' });

        let existUser = await this.main.database.users.getUsersByFilter(user => user.email === email || user.name === name);
        if (existUser.length > 0)
            return response.send({ error: 'User already exists' });

        let user = await this.main.database.users.createOrUpdateUser({
            id: randomBytes(16).toString('hex'),
            name: name,
            displayName: display,
            email: email,
            password: hashPassword(password),
            role: invitation.role
        });

        invitation.status = InvitationStatus.ACCEPTED;
        await this.main.database.invitations.createOrUpdateInvitation(invitation);

        const session = await this.main.database.sessions.createOrUpdateSession({
            id: randomBytes(16).toString('hex'),
            token: randomBytes(32).toString('hex'),
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7 * 2),
            userId: user.id
        });

        response.cookie('_uid', session.token);
        return response.send({
            token: session.token,
            expiresAt: session.expiresAt,
            user: {
                id: user.id,
                name: user.name,
                display: user.displayName,
                email: user.email,
                role: user.role
            }
        });
    }
}

export function hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

export function verifyPassword(password: string, hash: string): boolean {
    const [salt, key] = hash.split(':');
    const verify = pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return key === verify;
}