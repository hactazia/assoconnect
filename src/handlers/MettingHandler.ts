import { AdvancedRequest, AdvancedResponse } from "../api/API";
import { User } from "../database/UserDatabase";
import Main from "../Main";

export default class MettingHandler {
    constructor(private readonly main: Main) { }

    api() {
        this.main.api.app.get('/meetings', async (request: any, response) => this.getMeetings(request as AdvancedRequest, response as AdvancedResponse));
    }

    async getMeetings(request: AdvancedRequest, response: AdvancedResponse) {
        var session = await this.main.sessions.getAuth(request, response);
        if (!session) return response.send({ error: 'Unauthorized' });
        var meetings = await this.main.database.meetings.getAllMeetings();
        let userIds: string[] = [];
        for (let metting of meetings)
            for (let participantId of metting.participantIds)
                if (!userIds.includes(participantId)) userIds.push(participantId);
        let users = await this.main.database.users.getUsersByFilter(user => userIds.includes(user._id));
        let results: any[] = [];
        for (let meeting of meetings) {
            let participants: User[] = [];
            let owner = users.find(user => user.id === meeting.ownerId);
            if (!owner) continue;
            for (let participantId of meeting.participantIds) {
                let participant = users.find(user => user.id === participantId);
                if (participant && !participants.find(user => user.id === participant.id))
                    participants.push(participant);
            }
            results.push({
                id: meeting.id,
                title: meeting.title,
                description: meeting.description,
                start: meeting.startDate.getTime(),
                end: meeting.endDate ? meeting.endDate.getTime() : null,
                location: meeting.location,
                owner: {
                    id: owner.id,
                    display: owner.displayName
                },
                participants: participants.map(participant => ({
                    id: participant.id,
                    display: participant.displayName
                }))
            });
        }
        return response.send(results);
    }
}