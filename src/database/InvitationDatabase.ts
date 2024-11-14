import Database from "./Database";
import { UserRole } from "./UserDatabase";

export default class InvitationDatabase {
    constructor(private readonly database: Database) { }

    public async getInvitationsByFilter(filter: (invitation: RawInvitation) => boolean): Promise<Invitation[]> {
        const database = this.database.getDatabase();
        const snapshot = await database.collection('invitations').get();
        let invitations: { [key: string]: RawInvitation } = {};
        snapshot.forEach(doc => invitations[doc.id] = doc.data() as RawInvitation);
        return Object.entries(invitations)
            .filter(([_, invitation]) => filter(invitation))
            .map(([fireid, invitation]) => ({
                _id: fireid,
                id: invitation._id,
                email: invitation.email,
                role: invitation.role as UserRole,
                token: invitation.token,
                ownerId: invitation.ownerId,
                status: invitation.status as InvitationStatus,
                expiresAt: new Date(invitation.expiresAt),
                createdAt: new Date(invitation.createdAt),
                updatedAt: new Date(invitation.updatedAt)
            }));
    }

    async getInvitationByToken(invitationToken: string) {
        return (await this.getInvitationsByFilter(invitation => invitation.token === invitationToken))[0] || null;
    }

    async getInvitationById(id: string): Promise<Invitation | null> {
        return (await this.getInvitationsByFilter(invitation => invitation._id === id))[0] || null;
    }

    async getAllInvitations(): Promise<Invitation[]> {
        return this.getInvitationsByFilter(() => true);
    }

    async removeInvitationsByFilter(filter: (invitation: RawInvitation) => boolean): Promise<void> {
        const database = this.database.getDatabase();
        for (const invitation of await this.getInvitationsByFilter(filter))
            await database.collection('invitations').doc(invitation._id).delete();
    }

    async removeInvitations(invitations: Invitation[]): Promise<void> {
        const database = this.database.getDatabase();
        for (const invitation of invitations)
            await database.collection('invitations').doc(invitation._id).delete();
    }

    async createOrUpdateInvitation(createInvitation: CreateInvitation): Promise<Invitation> {
        let invitation = await this.getInvitationById(createInvitation.id);
        if (invitation) await this.removeInvitations([invitation]);
        const database = this.database.getDatabase();
        const invitationRef = invitation ? database.collection('invitations').doc(invitation._id) : database.collection('invitations').doc();
        const newInvitation: RawInvitation = {
            _id: createInvitation.id,
            email: createInvitation.email,
            role: createInvitation.role,
            token: createInvitation.token,
            ownerId: createInvitation.ownerId,
            status: createInvitation.status,
            expiresAt: createInvitation.expiresAt.getTime(),
            createdAt: invitation ? invitation.createdAt.getTime() : Date.now(),
            updatedAt: Date.now()
        };
        await invitationRef.set(newInvitation);
        return {
            _id: invitationRef.id,
            id: newInvitation._id,
            email: newInvitation.email,
            role: newInvitation.role as UserRole,
            token: newInvitation.token,
            ownerId: newInvitation.ownerId,
            status: newInvitation.status as InvitationStatus,
            expiresAt: new Date(newInvitation.expiresAt),
            createdAt: new Date(newInvitation.createdAt),
            updatedAt: new Date(newInvitation.updatedAt)
        };
    }




}

export interface Invitation {
    _id: string;
    id: string;
    email: string;
    role: UserRole;
    token: string;
    ownerId: string;
    status: InvitationStatus;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export enum InvitationStatus {
    PENDING = 'pending',
    ACCEPTED = 'accepted',
    REJECTED = 'rejected',
    CANCELLED = 'cancelled'
}

export interface RawInvitation {
    _id: string;
    email: string;
    role: string;
    token: string;
    ownerId: string;
    status: string;
    expiresAt: number;
    createdAt: number;
    updatedAt: number;
}

export interface CreateInvitation {
    id: string;
    email: string;
    role: UserRole;
    token: string;
    ownerId: string;
    status: InvitationStatus;
    expiresAt: Date
}