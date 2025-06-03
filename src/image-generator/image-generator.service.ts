/* eslint-disable prettier/prettier */
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

import { GenerateLogoDto } from 'src/logo/dto/generate-logo.dto';

// DALL-E Docs: https://platform.openai.com/docs/api-reference/images/create

@Injectable()
export class ImageGeneratorService {
    constructor(private readonly httpService: HttpService) {}
    
    async generateLogo(body: GenerateLogoDto) {
        const prompt = `You are a professional logo designer AI. Your task is to create a set of highly creative, visually appealing, and brand-appropriate logo designs based on the following information:Brand name: ${body.brand_name}Brands slogan: ${body.slogan}Industry, that brand operates in: ${body.industry}Preffered brand colors: ${body.brand_colors} Requested logo styles: ${body.logo_style} Similiar styles for inspiration: ${body.similiar_style} Additional details and preferences: ${body.additional_details}Design Instructions:1. Brand Representation    - Capture the essence, values, and personality of the brand.     - Reflect the industry and target audience where possible.     - If a slogan is provided, integrate it harmoniously with the logo.2. Visual Style & Composition     - Adhere to the requested logo style(s): ${body.logo_style}.     - Use the preferred color palette: ${body.brand_colors}.     - If a “similar style” or reference brand is provided, analyze and echo key design elements (composition, fonts, layout, mood) without direct copying.   - The logo should be distinct, memorable, and scalable.3. Typography     - Select a font style that matches the brand’s identity and the specified style (e.g., modern, vintage, playful, elegant).     - Ensure text, if present, is legible at various sizes.4. Symbolism & Iconography     - Use relevant icons or visual metaphors that suit the brand and industry.   - Incorporate any requested motifs or elements from “additional details” (${body.additional_details}).   - Avoid clichés or generic clip-art visuals.5. Layout & Adaptability     - Provide the logo in a balanced layout suitable for both horizontal and vertical use.   - Ensure it works well in color and monochrome (black & white).   - Logo should look strong at large and small sizes (favicon, mobile app, business cards, banners).6. Output & File Specifications     - Design at a minimum resolution of ${body.logo_resolution}.   - Create vector-quality graphics (clean lines, scalable shapes).   - Background should be transparent, unless otherwise requested.   - Export in standard formats (SVG, PNG, JPG).7. Deliverables   - Generate ${body.amount_to_generate} distinct and creative logo variations.   - Present each logo in a mockup context if possible (e.g., on a business card, website header, or merchandise).8. Creative Constraints   - Do NOT use any copyrighted or trademarked elements.   - Do NOT repeat elements from existing famous logos (e.g., do not copy Starbucks logo directly).   - Avoid busy or cluttered visuals; favor clarity and impact.   - Follow modern logo design best practices for 2024.9. Quality & Brand Fit   - Each logo must be unique, original, and tailored to the provided information.   - Ensure alignment with the stated brand values, industry, and any special requests.If any instructions are missing or ambiguous, use professional design judgment to fill in gaps, favoring simplicity, brand uniqueness, and versatility.Begin by conceptualizing, then generate the logo designs as described.`;
        const data = {
            prompt,
            model: "dall-e-3",
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
