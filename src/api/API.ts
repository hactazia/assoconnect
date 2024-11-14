import Express from 'express';
import Main from '../Main';

export default class API {

    public app: Express.Application;

    constructor(private readonly main: Main) {
        this.app = Express();
    }

    async init() {
        this.app.use(Express.json());
        this.app.use((request, response, next) => this.startHandlers(request as AdvancedRequest, response as AdvancedResponse, next));

        // Add your routes here
        this.main.users.api();
        this.main.sessions.api();
        this.main.meetings.api();
        this.main.invitations.api();

        this.app.use((request, response, next) => this.endHandlers(request as AdvancedRequest, response as AdvancedResponse, next));
    }

    async listen(port: number) {
        await new Promise<void>(resolve => this.app.listen(port, resolve));
    }

    async startHandlers(request: AdvancedRequest, response: AdvancedResponse, next: Express.NextFunction) {
        request.data = {};
        response.oldSend = response.send;

        response.send = (body: any) => {
            if (body instanceof ErrorResponse) {
                response.status(body.status);
                response.setHeader('Content-Type', 'application/json');
                return response.oldSend({
                    error: {
                        status: body.status,
                        message: body.message
                    },
                    time: Date.now(),
                    request: request.url,
                });
            }
            if (typeof body === 'object') {
                response.setHeader('Content-Type', 'application/json');
                return response.oldSend({
                    data: body,
                    time: Date.now(),
                    request: request.url,
                });
            }
            return response.oldSend(body);
        }

        next();
    }

    async endHandlers(request: AdvancedRequest, response: AdvancedResponse, next: Express.NextFunction) {
        return response.send(new ErrorResponse(404, 'Not Found'));
    }
}

export interface AdvancedRequest extends Express.Request {
    data: any;
}

export interface AdvancedResponse extends Express.Response {
    oldSend: (body: any) => any;
}

export class ErrorResponse extends Error {
    constructor(public status: number, public message: string) {
        super(message);
    }
}