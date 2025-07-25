/* eslint-disable prettier/prettier */
import { HttpService } from '@nestjs/axios';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
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
import { ConfigService, CONFIG_OPTIONS } from 'src/config/config.service';
import { S3Service } from 'src/s3/s3.service';
import { tryCatch } from 'bullmq';


@Injectable()
export class ImageGeneratorService {
    // DALL-E Docs: https://platform.openai.com/docs/api-reference/images/create
    private readonly OPEN_AI_API_URL = "https://api.openai.com/v1/"
    
    // Black Fores DOCS: https://docs.bfl.ai/api-reference/tasks/generate-an-image-with-flux1-[dev]
    private readonly BLACK_FOREST_API_URL = 'https://api.bfl.ai/v1/'; 
    private readonly BLACK_FOREST_API_KEY = getSecret(process.env.BLACK_FOREST_API_KEY ?? '')
    private readonly BLACK_FOREST_MODEL = 'flux-dev'

    private PROMPTED_LOGO_FILEPATH: string
    private CHATGPT_MODEL: string
    
    constructor(
        private readonly httpService: HttpService,
        private readonly promptsService: PromptsService,
        private readonly s3: S3Service,

        @Inject(forwardRef(() => ConfigService))
        private readonly config: ConfigService,
    ) {}

    async onModuleInit() {
      this.PROMPTED_LOGO_FILEPATH = await this.config.get(CONFIG_OPTIONS.PROMPTED_LOGO_FILEPATH) as string;
      this.CHATGPT_MODEL = await this.config.get(CONFIG_OPTIONS.CHATGPT_MODEL) as string;
    }
    
    async generateLogo(body: GenerateLogoDto, amount: number) {
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
            "Authorization": `Bearer ${getSecret(process.env.OPENAI_API_KEY ?? '')}`
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
            whole_prompt: this.promptsService.createWholePrompt(body, amount, 3)
        })

        // Creating prompts for Flux through ChatGPT
        const response = await this._callToChatGPTApi(prompt.whole_prompt)
        const rawContent = response.choices[0].message.content;

        // Clean common formatting issues
        const jsonStart = rawContent.indexOf('[');
        const jsonEnd = rawContent.lastIndexOf(']') + 1;

        if (jsonStart === -1 || jsonEnd === -1) {
          console.error('Invalid JSON response from ChatGPT:', rawContent);
          throw new InternalErrorException('ChatGPT response is not a valid JSON array.');
        }
      
        const jsonString = rawContent.slice(jsonStart, jsonEnd);
        let parsed;

        try {
          parsed = JSON.parse(jsonString);
        } catch (error) {
          console.error('Failed to parse ChatGPT response:', error.message);
          throw new InternalErrorException('ChatGPT returned malformed JSON.');
        }
      
        // Ensure it's an array of strings or convert from objects
        let prompts_array: string[];
        if (Array.isArray(parsed)) {
          if (typeof parsed[0] === 'string') {
            prompts_array = parsed;
          } else if (parsed[0]?.description) {
            prompts_array = parsed.map((item) => item.description);
          } else {
            console.warn('[ChatGPT Output]', JSON.stringify(parsed, null, 2));
          
            throw new InternalErrorException('ChatGPT response items must be strings or objects with `description`.');
          }
        } else {
          throw new InternalErrorException('ChatGPT response must be a JSON array.');
        }

        // Saving ChatGPT generated prompts
        const originalMetadata = prompt.metadata && typeof prompt.metadata === 'object'
          ? prompt.metadata
          : {};

        await this.promptsService.updatePrompt(prompt.id_prompt, {
          metadata: {
            ...originalMetadata,
            chatgpt_prompts: prompts_array,
          },
        });

        // Generating images through Flux
        const generated_imgs = await this._generateThroughFlux1(prompts_array)

        // Save images locally
        await Promise.all(
          generated_imgs.map(async (img, i) => {
            // rewriting original URL
            img.image_url = await this._uploadImageFromUrl(img.image_url, `generated/generated_logo-${img.id}.jpg`); 
          }),
        );

        return {
            id_prompt: prompt.id_prompt,
            data: generated_imgs
        }
    }

    /**
     * PRIVATE FUNCTIONS FOR AI MODELS
     */
    async _callToChatGPTApi(prompt: string) {
        try {
          const headers = {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${getSecret(process.env.OPENAI_API_KEY ?? '')}`
          }

          const data = {
              model: this.CHATGPT_MODEL,
              messages: [
                { role: "user", content: prompt }
              ]
          }

          const response = await firstValueFrom(
              this.httpService.post(this.OPEN_AI_API_URL + 'chat/completions', data, {headers})
          )
          return response.data
        } catch (error) {
          throw new InternalErrorException(`[ImageGenerator] OpenAI request failed. Err: ${error}`)
        }
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
      try {
        const response = await firstValueFrom(
        this.httpService.post(
          this.BLACK_FOREST_API_URL + this.BLACK_FOREST_MODEL,
          {
            prompt: prompt,
            height: 1024,
            width: 1024
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
        throw new InternalErrorException(`[ImageGeneration] Missing polling_url in response`);
      }
    
      return pollingUrl;
      } catch (error) {
        throw new InternalErrorException(`[ImageGeneration] Failed to generate image. Error: ${error}`)
      }
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
          throw new InternalErrorException(`[ImageRetrieval] Image generation failed: ${status}`);
        }
      
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    
      throw new InternalErrorException('[ImageRetrieval] Polling timeout: Image generation did not complete in time');
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
      let response;

      try {
        response = await firstValueFrom(
          this.httpService.get(imageUrl, {
            responseType: 'stream',
          }),
        );
      } catch (error) {
        throw new InternalErrorException(`[Image Download] Image download failed. Error: ${error}`)
      }

      response.data.pipe(writer);

      // Returning public URL
      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          const publicUrl = `${getSecret(process.env.BACKEND_URL ?? '')}/` + join(this.PROMPTED_LOGO_FILEPATH, filename).replace(/^public[\\/]/, '').replace(/\\/g, '/');
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

    async _uploadImageFromUrl(imageUrl: string, filename: string): Promise<string> {
      const response = await firstValueFrom(
        this.httpService.get(imageUrl, { responseType: 'arraybuffer' }),
      );
    
      const buffer = Buffer.from(response.data);
      const key = `${filename}`;
    
      return this.s3.uploadImage(buffer, key);
    }
}
