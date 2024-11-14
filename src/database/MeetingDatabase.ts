import Database from "./Database";

export default class MeetingDatabase {
    constructor(private readonly database: Database) { }

    private async getMeetingsByFilter(filter: (meeting: RawMeeting) => boolean): Promise<Meeting[]> {
        const database = this.database.getDatabase();
        const snapshot = await database.collection('meetings').get();
        let meetings: { [key: string]: RawMeeting } = {};
        snapshot.forEach(doc => meetings[doc.id] = doc.data() as RawMeeting);
        return Object.entries(meetings)
            .filter(([_, meeting]) => filter(meeting))
            .map(([fireid, meeting]) => ({
                _id: fireid,
                id: meeting._id,
                title: meeting.title,
                description: meeting.description,
                startDate: new Date(meeting.startDate),
                endDate: meeting.endDate ? new Date(meeting.endDate) : null,
                location: meeting.location,
                ownerId: meeting.ownerId,
                participantIds: meeting.participantIds,
                createdAt: new Date(meeting.createdAt),
                updatedAt: new Date(meeting.updatedAt)
            }));
    }

    async getMeetingById(id: string): Promise<Meeting | null> {
        return (await this.getMeetingsByFilter(meeting => meeting._id === id))[0] || null;
    }

    async getAllMeetings(): Promise<Meeting[]> {
        return this.getMeetingsByFilter(() => true);
    }

    async removeMeetingsByFilter(filter: (meeting: RawMeeting) => boolean): Promise<void> {
        const database = this.database.getDatabase();
        for (const meeting of await this.getMeetingsByFilter(filter))
            await database.collection('meetings').doc(meeting._id).delete();
    }

    async removeMeetings(meetings: Meeting[]): Promise<void> {
        const database = this.database.getDatabase();
        for (const meeting of meetings)
            await database.collection('meetings').doc(meeting._id).delete();
    }

    async createOrUpdateMeeting(createMeeting: CreateMeeting): Promise<Meeting> {
        let meeting = await this.getMeetingById(createMeeting.id);
        if (meeting) await this.removeMeetings([meeting]);
        const database = this.database.getDatabase();
        const meetingRef = meeting ? database.collection('meetings').doc(meeting._id) : database.collection('meetings').doc();
        const newMeeting: RawMeeting = {
            _id: createMeeting.id,
            title: createMeeting.title,
            description: createMeeting.description,
            startDate: createMeeting.startDate.getTime(),
            endDate: createMeeting.endDate ? createMeeting.endDate.getTime() : null,
            location: createMeeting.location,
            ownerId: createMeeting.ownerId,
            participantIds: createMeeting.participantIds,
            createdAt: meeting ? meeting.createdAt.getTime() : Date.now(),
            updatedAt: Date.now()
        };
        await meetingRef.set(newMeeting);
        return {
            _id: meetingRef.id,
            id: newMeeting._id,
            title: newMeeting.title,
            description: newMeeting.description,
            startDate: new Date(newMeeting.startDate),
            endDate: newMeeting.endDate ? new Date(newMeeting.endDate) : null,
            location: newMeeting.location,
            ownerId: newMeeting.ownerId,
            participantIds: newMeeting.participantIds,
            createdAt: new Date(newMeeting.createdAt),
            updatedAt: new Date(newMeeting.updatedAt)
        };
    }
}

export interface Meeting {
    _id: string;
    id: string;
    title: string;
    description: string;
    startDate: Date;
    endDate: Date | null;
    location: string;
    ownerId: string;
    participantIds: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateMeeting {
    id: string;
    title: string;
    description: string;
    startDate: Date;
    endDate: Date | null;
    location: string;
    ownerId: string;
    participantIds: string[];
}

export interface RawMeeting {
    _id: string;
    title: string;
    description: string;
    startDate: number;
    endDate: number | null;
    location: string;
    ownerId: string;
    participantIds: string[];
    createdAt: number;
    updatedAt: number;
}