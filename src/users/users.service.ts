import { Injectable } from '@nestjs/common';
import { Users } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class UsersService {
    constructor(
        private readonly db: DatabaseService,
    ) {}

    async getUser(user_id?: number, email?: string): Promise<Users | null> {
        if(user_id) return await this.db.users.findUnique({ where: {id_user: user_id}})

        // Email    
        return await this.db.users.findFirst({ where: { email: email }})
    }

    async createUser(email: string) {
        const user = await this.getUser(undefined, email)

        if(user) return user

        return await this.db.users.create({
            data: {
                email: email
            }
        })
    }
}
