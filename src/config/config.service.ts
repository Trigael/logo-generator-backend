import { Injectable } from '@nestjs/common';

export enum CONFIG_OPTIONS {
    PROMPTED_LOGO_FILEPATH = 'PROMPTED_LOGO_FILEPATH',
    CHATGPT_MODEL = 'CHATGPT_MODEL',
    AMOUNT_OF_PICS_TO_GENERATE = 'AMOUNT_OF_PICS_TO_GENERATE',
    BUCKET_NAME = 'BUCKET_NAME'
}

@Injectable()
export class ConfigService {
    private readonly PROMPTED_LOGO_FILEPATH = 'public/generated'
    private readonly CHATGPT_MODEL = 'gpt-4o'
    private readonly AMOUNT_OF_PICS_TO_GENERATE = 2
    private readonly BUCKET_NAME = 'logonest-ai'
    private readonly BUCKET_NAME_STAGING = 'logonest-ai-staging'

    async get(key: CONFIG_OPTIONS) {
        switch(key) {
            case CONFIG_OPTIONS.PROMPTED_LOGO_FILEPATH:
                return this.PROMPTED_LOGO_FILEPATH
            case CONFIG_OPTIONS.CHATGPT_MODEL:
                return this.CHATGPT_MODEL
            case CONFIG_OPTIONS.AMOUNT_OF_PICS_TO_GENERATE:
                return this.AMOUNT_OF_PICS_TO_GENERATE
            case CONFIG_OPTIONS.BUCKET_NAME:
                return process.env.NODE_ENV == 'production' ? this.BUCKET_NAME : this.BUCKET_NAME_STAGING
            default:
                return null
        }

    }
}
