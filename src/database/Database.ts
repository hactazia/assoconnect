import Main from '../Main';
import { readFileSync } from 'fs';
import admin from 'firebase-admin';
import UserDatabase from './UserDatabase';
import MeetingDatabase from './MeetingDatabase';
import SessionDatabase from './SessionDatabase';
import InvitationDatabase from './InvitationDatabase';

export default class Database {

    app: admin.app.App;
    users: UserDatabase;
    meetings: MeetingDatabase;
    sessions: SessionDatabase;
    invitations: InvitationDatabase;

    constructor(private readonly main: Main) {
        this.app = admin.initializeApp(this.getInitializedConfig());
        
        this.users = new UserDatabase(this);
        this.meetings = new MeetingDatabase(this);
        this.sessions = new SessionDatabase(this);
        this.invitations = new InvitationDatabase(this);
    }

    private getInitializedConfig() {
        return { credential: admin.credential.cert(getFirebaseCredentials()) };
    }

    public getApp(): admin.app.App {
        return this.app;
    }

    public getDatabase() {
        return admin.firestore();
    }
}

function getFirebaseCredentialsPath() {
    return process.env.FIREBASE_CREDENTIALS_PATH || 'firebase-credentials.json';
}

function getFirebaseCredentials() {
    return JSON.parse(readFileSync(getFirebaseCredentialsPath(), 'utf8'));
}