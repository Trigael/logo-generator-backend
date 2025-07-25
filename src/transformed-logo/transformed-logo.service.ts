import { Injectable } from '@nestjs/common';
import { Prisma, Transformed_logos } from '@prisma/client';

// Services
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class TransformedLogoService {
    constructor(
        private readonly db: DatabaseService,
    ) {}

    async createTransformedLogo(data: Prisma.Transformed_logosCreateInput): Promise<Transformed_logos> {
      return await this.db.transformed_logos.create({ data })
    }

    async updateTransformedLogo(id_transformed_logo: number, data: Prisma.Transformed_logosUpdateInput): Promise<Transformed_logos> {
        return await this.db.transformed_logos.update({
            where: { id_transformed_logo: id_transformed_logo },
            data
        })
    }
}
