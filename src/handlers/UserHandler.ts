import { AdvancedRequest, AdvancedResponse, ErrorResponse } from "../api/API";
import Main from "../Main";

export default class UserHandler {
    constructor(private readonly main: Main) { }

    api() {
        this.main.api.app.get('/users/@me', async (request: any, response) => this.getUserMe(request as AdvancedRequest, response as AdvancedResponse));
        this.main.api.app.get('/users/:id', async (request: any, response) => this.getUser(request as AdvancedRequest, response as AdvancedResponse));
    }

    async getUser(request: AdvancedRequest, response: AdvancedResponse) {
        const user = await this.main.database.users.getUserById(request.params.id);
        if (!user) return response.send(new ErrorResponse(404, 'User not found'));
        const auth = await this.main.sessions.getAuth(request, response);
        if (!auth)
            return response.send({
                id: user.id,
                display: user.displayName
            });
        return response.send({
            id: user.id,
            display: user.displayName,
            role: user.role
        });
    }

    async getUserMe(request: AdvancedRequest, response: AdvancedResponse) {
        const auth = await this.main.sessions.getAuth(request, response);
        if (!auth) return response.send(new ErrorResponse(401, 'Unauthorized'));
        return response.send({
            id: auth.user.id,
            name: auth.user.name,
            display: auth.user.displayName,
            email: auth.user.email,
            role: auth.user.role
        });
    }
}