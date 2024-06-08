import { Injectable } from '@angular/core';
import { APP_CONSTANTS } from '../constants/app.constants';
import { CohereClient } from "cohere-ai";

@Injectable({
    providedIn: 'root',
})
export class ChatService {
    private cohere = new CohereClient({
        token: APP_CONSTANTS.cohereKey
    });

    constructor() {}

    async getResult(text: string) {
        return await this.cohere.chat({
            model: "command-r",
            message: text,
        });
    }
  }