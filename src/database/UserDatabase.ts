import Database from "./Database";

export default class UserDatabase {
    constructor(private readonly database: Database) { }

    public async getUsersByFilter(filter: (user: RawUser) => boolean): Promise<User[]> {
        const database = this.database.getDatabase();
        const snapshot = await database.collection('users').get();
        let users: { [key: string]: RawUser } = {};
        snapshot.forEach(doc => users[doc.id] = doc.data() as RawUser);
        return Object.entries(users)
            .filter(([_, user]) => filter(user))
            .map(([fireid, user]) => ({
                _id: fireid,
                id: user._id,
                name: user.name,
                displayName: user.displayName,
                email: user.email,
                password: user.password,
                role: user.role as UserRole,
                createdAt: new Date(user.createdAt),
                updatedAt: new Date(user.updatedAt)
            }));
    }

    async getUserById(id: string): Promise<User | null> {
        return (await this.getUsersByFilter(user => user._id === id))[0] || null;
    }

    async getAllUsers(): Promise<User[]> {
        return this.getUsersByFilter(() => true);
    }

    async removeUsersByFilter(filter: (user: RawUser) => boolean): Promise<void> {
        const database = this.database.getDatabase();
        for (const user of await this.getUsersByFilter(filter))
            await database.collection('users').doc(user._id).delete();
    }

    async removeUsers(users: User[]): Promise<void> {
        const database = this.database.getDatabase();
        for (const user of users)
            await database.collection('users').doc(user._id).delete();
    }

    async createOrUpdateUser(createuser: CreateUser): Promise<User> {
        let user = await this.getUserById(createuser.id);
        if (user) await this.removeUsers([user]);
        const database = this.database.getDatabase();
        const userRef = user ? database.collection('users').doc(user._id) : database.collection('users').doc();
        const newUser: RawUser = {
            _id: createuser.id,
            name: createuser.name,
            displayName: createuser.displayName,
            email: createuser.email,
            password: createuser.password,
            role: createuser.role,
            createdAt: user ? user.createdAt.getTime() : Date.now(),
            updatedAt: Date.now()
        };
        await userRef.set(newUser);
        return {
            _id: userRef.id,
            id: newUser._id,
            name: newUser.email,
            displayName: newUser.email,
            email: newUser.email,
            password: newUser.password,
            role: newUser.role as UserRole,
            createdAt: new Date(newUser.createdAt),
            updatedAt: new Date(newUser.updatedAt)
        };
    }
}

export enum UserRole {
    ADMIN = "admin",
    MEMBER = "member",
    EXTERNAL = "external"
}

export interface CreateUser {
    id: string;
    name: string;
    displayName: string;
    email: string;
    password: string;
    role: UserRole;
}

interface RawUser {
    _id: string;
    name: string;
    displayName: string;
    email: string;
    password: string;
    role: string;
    createdAt: number;
    updatedAt: number;
}

export interface User {
    _id: string;
    id: string;
    name: string;
    displayName: string;
    email: string;
    password: string;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
}
