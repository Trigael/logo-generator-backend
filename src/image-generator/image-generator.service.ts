/* eslint-disable prettier/prettier */
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { Prompts } from '@prisma/client';
import { firstValueFrom } from 'rxjs';

import { GenerateLogoDto } from 'src/logo/dto/generate-logo.dto';
import { PromptsService } from 'src/prompts/prompts.service';
import { ChatGPT_propmts_creation_response } from 'src/utils/example_responses.util';
import { getSecret } from 'src/utils/helpers.util';
import * as fs from 'fs';
import * as path from 'path';

// DALL-E Docs: https://platform.openai.com/docs/api-reference/images/create
const OPEN_AI_API_URL = "https://api.openai.com/v1/"

@Injectable()
export class ImageGeneratorService {
    constructor(
        private readonly httpService: HttpService,
        private readonly promptsService: PromptsService,
    ) {}
    
    async generateLogo(body: GenerateLogoDto, amount: number) {
        // TODO: Config AI_Model
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
            amount_to_generate: amount,
            whole_prompt: this.promptsService.createWholePrompt(body, 1)
        })

        const data = {
            prompt: prompt.whole_prompt,
            model: ai_model,
            n: amount,
            response_format: "url"
        }

        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getSecret(process.env.AI_TOOL_KEY ?? '')}`
        }

        const response = await firstValueFrom(
            this.httpService.post(OPEN_AI_API_URL + 'images/generations', data, {headers})
        )

        response.data.prompt = prompt
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return response.data;
    }

    async generateLogoWitchChatGPTPrompts(body: GenerateLogoDto, amount: number) {
        const prompt: Prompts = await this.promptsService.createPrompt({
            ai_model: 'ChatGPT_to_Flux1[Dev]',
            brand_name: body.brand_name,
            slogan: body.slogan,
            industry: body.industry,
            brand_colors: body.brand_colors,
            logo_styles: body.logo_style,
            similiar_styles: body.similiar_style,
            additional_details: body.additional_details,
            things_to_exclude: body.things_to_exclude,
            logo_resolution: body.logo_resolution,
            amount_to_generate: amount,
            whole_prompt: this.promptsService.createWholePrompt(body, 2)
        })

        // Creating response JSON
        const return_data: any = {
            prompt: prompt,
            data: []
        }
        
        // Creating prompts for Flux through ChatGPT
        const response = await this._callToChatGPTApi(prompt.whole_prompt)
        // const response = ChatGPT_propmts_creation_response // example response

        // Retrieving each prompt for Flux
        const rawContent = response.choices[0].message.content;
        const cleaned = rawContent
          .trim()
          .replace(/\n/g, '')    
          .replace(/\t/g, '')    

        const prompts_array = JSON.parse(cleaned);

        // Generating images through Flux
        const generated_imgs = await this._generateThroughFlux1Dev(prompts_array)
        
        // Save images
        for(let i = 0; i < generated_imgs.length; i++) {
            return_data.data.push({
                filepath: await this._saveBase64Image(
                    generated_imgs[i], 
                    `generated_logo-${prompt.id_prompt}_${i}`
                ),
                img: generated_imgs[i]
            })
        }

        return return_data
    }

    /**
     * PRIVATE FUNCTIONS FOR AI MODELS
     */
    async _callToChatGPTApi(prompt: string) {
        // TODO: Config ChatGPT Model
        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getSecret(process.env.AI_TOOL_KEY ?? '')}`
        }

        const data = {
            model: "gpt-4",
            messages: [
              { role: "user", content: prompt }
            ]
        }

        const response = await firstValueFrom(
            this.httpService.post(OPEN_AI_API_URL + 'chat/completions', data, {headers})
        )
        return response.data
    }
    
    async _generateThroughFlux1Dev(prompts: string[]): Promise<string[]> {
        const results: string[] = [];

        const response = await firstValueFrom(
          this.httpService.post(
            'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev',
            { inputs: prompts[0] },
            {
              headers: {
                Authorization: `Bearer ${process.env.HF_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'image/png',
              },
              responseType: 'arraybuffer',
            }
          )
        );

        for (const prompt of prompts) {
          try {
            const response = await firstValueFrom(
              this.httpService.post(
                'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev',
                { inputs: prompt },
                {
                  headers: {
                    Authorization: `Bearer ${process.env.HF_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'image/png',
                  },
                  responseType: 'arraybuffer',
                  timeout: 120_000
                }
              )
            );

            const base64 = Buffer.from(response.data, 'binary').toString('base64');
            results.push(`data:image/png;base64,${base64}`);
          } catch  {
            console.error('Image generation failed for prompt:', prompt);
            results.push(''); // nebo nějaká náhradní hodnota
          }
        }

        return results;
    }

    async _saveBase64Image(base64String: string, filename: string): Promise<string> {
      // Deleting prefix 'data:image/png;base64,'
      const base64Data = base64String.replace(/^data:image\/png;base64,/, '');

      // Path, where to save image
      const savePath = path.join(__dirname, '..', '..', 'public', 'generated');
      if (!fs.existsSync(savePath)) {
        fs.mkdirSync(savePath, { recursive: true });
      }

      const fullPath = path.join(savePath, `${filename}.png`);
      fs.writeFileSync(fullPath, base64Data, 'base64');

      return `/generated/${filename}.png`; 
    }

}
