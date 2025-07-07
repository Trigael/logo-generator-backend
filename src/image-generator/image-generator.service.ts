/* eslint-disable prettier/prettier */
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { Prompts } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { access, mkdir } from 'fs/promises';
import { join } from 'path';
import { createWriteStream } from 'fs';
import * as fs from 'fs';
import * as path from 'path';

import { GenerateLogoDto } from 'src/logo/dto/generate-logo.dto';
import { PromptsService } from 'src/prompts/prompts.service';
import { getSecret } from 'src/utils/helpers.util';
import { InternalErrorException } from 'src/utils/exceptios';


@Injectable()
export class ImageGeneratorService {
    // DALL-E Docs: https://platform.openai.com/docs/api-reference/images/create
    private readonly OPEN_AI_API_URL = "https://api.openai.com/v1/"
    
    // Black Fores DOCS: https://docs.bfl.ai/api-reference/tasks/generate-an-image-with-flux1-[dev]
    private readonly BLACK_FOREST_API_URL = 'https://api.bfl.ai/v1/'; 
    private readonly BLACK_FOREST_API_KEY = getSecret(process.env.BLACK_FOREST_API_KEY ?? '')
    private readonly BLACK_FOREST_MODEL = 'flux-dev'

    private readonly PROMPTED_LOGO_FILEPATH = 'public/generated'
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
            whole_prompt: this.promptsService.createWholePrompt(body, amount, 1)
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
            this.httpService.post(this.OPEN_AI_API_URL + 'images/generations', data, {headers})
        )

        response.data.prompt = prompt
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return response.data;
    }

    async generateLogoWitchChatGPTPrompts(body: GenerateLogoDto, amount: number) {
        const prompt: Prompts = await this.promptsService.createPrompt({
            ai_model: 'ChatGPT_to_Flux',
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
            whole_prompt: this.promptsService.createWholePrompt(body, amount, 2)
        })

        // Creating prompts for Flux through ChatGPT
        const response = await this._callToChatGPTApi(prompt.whole_prompt)

        // Retrieving each prompt for Flux
        let prompts_array =[]
        const rawContent = response.choices[0].message.content;
        const cleaned = rawContent
          .trim()
          .replace(/\n/g, '')    
          .replace(/\t/g, '')    
        
        prompts_array = JSON.parse(amount > 1 ? rawContent : cleaned);

        // Generating images through Flux
        const generated_imgs = await this._generateThroughFlux1(prompts_array)

        // Save images locally
        await Promise.all(
          generated_imgs.map(async (img, i) => {
            const localUrl = await this._downloadImage(img.image_url, `generated_logo-${img.id}.jpg`);
            img.image_url = localUrl; // rewriting original URL
          }),
        );

        return {
            prompt: prompt,
            data: generated_imgs
        }
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
            this.httpService.post(this.OPEN_AI_API_URL + 'chat/completions', data, {headers})
        )
        return response.data
    }
    
    async _generateThroughFlux1DevOnHugginFace(prompts: string[]): Promise<string[]> {
        const results: string[] = [];

        try {
          const response = await firstValueFrom(
              this.httpService.post(
                "https://router.huggingface.co/nebius/v1/images/generations",
                { inputs: 'ping' },
                {
                  headers: {
                    Authorization: `Bearer ${process.env.HF_BLACK_FOREST_API_URL}`,
                  },
                  timeout: 60_000, 
                }
              )
            );
        } catch (error) {
          console.warn('[FLUX PING] Wake-up timeout failed, continuing anyway. Error: ' + error)
        }

        for (const prompt of prompts) {
          try {
            const response = await firstValueFrom(
              this.httpService.post(
                'https://router.huggingface.co/nebius/v1/images/generations',
                {     response_format: "b64_json",
                  prompt: prompt,
                  model: "black-forest-labs/flux-dev", },
                {
                  headers: {
                    Authorization: `Bearer ${process.env.HF_BLACK_FOREST_API_URL}`,
                    'Content-Type': 'application/json',
                    'Accept': 'image/png',
                  },
                  responseType: 'arraybuffer',
                }
              )
            );

            const base64 = Buffer.from(response.data, 'binary').toString('base64');
            results.push(`data:image/png;base64,${base64}`);
          } catch (error)  {
            console.error('Image generation failed for prompt:', prompt, ' Error: ', error);
            results.push(''); 
          }
        }

        return results;
    }

    async _generateThroughFlux1(prompts: string[]) {
      let position = 'polling url creation'

      try {
        // Creating polling URLs for images
        const pollingUrls = await Promise.all(
          prompts.map(prompt => this._requestImageGeneration(prompt))
        );
        
        position = 'image retrieval'

        // Taking result images from polling URLs
        const results = await Promise.all(
          pollingUrls.map((url, index) => this._pollForImageResult(url))
        );
      
        return results;
      } catch (error) {
        console.error(`[FLUX GENERATION] Image generation failed at ${position}`);
        console.error(' * Error:', error);
        throw new InternalErrorException(
          'Failed to generate images via Flux',
        );
      }
    }
  
    private async _requestImageGeneration(prompt: string): Promise<string> {
      const response = await firstValueFrom(
        this.httpService.post(
          this.BLACK_FOREST_API_URL + this.BLACK_FOREST_MODEL,
          {
            prompt: prompt,
            aspect_ratio: '1:1',
            num_images: 1,
          },
          {
            headers: {
              'x-key': `${this.BLACK_FOREST_API_KEY}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      
      const pollingUrl = response.data;
      if (!pollingUrl) {
        throw new Error('Missing polling_url in response');
      }
    
      return pollingUrl;
    }
  
    private async _pollForImageResult(pollingUrl) {
      const MAX_RETRIES = 30;
      const DELAY_MS = 2000;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const response = await firstValueFrom(
          this.httpService.get(pollingUrl.polling_url, {
            headers: {
              'x-key': this.BLACK_FOREST_API_KEY,
              'Content-Type': 'application/json',
            },
          }),
        );
      
        const { status, result } = response.data;
      
        // this.logger.debug(`[BlackForest] Poll attempt ${attempt + 1}, status: ${status}`);
      
        if (status === 'Ready') {
          const imageUrl = result?.sample;
          if (!imageUrl) {
            throw new Error('Image URL not found in result');
          }

          return {
            id: response?.data.id,
            image_url: imageUrl
          };
        }
      
        if (status === 'Error' || status === 'Failed') {
          throw new Error(`Image generation failed: ${status}`);
        }
      
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    
      throw new Error('Polling timeout: Image generation did not complete in time');
    }

    async _downloadImage(imageUrl: string, filename: string): Promise<string> {
      const outputDir = path.join(process.cwd(), this.PROMPTED_LOGO_FILEPATH);

      // Checking for output file existence
      try {
        await access(outputDir);
      } catch {
        await mkdir(outputDir, { recursive: true });
      }

      const filePath = join(outputDir, filename);
      const writer = createWriteStream(filePath);

      // Downloading image
      const response = await firstValueFrom(
        this.httpService.get(imageUrl, {
          responseType: 'stream',
        }),
      );

      response.data.pipe(writer);

      // Returning public URL
      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          const publicUrl = `${process.env.BACKEND_URL}/` + join(this.PROMPTED_LOGO_FILEPATH, filename).replace(/^public[\\/]/, '').replace(/\\/g, '/');
          resolve(publicUrl);
        });
        writer.on('error', reject);
      });
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
