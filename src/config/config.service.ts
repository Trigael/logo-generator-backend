import { Injectable } from '@nestjs/common';

export enum CONFIG_OPTIONS {
    PROMPTED_LOGO_FILEPATH = 'PROMPTED_LOGO_FILEPATH',
    CHATGPT_MODEL = 'CHATGPT_MODEL',
    AMOUNT_OF_PICS_TO_GENERATE = 'AMOUNT_OF_PICS_TO_GENERATE',
}

@Injectable()
export class ConfigService {
    private readonly PROMPTED_LOGO_FILEPATH = 'public/generated'
    private readonly CHATGPT_MODEL = 'gpt-4o'
    private readonly AMOUNT_OF_PICS_TO_GENERATE = 2

    async get(key: CONFIG_OPTIONS) {
        switch(key) {
            case CONFIG_OPTIONS.PROMPTED_LOGO_FILEPATH:
                return this.PROMPTED_LOGO_FILEPATH
            case CONFIG_OPTIONS.CHATGPT_MODEL:
                return this.CHATGPT_MODEL
            case CONFIG_OPTIONS.AMOUNT_OF_PICS_TO_GENERATE:
                return this.AMOUNT_OF_PICS_TO_GENERATE
            default:
                return null
        }

    }
}
