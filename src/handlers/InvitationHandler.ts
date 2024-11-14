import { randomBytes } from "crypto";
import { AdvancedRequest, AdvancedResponse } from "../api/API";
import { Invitation, InvitationStatus } from "../database/InvitationDatabase";
import { UserRole } from "../database/UserDatabase";
import Main from "../Main";
import { request } from "undici";

export default class InvitationHandler {
    constructor(private readonly main: Main) { }

    api() {
        this.main.api.app.get('/users/@me/invitations', async (request: any, response) => this.getMyInvitations(request as AdvancedRequest, response as AdvancedResponse));
        this.main.api.app.post('/invitations', async (request: any, response) => this.createInvitation(request as AdvancedRequest, response as AdvancedResponse));
        this.main.api.app.get('/invitations/:id', async (request: any, response) => this.getInvitation(request as AdvancedRequest, response as AdvancedResponse));
        this.main.api.app.delete('/invitations/:id', async (request: any, response) => this.cancelInvitation(request as AdvancedRequest, response as AdvancedResponse));
    }

    async getMyInvitations(request: AdvancedRequest, response: AdvancedResponse) {
        var auth = await this.main.sessions.getAuth(request, response);
        if (!auth) return response.send({ error: 'Unauthorized' });
        var invitations = await this.main.database.invitations.getInvitationsByFilter(invitation => invitation.ownerId === auth?.user.id);
        response.send(invitations.map(invitation => ({
            id: invitation.id,
            expires: invitation.expiresAt.getTime(),
            email: invitation.email,
            role: invitation.role
        })));
    }

    async createInvitation(request: AdvancedRequest, response: AdvancedResponse) {
        var auth = await this.main.sessions.getAuth(request, response);
        if (!auth) return response.send({ error: 'Unauthorized' });
        if (auth.user.role !== UserRole.ADMIN) return response.send({ error: 'Unauthorized' });
        const { email, role } = request.body;
        if (typeof email !== 'string' || typeof role !== 'string')
            return response.send({ error: 'Invalid request' });

        if (!Object.values(UserRole).includes(role as UserRole))
            return response.send({ error: 'Invalid role' });

        const invitation = await this.main.database.invitations.createOrUpdateInvitation({
            id: randomBytes(16).toString('hex'),
            email: email,
            token: randomBytes(32).toString('hex'),
            role: role as UserRole,
            ownerId: auth.user.id,
            status: InvitationStatus.PENDING,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2)
        });

        let result = await this.sendInvitation(invitation);
        if (!result) {
            await this.main.database.invitations.removeInvitations([invitation]);
            return response.send({ error: 'Failed to send invitation' });
        }

        return response.send({
            id: invitation.id,
            expires: invitation.expiresAt.getTime(),
            url: this.getBestInvitationUrl(invitation),
            token: invitation.token,
            email: invitation.email,
            role: invitation.role
        });
    }

    getBestInvitationUrl(invitation: Invitation) {
        let patern = process.env.INVITATION_URL_PATERN!;
        patern = patern.replace(/\{id\}/g, invitation.id);
        patern = patern.replace(/\{token\}/g, invitation.token);
        patern = patern.replace(/\{email\}/g, invitation.email);
        patern = patern.replace(/\{role\}/g, invitation.role);
        return patern;
    }


    sendInvitation(invitation: Invitation) {
        return new Promise(async resolve => {
            try {
                let invitationUrl = this.getBestInvitationUrl(invitation);
                let response = await request('https://api.mailersend.com/v1/email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Authorization': `Bearer ${process.env.MAILERSEND_AUTHORIZATION}`
                    },
                    body: JSON.stringify({
                        from: { email: 'noreply@trial-x2p034760d3gzdrn.mlsender.net' },
                        to: [{ email: invitation.email }],
                        subject: 'Invitation to join our platform',
                        text: `You have been invited to join our platform as a ${invitation.role}. Click on the link to accept the invitation: ${invitationUrl}`,
                        html: `You have been invited to join our platform as a ${invitation.role}. Click on the link to accept the invitation: <a href="${invitationUrl}">${invitationUrl}</a>`
                    })
                });
                if (response.statusCode > 299 || response.statusCode < 200) {
                    console.error(await response.body.text());
                    resolve(false);
                }
                resolve(true);
            } catch (error) {
                console.error(error);
                resolve(false);
            }
        });
    }

    async getInvitation(request: AdvancedRequest, response: AdvancedResponse) {
        let invitation = await this.main.database.invitations.getInvitationById(request.params.id);
        if (!invitation) return response.send({ error: 'Invitation not found' });
        let auth = await this.main.sessions.getAuth(request, response);
        console.log(invitation, auth);
        if (auth) {
            return response.send({
                id: invitation.id,
                expires: invitation.expiresAt.getTime(),
                url: this.getBestInvitationUrl(invitation),
                token: invitation.token,
                email: invitation.email,
                role: invitation.role,
                can_use: this.isValid(invitation)
            });
        } else {
            return response.send({
                id: invitation.id,
                can_use: this.isValid(invitation),
                role: invitation.role
            });
        }
    }

    isValid(invitation: Invitation) {
        return invitation.status === InvitationStatus.PENDING && invitation.expiresAt.getTime() > Date.now();
    }

    async cancelInvitation(request: AdvancedRequest, response: AdvancedResponse) {
        let auth = await this.main.sessions.getAuth(request, response);
        if (!auth) return response.send({ error: 'Unauthorized' });
        let invitation = await this.main.database.invitations.getInvitationById(request.params.id);
        if (!invitation) return response.send({ error: 'Invitation not found' });
        if (invitation.ownerId !== auth.user.id) return response.send({ error: 'Unauthorized' });
        invitation.status = InvitationStatus.CANCELLED;
        invitation = await this.main.database.invitations.createOrUpdateInvitation(invitation);
        if (!invitation) return response.send({ error: 'Error to update invitation' });
        return response.send({
            id: invitation.id,
            expires: invitation.expiresAt.getTime(),
            url: this.getBestInvitationUrl(invitation),
            email: invitation.email,
            role: invitation.role
        });
    }
}