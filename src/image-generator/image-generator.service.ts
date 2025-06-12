/* eslint-disable prettier/prettier */
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { Prompts } from '@prisma/client';
import { firstValueFrom } from 'rxjs';

import { GenerateLogoDto } from 'src/logo/dto/generate-logo.dto';
import { PromptsService } from 'src/prompts/prompts.service';

// DALL-E Docs: https://platform.openai.com/docs/api-reference/images/create

@Injectable()
export class ImageGeneratorService {
    constructor(
        private readonly httpService: HttpService,
        private readonly promptsService: PromptsService,
    ) {}
    
    async generateLogo(body: GenerateLogoDto) {
        const ai_model = "dall-e-3"
        const prompt: Prompts = await this.promptsService.createPrompt({
            ai_model: ai_model,
            brand_name: body.brand_name,
            slogan: body.slogan,
            industry: body.industry,
            brand_colors: body.brand_colors,
            logo_styles: body.logo_style,
            similiar_styles: body.similiar_style,
            additional_details: body.additional_details,
            things_to_exclude: body.things_to_exclude,
            logo_resolution: body.logo_resolution,
            amount_to_generate: body.amount_to_generate,
            whole_prompt: this.promptsService.createWholePrompt(body, 1)
        })

        const data = {
            prompt: prompt.whole_prompt,
            model: ai_model,
            n: body.amount_to_generate,
            response_format: "url"
        }

        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.LOGO_GENERATOR_TOOL_API_KEY}`
        }

        const response = await firstValueFrom(
            this.httpService.post('https://api.openai.com/v1/images/generations', data, {headers})
        )

        response.data.prompt = prompt
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return response.data;
    }
}
