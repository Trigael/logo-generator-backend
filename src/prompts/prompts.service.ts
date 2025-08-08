import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { GenerateLogoDto } from 'src/logo/dto/generate-logo.dto';

@Injectable()
export class PromptsService {
    constructor(
        private readonly db: DatabaseService,
    ) {}

    async createPrompt(data: Prisma.PromptsCreateInput) {
        return await this.db.prompts.create({ data })
    }

    createWholePrompt(body: GenerateLogoDto, amount: number, version?: number) {
        switch(version) {
            case 1: // DALL-E 3
                return `You are a professional logo designer AI. Your task is to create a set of highly creative, visually appealing, and brand-appropriate logo designs based on the following information:Brand name: ${body.brand_name}Brands slogan: ${body.slogan}Industry Preffered brand colors: ${body.brand_colors} Requested logo styles: ${body.logo_style} Additional details and preferences: ${body.additional_details}Design Instructions:1. Brand Representation    - Capture the essence, values, and personality of the brand.     - Reflect the industry and target audience where possible.     - If a slogan is provided, integrate it harmoniously with the logo.2. Visual Style & Composition     - Adhere to the requested logo style(s): ${body.logo_style}.     - Use the preferred color palette: ${body.brand_colors}.     - If a “similar style” or reference brand is provided, analyze and echo key design elements (composition, fonts, layout, mood) without direct copying.   - The logo should be distinct, memorable, and scalable.3. Typography     - Select a font style that matches the brand’s identity and the specified style (e.g., modern, vintage, playful, elegant).     - Ensure text, if present, is legible at various sizes.4. Symbolism & Iconography     - Use relevant icons or visual metaphors that suit the brand and industry.   - Incorporate any requested motifs or elements from “additional details” (${body.additional_details}).   - Avoid clichés or generic clip-art visuals.5. Layout & Adaptability     - Provide the logo in a balanced layout suitable for both horizontal and vertical use.   - Ensure it works well in color and monochrome (black & white).   - Logo should look strong at large and small sizes (favicon, mobile app, business cards, banners).6. Output & File Specifications     - Design at a minimum resolution of ${body.logo_resolution}.   - Create vector-quality graphics (clean lines, scalable shapes).   - Background should be transparent, unless otherwise requested.   - Export in standard formats (SVG, PNG, JPG).7. Deliverables - Generate distinct and creative logo variations.   - Present each logo in a mockup context if possible (e.g., on a business card, website header, or merchandise).8. Creative Constraints   - Do NOT use any copyrighted or trademarked elements.   - Do NOT repeat elements from existing famous logos (e.g., do not copy Starbucks logo directly).   - Avoid busy or cluttered visuals; favor clarity and impact.   - Follow modern logo design best practices for 2024.9. Quality & Brand Fit   - Each logo must be unique, original, and tailored to the provided information.   - Ensure alignment with the stated brand values, industry, and any special requests.If any instructions are missing or ambiguous, use professional design judgment to fill in gaps, favoring simplicity, brand uniqueness, and versatility.Begin by conceptualizing, then generate the logo designs as described.`;
            case 2: // ChatGPT -> Flux.1 [dev]
                return `You are professional prompt engineer for FLUX.1[dev] 3 and I need you to create ${amount} prompt for generating logo following these rules:A flat, scalable logo design for a brand called "${body.brand_name}".The design should be:- ${body.logo_style ?? 'modern, clean, and scalable'} - Using colors: ${body.brand_colors}- Additional details: ${body.additional_details ?? 'No additional details provided by user'}Include:- Brand name ${body.slogan ? 'and the slogan: ' + body.slogan : '' }Design Constraints:- Balanced composition, suitable for mobile, print, and web- Works at small scale (e.g., favicon)- Vector-style, high resolution (1024x1024+)- No gradients, no 3D, no clipart or trademarks. **Return ONLY a valid JSON array of 4 strings. No explanation, no markdown, no prefix. The response must start with '['.**`
            case 3: // ChatGPT -> Flux.1 [dev] | last update: 07.08.25
                return `You are a professional prompt engineer for FLUX.1[dev] 3. Your task is to generate ${amount} creative, high-quality prompts for AI image generation.

                        Each prompt will be used to generate a **flat, scalable** for a company named "${body.brand_name}". For that, each prompt needs to have specified restriction, which are mentioned down bellow.
                                
                        ---
                                
                        ### MUST-HAVE constraints (strictly required):
                        - **Background is white only or without background. No other colors can be used for background.**
                        - **No visible text, words, slogans, brand names, numbers, letters, symbols (™, ©, ®), UI components, labels, or watermarks. There can only be this text: ${body.brand_name}**.
                        - **Do NOT include any mockups, business cards, T-shirt renders, UI frames, product scenes, 3D environments, or branding presentations.**
                        - **Do NOT include any placeholder, random, nonsensical, or gibberish text** (e.g. "LOGONOCYI", "AI†", "Lorem Ipsum", or fake slogan blocks).
                        - **Only generate the clean logo symbol itself, centered and isolated. Nothing else**
                        - **Only one logo create on the image**
                        - Clean, flat, and centered composition.
                        - Must work well at small sizes (e.g., favicon), and be usable in print and on the web.
                        - These constraints **may be overridden only** if explicitly specified in 'additional_details' or 'things_to_exclude'.
                                
                        ---
                                
                        ### SHOULD-HAVE design directions (guidance, not strict):
                        - Style: ${body.logo_style}
                        - Brand colors for logo: ${body.brand_colors}
                        ${body.additional_details ? '- Additional creative guidance: ${body.additional_details}' : ''}
                        ${body.things_to_exclude ? '- Visually avoid: ${body.things_to_exclude}' : ''}
                            => Things above are directions for what colors to use or what they should look like. That doesn't mean you should write text with these directions in the logo itself
                                
                        - Consider metaphors from:
                          - nature, energy, flow, harmony, geometry, digital patterns, motion
                          - abstract representations of brand values like trust, intelligence, innovation, minimalism, playfulness, growth
                                
                        ---
                                
                        ### OUTPUT:
                        Return ONLY a **JSON array** of ${amount} individual prompt strings. For example:
                                
                        ["Prompt 1", "Prompt 2", "Prompt 3"]
                                
                        - No Markdown
                        - No backticks
                        - No explanations
                        `
            default:
                return `You are a professional logo designer AI. Your task is to create a set of highly creative, visually appealing, and brand-appropriate logo designs based on the following information:Brand name: ${body.brand_name}Brands slogan: ${body.slogan} Preffered brand colors: ${body.brand_colors} Requested logo styles: ${body.logo_style} Additional details and preferences: ${body.additional_details}Design Instructions:1. Brand Representation    - Capture the essence, values, and personality of the brand.     - Reflect the industry and target audience where possible.     - If a slogan is provided, integrate it harmoniously with the logo.2. Visual Style & Composition     - Adhere to the requested logo style(s): ${body.logo_style}.     - Use the preferred color palette: ${body.brand_colors}.     - If a “similar style” or reference brand is provided, analyze and echo key design elements (composition, fonts, layout, mood) without direct copying.   - The logo should be distinct, memorable, and scalable.3. Typography     - Select a font style that matches the brand’s identity and the specified style (e.g., modern, vintage, playful, elegant).     - Ensure text, if present, is legible at various sizes.4. Symbolism & Iconography     - Use relevant icons or visual metaphors that suit the brand and industry.   - Incorporate any requested motifs or elements from “additional details” (${body.additional_details}).   - Avoid clichés or generic clip-art visuals.5. Layout & Adaptability     - Provide the logo in a balanced layout suitable for both horizontal and vertical use.   - Ensure it works well in color and monochrome (black & white).   - Logo should look strong at large and small sizes (favicon, mobile app, business cards, banners).6. Output & File Specifications     - Design at a minimum resolution of ${body.logo_resolution}.   - Create vector-quality graphics (clean lines, scalable shapes).   - Background should be transparent, unless otherwise requested.   - Export in standard formats (SVG, PNG, JPG).7. Deliverables   - Generate distinct and creative logo variations.   - Present each logo in a mockup context if possible (e.g., on a business card, website header, or merchandise).8. Creative Constraints   - Do NOT use any copyrighted or trademarked elements.   - Do NOT repeat elements from existing famous logos (e.g., do not copy Starbucks logo directly).   - Avoid busy or cluttered visuals; favor clarity and impact.   - Follow modern logo design best practices for 2024.9. Quality & Brand Fit   - Each logo must be unique, original, and tailored to the provided information.   - Ensure alignment with the stated brand values, industry, and any special requests.If any instructions are missing or ambiguous, use professional design judgment to fill in gaps, favoring simplicity, brand uniqueness, and versatility.Begin by conceptualizing, then generate the logo designs as described.`; 
        }
    }

    getPromptForWatermarkingImage(model: 'dall-e' | 'flux') {
        switch(model) {
            case 'dall-e':
                return `Write the word LOGONEST.AI across the image in large bold white letters, diagonally from corner to corner.`
                
            case 'flux':
                return ``
            default:
                return `Add a semi-transparent white diagonal watermark that says "LOGONEST.AI" repeatedly in a row-based pattern. The watermark should be rotated diagonally from the bottom left to the top right of the image, with visible spacing between each repetition. The text should be in a simple sans-serif font, approximately 40% opacity, and extend across the entire image surface without obscuring the main logo.`
        }
    }

    async updatePrompt(id_prompt: number, data: Prisma.PromptsUpdateInput) {
        return await this.db.prompts.update({
            where: { id_prompt },
            data
        })
    }
}
